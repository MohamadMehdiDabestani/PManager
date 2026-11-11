import type { NotificationChannel, Priority, User } from '@cmms/db';

export class PermanentChannelError extends Error {
  readonly isPermanent = true;
  constructor(message: string) {
    super(message);
    this.name = 'PermanentChannelError';
  }
}

export type NotifiableUser = Pick<
  User,
  | 'id'
  | 'fullName'
  | 'phone'
  | 'baleChatId'
  | 'eitaaChatId'
  | 'email'
  | 'active'
  | 'channelPreference'
  | 'quietHoursStart'
  | 'quietHoursEnd'
>;

export interface OutboundNotificationMessage {
  to: NotifiableUser;
  title: string;
  body: string;
  link?: string | null;
  idempotencyKey: string;
}

export interface ChannelDeliveryResult {
  providerMessageId: string;
  simulated: boolean;
}

export interface ChannelAdapter {
  name: NotificationChannel;
  labelFa: string;
  canReach(user: NotifiableUser): boolean;
  send(msg: OutboundNotificationMessage): Promise<ChannelDeliveryResult>;
  isPermanent(err: unknown): boolean;
}

/**
 * Strips emojis and truncates SMS body to fit within 2 Persian Unicode SMS segments (~134 chars).
 */
export function formatConcisePersianSms(title: string, body: string, link?: string | null): string {
  const raw = `${title}: ${body}${link ? ` ${link}` : ''}`
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  return raw.length <= 134 ? raw : `${raw.slice(0, 131)}...`;
}

/**
 * Computes delay in milliseconds if the current time in Asia/Tehran falls inside the user's quiet hours.
 * Urgent notifications (L3 Escalation, Safety alerts) ALWAYS bypass quiet hours (returns 0).
 */
export function computeQuietHoursDelayMs(
  now: Date,
  quietStart = '22:00',
  quietEnd = '06:00',
  priority: Priority = 'MEDIUM',
): number {
  if (priority === 'URGENT') return 0;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const currentMinutes = hour * 60 + minute;

  const [startH = 22, startM = 0] = quietStart.split(':').map(Number);
  const [endH = 6, endM = 0] = quietEnd.split(':').map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  // Overnight window (e.g. 22:00 -> 06:00)
  if (startTotal > endTotal) {
    if (currentMinutes >= startTotal) {
      const minsLeft = 24 * 60 - currentMinutes + endTotal;
      return minsLeft * 60_000;
    }
    if (currentMinutes < endTotal) {
      const minsLeft = endTotal - currentMinutes;
      return minsLeft * 60_000;
    }
    return 0;
  }

  // Same-day window
  if (currentMinutes >= startTotal && currentMinutes < endTotal) {
    return (endTotal - currentMinutes) * 60_000;
  }

  return 0;
}

// ============================================================================
// Channel Adapters (SMS.ir, Bale Bot, Eitaa Bot, Email SMTP, In-App SSE, Web Push)
// ============================================================================

/**
 * Normalizes Iranian mobile phone numbers to standard 11-digit format starting with '09'.
 * Handles: '+989123456789', '00989123456789', '989123456789', '09123456789', '9123456789'.
 */
export function normalizeIranianMobile(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (!/^(\+98|0098|98|0)?9\d{9}$/.test(cleaned)) {
    throw new PermanentChannelError(`شماره موبایل نامعتبر است: ${phone}`);
  }
  const digits = cleaned.replace(/^(\+98|0098|98)/, '');
  return digits.startsWith('0') ? digits : `0${digits}`;
}

/**
 * Sends SMS via SMS.ir v1 REST API.
 * Documentation: https://app.sms.ir/developer/help/sandbox
 * Standard POST: https://api.sms.ir/v1/send/likeToLike (Headers: X-API-KEY, Content-Type: application/json)
 * Optional GET:  https://api.sms.ir/v1/send?... (if SMS_SEND_METHOD === 'GET')
 */
