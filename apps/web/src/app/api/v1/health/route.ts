import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'pmanager-cmms-web',
    orm: 'drizzle-orm',
    timezone: 'Asia/Tehran',
    timestamp: new Date().toISOString(),
  });
}
