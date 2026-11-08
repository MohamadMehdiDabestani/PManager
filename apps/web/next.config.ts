import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cmms/core', '@cmms/db', '@cmms/queue'],
};

export default nextConfig;