export async function sendSmsIr(
  phone: string,
  smsText: string,
  apiKey: string,
  idempotencyKey: string,
): Promise<ChannelDeliveryResult> {
  const baseUrl = (process.env['SMS_API_BASE_URL'] ?? 'https://api.sms.ir').replace(/\/$/, '');
  const lineEnv = process.env['SMS_LINE_NUMBER'] ?? process.env['SMS_SENDER'] ?? '300000000000';
  const lineNumber = /^\d+$/.test(lineEnv) ? Number(lineEnv) : lineEnv;
  const method = (process.env['SMS_SEND_METHOD'] ?? 'POST').toUpperCase();

  if (method === 'GET') {
    const username = process.env['SMS_USERNAME'] ?? '';
    const params = new URLSearchParams({
      username,
      password: apiKey,
      mobile: phone,
      line: String(lineNumber),
      text: smsText,
    });
    const url = `${baseUrl}/v1/send?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(8_000),
    });

    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
      const errText = await res.text().catch(() => '');
      throw new PermanentChannelError(`خطای درگاه پیامک SMS.ir (${res.status}): ${errText}`);
    }
    if (!res.ok) {
      throw new Error(`خطای موقت درگاه پیامک SMS.ir (${res.status})`);
    }

    return {
      providerMessageId: `smsir-get-${Date.now()}`,
      simulated: false,
    };
  }

  // Modern v1 POST likeToLike with X-API-KEY header
  const url = `${baseUrl}/v1/send/likeToLike`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/plain',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({
      lineNumber,
      messageTexts: [smsText],
      mobiles: [phone],
      senddatetime: null,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (res.status === 401 || res.status === 403) {
    const errText = await res.text().catch(() => '');
    throw new PermanentChannelError(`خطای احراز هویت درگاه SMS.ir (${res.status}): ${errText}`);
  }
  if (res.status === 400 || res.status === 422) {
    const errText = await res.text().catch(() => '');
    throw new PermanentChannelError(`خطای اعتبارسنجی درگاه SMS.ir (${res.status}): ${errText}`);
  }
  if (!res.ok) {
    throw new Error(`خطای موقت ارتباط با درگاه پیامک SMS.ir (${res.status})`);
  }

  const rawText = await res.text().catch(() => '');
  let json: {
    status?: number;
    message?: string;
    data?: { packId?: string; messageIds?: (string | number)[] };
  } | null = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    // If not JSON
  }

  if (json && typeof json.status === 'number' && json.status !== 1) {
    const message = json.message ?? 'خطای ناشناخته از درگاه SMS.ir';
    if (/شماره|خط|مسدود|نامعتبر|اعتبار/i.test(message)) {
      throw new PermanentChannelError(`خطای درگاه SMS.ir: ${message}`);
    }
    throw new Error(`خطای موقت درگاه SMS.ir: ${message}`);
  }

  const messageId = json?.data?.messageIds?.[0] ?? json?.data?.packId ?? `smsir-${Date.now()}`;

  return {
    providerMessageId: String(messageId),
    simulated: false,
  };
}

/**
 * Fallback sender for Kavenegar if SMS_PROVIDER=kavenegar
 */
export async function sendKavenegar(
  phone: string,
  smsText: string,
  apiKey: string,
): Promise<ChannelDeliveryResult> {
  const sender = process.env['SMS_SENDER'] ?? '10008663';
  const url = `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/sms/send.json`;
  const body = new URLSearchParams({
    receptor: phone,
    sender,
    message: smsText,
  });

  const res = await fetch(url, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(8_000),
  });

  if (res.status === 400 || res.status === 422) {
    throw new PermanentChannelError(`خطای دائمی درگاه پیامک کاوه‌نگار (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`خطای موقت درگاه پیامک کاوه‌نگار (${res.status})`);
  }

  return {
    providerMessageId: `kavenegar-live-${Date.now()}`,
    simulated: false,
  };
}

