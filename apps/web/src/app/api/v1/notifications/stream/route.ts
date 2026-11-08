import { listNotifications } from '@cmms/core';
import { getServerContext } from '@/lib/server-context';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { ctx } = await getServerContext();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const items = await listNotifications(ctx, { limit: 10 });
        const unreadCount = items.filter((n) => !n.readAt).length;
        const payload = JSON.stringify({
          unreadCount,
          latest: items[0] ?? null,
          timestamp: new Date().toISOString(),
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } catch {
        controller.enqueue(encoder.encode(`data: {"unreadCount":0}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
