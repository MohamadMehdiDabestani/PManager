import { NextResponse, type NextRequest } from 'next/server';
import {
  listNotifications,
  createAndSendNotification,
  markAllNotificationsRead,
  AppForbidden,
} from '@cmms/core';
import type { NotificationChannel, NotificationStatus } from '@cmms/db';
import { getServerContext } from '@/lib/server-context';

export async function GET(req: NextRequest) {
  try {
    const { ctx } = await getServerContext();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') ?? undefined;
    const status = (searchParams.get('status') as NotificationStatus) ?? undefined;
    const channel = (searchParams.get('channel') as NotificationChannel) ?? undefined;

    const items = await listNotifications(ctx, { userId, status, channel });
    const unreadCount = items.filter((n) => !n.readAt).length;

    return NextResponse.json({ data: items, unreadCount });
  } catch (err) {
    if (err instanceof AppForbidden) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 403 });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx } = await getServerContext();
    const body = await req.json();

    if (body.action === 'MARK_ALL_READ') {
      await markAllNotificationsRead(ctx, body.userId);
      return NextResponse.json({ ok: true });
    }

    const res = await createAndSendNotification(ctx, body);
    return NextResponse.json({ data: res }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 },
    );
  }
}