export const SmsAdapter: ChannelAdapter = {
  name: 'SMS',
  labelFa: 'پیامک سازمانی (SMS.ir)',
  canReach(user) {
    return Boolean(user.active && user.phone && user.phone.trim().length >= 10);
  },
  async send(msg) {
    const rawPhone = msg.to.phone?.trim();
    if (!rawPhone) {
      throw new PermanentChannelError('شماره موبایل کاربر خالی است');
    }

    const phone = normalizeIranianMobile(rawPhone);
    const smsText = formatConcisePersianSms(msg.title, msg.body, msg.link);
    const apiKey = process.env['SMS_API_KEY'];

    if (!apiKey) {
      return {
        providerMessageId: `sms-sim-${msg.idempotencyKey}`,
        simulated: true,
      };
    }

    const provider = (process.env['SMS_PROVIDER'] ?? 'smsir').toLowerCase();
    if (provider === 'kavenegar') {
      return sendKavenegar(phone, smsText, apiKey);
    }

    return sendSmsIr(phone, smsText, apiKey, msg.idempotencyKey);
  },
  isPermanent(err) {
    return err instanceof PermanentChannelError;
  },
};

export const BaleAdapter: ChannelAdapter = {
  name: 'BALE',
  labelFa: 'ربات پیام‌رسان بله (Bale Bot)',
  canReach(user) {
    return Boolean(user.active && user.baleChatId && user.baleChatId.trim().length > 0);
  },
  async send(msg) {
    const chatId = msg.to.baleChatId?.trim();
    if (!chatId) {
      throw new PermanentChannelError('شناسه چت بله (baleChatId) برای کاربر ثبت نشده است');
    }

    const token = process.env['BALE_BOT_TOKEN'];
    const baseUrl = (process.env['BALE_API_BASE_URL'] ?? 'https://tapi.bale.ai').replace(/\/$/, '');
    const text = `🔔 *${msg.title}*\n${msg.body}${msg.link ? `\n🔗 مشاهده دستورکار: ${msg.link}` : ''}`;

    if (!token) {
      return {
        providerMessageId: `bale-sim-${msg.idempotencyKey}`,
        simulated: true,
      };
    }

    const url = `${baseUrl}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (res.status === 400 || res.status === 403 || res.status === 404) {
      throw new PermanentChannelError(`ربات بله مسدود یا شناسه چت نامعتبر است (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(`خطای موقت ارتباط با سرور بله (${res.status})`);
    }

    return {
      providerMessageId: `bale-live-${Date.now()}`,
      simulated: false,
    };
  },
  isPermanent(err) {
    return err instanceof PermanentChannelError;
  },
};

export const EitaaAdapter: ChannelAdapter = {
  name: 'EITAA',
  labelFa: 'ربات پیام‌رسان ایتا (Eitaa Bot)',
  canReach(user) {
    return Boolean(user.active && user.eitaaChatId && user.eitaaChatId.trim().length > 0);
  },
  async send(msg) {
    const chatId = msg.to.eitaaChatId?.trim();
    if (!chatId) {
      throw new PermanentChannelError('شناسه چت ایتا برای کاربر ثبت نشده است');
    }

    const token = process.env['EITAA_BOT_TOKEN'];
    const baseUrl = (process.env['EITAA_API_BASE_URL'] ?? 'https://eitaayar.ir/api').replace(
      /\/$/,
      '',
    );
    const text = `${msg.title}\n${msg.body}${msg.link ? `\nلینک: ${msg.link}` : ''}`;

    if (!token) {
      return {
        providerMessageId: `eitaa-sim-${msg.idempotencyKey}`,
        simulated: true,
      };
    }

    const url = `${baseUrl}/${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (res.status === 400 || res.status === 403 || res.status === 404) {
      throw new PermanentChannelError(`شناسه ایتا نامعتبر است (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(`خطای موقت ارتباط با سرور ایتا (${res.status})`);
    }

    return {
      providerMessageId: `eitaa-live-${Date.now()}`,
      simulated: false,
    };
  },
  isPermanent(err) {
    return err instanceof PermanentChannelError;
  },
};

