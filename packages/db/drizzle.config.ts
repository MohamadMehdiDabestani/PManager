import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// لود خودکار .env با متد نیتیو Node.js 20+ (بدون نیاز به کتابخانه جانبی)
const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
];

for (const envPath of envPaths) {
  if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
}

const dbUrl = process.env['DATABASE_URL'];
if (!dbUrl) {
  throw new Error('DATABASE_URL is not defined in environment variables or .env file');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl,
  },
  verbose: true,
  strict: true,
});
