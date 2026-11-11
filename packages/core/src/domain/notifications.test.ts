import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeQuietHoursDelayMs,
  formatConcisePersianSms,
  deliverWithFallbackChain,
  normalizeIranianMobile,
  sendSmsIr,
  SmsAdapter,
  PermanentChannelError,
} from './notifications';

describe('Notification Engine - Quiet Hours, SMS Formatting & Bale/Eitaa Fallback Chain', () => {
  it('delays non-urgent notifications during Tehran quiet hours (22:00 to 06:00) and bypasses for URGENT', () => {
    // 2026-03-01T20:00:00Z is 23:30 in Asia/Tehran (+03:30) -> inside quiet hours (22:00-06:00)
    const tehranNight = new Date('2026-03-01T20:00:00Z');
    const delayNormal = computeQuietHoursDelayMs(tehranNight, '22:00', '06:00', 'MEDIUM');
    expect(delayNormal).toBeGreaterThan(0);

    // URGENT (Level 3 escalation / Safety) must never be delayed by quiet hours
    const delayUrgent = computeQuietHoursDelayMs(tehranNight, '22:00', '06:00', 'URGENT');
    expect(delayUrgent).toBe(0);
  });

  it('strips emojis and truncates SMS body to 2 Persian Unicode segments (<= 134 chars)', () => {
    const text = formatConcisePersianSms(
      '🔔 هشدار PM',
      'سرویس ماهانه پرس هیدرولیک ۱۰۰۰ تن در سالن ۱ فردا ساعت ۰۸:۰۰ سررسید می‌شود',
      '/m/wo/123',
    );
    expect(text).not.toContain('🔔');
    expect(text.length).toBeLessThanOrEqual(134);
  });

  it('normalizes various Iranian mobile formats to 09xxxxxxxxx', () => {
    expect(normalizeIranianMobile('09123456789')).toBe('09123456789');
    expect(normalizeIranianMobile('+989123456789')).toBe('09123456789');
    expect(normalizeIranianMobile('00989123456789')).toBe('09123456789');
    expect(normalizeIranianMobile('9123456789')).toBe('09123456789');
    expect(normalizeIranianMobile('0912-345-6789')).toBe('09123456789');
    expect(normalizeIranianMobile('0912 345 6789')).toBe('09123456789');
    expect(() => normalizeIranianMobile('invalid-phone-123')).toThrow(PermanentChannelError);
  });

  it('automatically falls back from invalid SMS to Bale Bot (BALE)', async () => {
    const userWithInvalidPhoneAndValidBale = {
      id: 'u1',
      fullName: 'رضا اکبری',
      phone: 'invalid-phone-123',
      baleChatId: 'bale_chat_987654',
      eitaaChatId: 'eitaa_chat_987654',
      email: 'tech@factory.local',
      active: true,
      channelPreference: ['SMS', 'BALE', 'EITAA', 'EMAIL'] as Array<
        'SMS' | 'BALE' | 'EITAA' | 'EMAIL'
      >,
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
    };

    const res = await deliverWithFallbackChain({
      to: userWithInvalidPhoneAndValidBale,
      title: 'یادآوری سرویس کمپرسور',
      body: 'موعد سرویس ۵۰۰ ساعته کمپرسور اسکرو',
      link: '/m/work-orders',
      idempotencyKey: 'test-bale-fallback-1',
    });

    expect(res.attemptedChannels).toEqual(['SMS', 'BALE']);
    expect(res.deliveredChannel).toBe('BALE');
  });

  describe('SMS.ir Integration', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
      vi.restoreAllMocks();
    });

    afterEach(() => {
      process.env = originalEnv;
      vi.restoreAllMocks();
    });

    it('returns simulated result when SMS_API_KEY is not configured', async () => {
      delete process.env['SMS_API_KEY'];
      const res = await SmsAdapter.send({
        to: {
          id: 'u1',
          fullName: 'علی محمدی',
          phone: '09123456789',
          baleChatId: null,
          eitaaChatId: null,
          email: null,
          active: true,
          channelPreference: ['SMS'],
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00',
        },
        title: 'هشدار خرابی',
        body: 'پمپ شماره ۲ متوقف شد',
        idempotencyKey: 'test-sms-sim-1',
      });

      expect(res.simulated).toBe(true);
      expect(res.providerMessageId).toContain('sms-sim-test-sms-sim-1');
    });

    it('sends SMS via SMS.ir v1 likeToLike POST with X-API-KEY and json payload', async () => {
      process.env['SMS_API_KEY'] = 'test-api-key-123';
      process.env['SMS_LINE_NUMBER'] = '300077329';
      process.env['SMS_PROVIDER'] = 'smsir';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: 1,
            message: 'موفق',
            data: {
              packId: 'pack-999',
              messageIds: [987654321],
              cost: 1.5,
            },
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await sendSmsIr('09123456789', 'تست پیامک SMS.ir', 'test-api-key-123', 'idemp-1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const [calledUrl, calledOpts] = call!;
      expect(calledUrl).toBe('https://api.sms.ir/v1/send/likeToLike');
      expect(calledOpts.method).toBe('POST');
      expect(calledOpts.headers['X-API-KEY']).toBe('test-api-key-123');
      expect(calledOpts.headers['Content-Type']).toBe('application/json');

      const parsedBody = JSON.parse(calledOpts.body as string);
      expect(parsedBody.lineNumber).toBe(300077329);
      expect(parsedBody.mobiles).toEqual(['09123456789']);
      expect(parsedBody.messageTexts).toEqual(['تست پیامک SMS.ir']);

      expect(res.simulated).toBe(false);
      expect(res.providerMessageId).toBe('987654321');
    });

    it('throws PermanentChannelError when SMS.ir returns 401 Unauthorized', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        sendSmsIr('09123456789', 'متن پیامک', 'wrong-key', 'idemp-err'),
      ).rejects.toThrow(PermanentChannelError);
    });
  });
});
