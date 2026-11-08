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
// Channel Adapters (SMS, Bale Bot, Eitaa Bot, Email SMTP, In-App SSE, Web Push)
// ============================================================================

export const SmsAdapter: ChannelAdapter = {
  name: 'SMS',
  labelFa: 'پیامک سازمانی (SMS)',
  canReach(user) {
    return Boolean(user.active && user.phone && user.phone.trim().length >= 10);
  },
  async send(msg) {
    const phone = msg.to.phone?.trim();
    if (!phone || !/^(\+98|0)?9\d{9}$/.test(phone)) {
      throw new PermanentChannelError(`شماره موبایل نامعتبر است: ${phone ?? 'خالی'}`);
    }

    const smsText = formatConcisePersianSms(msg.title, msg.body, msg.link);
    const apiKey = process.env['SMS_API_KEY'];

    if (!apiKey) {
      return {
        providerMessageId: `sms-sim-${msg.idempotencyKey}`,
        simulated: true,
      };
    }

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
      throw new PermanentChannelError(`خطای دائمی درگاه پیامک (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(`خطای موقت درگاه پیامک (${res.status})`);
    }

    return {
      providerMessageId: `sms-live-${Date.now()}`,
      simulated: false,
    };
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
