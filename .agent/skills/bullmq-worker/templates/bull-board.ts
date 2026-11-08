// apps/worker/src/bull-board.ts  -- internal admin UI. NEVER expose publicly.
import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { QUEUES, getQueue } from '@cmms/queue/queues';

export function startBoard(port = 3030) {
  const adapter = new ExpressAdapter();
  adapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: Object.values(QUEUES).map((n) => new BullMQAdapter(getQueue(n))),
    serverAdapter: adapter,
  });

  const app = express();
  app.get('/healthz', async (_req, res) => { /* ping redis + db, return 200/503 */ res.send('ok'); });
  app.use('/admin/queues', basicAuth(process.env.BOARD_USER!, process.env.BOARD_PASS!), adapter.getRouter());
  app.listen(port, '0.0.0.0'); // bind inside docker network only; no published port
}

function basicAuth(user: string, pass: string): express.RequestHandler {
  return (req, res, next) => {
    const [u, p] = Buffer.from((req.headers.authorization ?? '').split(' ')[1] ?? '', 'base64').toString().split(':');
    if (u === user && p === pass) return next();
    res.set('WWW-Authenticate', 'Basic').status(401).send('auth required');
  };
}
