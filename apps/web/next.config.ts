import type { NextConfig } from 'next';
import { existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Automatically load and sync monorepo root .env into apps/web/.env.local for Next.js
const rootEnvPath = resolve(__dirname, '../../.env');
if (existsSync(rootEnvPath)) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(rootEnvPath);
    } catch {}
  }
  const localEnvPath = resolve(__dirname, '.env.local');
  try {
    copyFileSync(rootEnvPath, localEnvPath);
  } catch {}
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cmms/core', '@cmms/db', '@cmms/queue'],
  serverExternalPackages: ['pg', 'pg-connection-string', 'bullmq', 'ioredis'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