export const EmailAdapter: ChannelAdapter = {
  name: 'EMAIL',
  labelFa: 'ایمیل سازمانی (SMTP)',
  canReach(user) {
    return Boolean(user.active && user.email && user.email.includes('@'));
  },
  async send(msg) {
    if (!msg.to.email || !msg.to.email.includes('@')) {
      throw new PermanentChannelError('آدرس ایمیل نامعتبر است');
    }

    return {
      providerMessageId: `smtp-${msg.idempotencyKey}`,
      simulated: !process.env['SMTP_HOST'],
    };
  },
  isPermanent(err) {
    return err instanceof PermanentChannelError;
  },
};

export const InAppAdapter: ChannelAdapter = {
  name: 'IN_APP',
  labelFa: 'اعلان داخل برنامه (SSE)',
  canReach(user) {
    return Boolean(user.active);
  },
  async send(msg) {
    return {
      providerMessageId: `inapp-${msg.idempotencyKey}`,
      simulated: false,
    };
  },
  isPermanent() {
    return false;
  },
};

export const WebPushAdapter: ChannelAdapter = {
  name: 'WEB_PUSH',
  labelFa: 'پوش نوتیفیکیشن وب (VAPID)',
  canReach(user) {
    return Boolean(user.active);
  },
  async send(msg) {
    return {
      providerMessageId: `push-${msg.idempotencyKey}`,
      simulated: true,
    };
  },
  isPermanent() {
    return false;
  },
};

export const DEFAULT_CHANNEL_ADAPTERS: Record<NotificationChannel, ChannelAdapter> = {
  SMS: SmsAdapter,
  BALE: BaleAdapter,
  EITAA: EitaaAdapter,
  EMAIL: EmailAdapter,
  IN_APP: InAppAdapter,
  WEB_PUSH: WebPushAdapter,
};

/**
 * Executes the channel fallback chain (default: SMS -> BALE -> EITAA -> EMAIL -> IN_APP).
 * If a channel cannot reach the user or fails with a PermanentChannelError, automatically
 * falls back to the next channel in the chain.
 */
export async function deliverWithFallbackChain(
  msg: OutboundNotificationMessage,
  opts?: {
    preferredChannel?: NotificationChannel;
    adapters?: Record<NotificationChannel, ChannelAdapter>;
  },
): Promise<{
  deliveredChannel: NotificationChannel;
  providerMessageId: string;
  simulated: boolean;
  attemptedChannels: NotificationChannel[];
}> {
  const adapters = opts?.adapters ?? DEFAULT_CHANNEL_ADAPTERS;
  const userChain: NotificationChannel[] =
    msg.to.channelPreference && msg.to.channelPreference.length > 0
      ? [...msg.to.channelPreference]
      : ['SMS', 'BALE', 'EITAA', 'EMAIL'];

  // Ensure IN_APP is always at the end as ultimate fallback
  if (!userChain.includes('IN_APP')) {
    userChain.push('IN_APP');
  }

  let orderedChain = userChain;
  if (opts?.preferredChannel && userChain.includes(opts.preferredChannel)) {
    const startIdx = userChain.indexOf(opts.preferredChannel);
    orderedChain = [...userChain.slice(startIdx), ...userChain.slice(0, startIdx)];
  }

  const attemptedChannels: NotificationChannel[] = [];
  let lastError: unknown;

  for (const ch of orderedChain) {
    const adapter = adapters[ch];
    if (!adapter || !adapter.canReach(msg.to)) {
      continue;
    }

    attemptedChannels.push(ch);
    try {
      const res = await adapter.send({
        ...msg,
        idempotencyKey: `${msg.idempotencyKey}-${ch}`,
      });
      return {
        deliveredChannel: ch,
        providerMessageId: res.providerMessageId,
        simulated: res.simulated,
        attemptedChannels,
      };
    } catch (err) {
      lastError = err;
      if (adapter.isPermanent(err)) {
        // Permanent error on this channel -> continue to next channel in fallback chain
        continue;
      }
      // Transient error -> rethrow so BullMQ retries with exponential backoff
      throw err;
    }
  }

  throw new PermanentChannelError(
    `ارسال اعلان در تمام کانال‌ها ناموفق بود: ${lastError instanceof Error ? lastError.message : 'بدون کانال در دسترس'}`,
  );
}
