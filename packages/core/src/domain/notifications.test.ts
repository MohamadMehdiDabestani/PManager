import { describe, it, expect } from 'vitest';
import {
  computeQuietHoursDelayMs,
  formatConcisePersianSms,
  deliverWithFallbackChain,
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
});
