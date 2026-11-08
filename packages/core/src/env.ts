import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

function ensureEnvLoaded(): void {
  if (process.env['DATABASE_URL'] && process.env['REDIS_URL']) return;
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      try {
        process.loadEnvFile(envPath);
        break;
      } catch {
        // ignore
      }
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
}

ensureEnvLoaded();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('Asia/Tehran'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  QUEUE_PREFIX: z.string().default('cmms'),
  AUTH_SECRET: z.string().min(16).optional(),
  AUTH_URL: z.string().url().optional(),
  SMS_PROVIDER: z.string().default('kavenegar'),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER: z.string().optional(),
  BALE_BOT_TOKEN: z.string().optional(),
  BALE_API_BASE_URL: z.string().default('https://tapi.bale.ai'),
  EITAA_BOT_TOKEN: z.string().optional(),
  EITAA_API_BASE_URL: z.string().default('https://eitaayar.ir/api'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('cmms@factory.local'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  return EnvSchema.parse(raw);
}
