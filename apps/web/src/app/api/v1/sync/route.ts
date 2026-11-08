import { NextResponse, type NextRequest } from 'next/server';
import {
  listWorkOrders,
  listParts,
  verifyLotoForWorkOrder,
  startWorkOrder,
  saveWorkOrderProgress,
  recordWorkOrderPartUsage,
  recordDowntimeLog,
  completeWorkOrder,
  flagUnsafeWorkOrder,
} from '@cmms/core';
import type { ChecklistResultEntry } from '@cmms/db';
import { cancelWorkOrderJobs } from '@cmms/queue';
import { getServerContext } from '@/lib/server-context';

export async function GET() {
  try {
    const { ctx } = await getServerContext();
    const [orders, parts] = await Promise.all([
      listWorkOrders(ctx),
      listParts(ctx),
    ]);

    return NextResponse.json({
      data: {
        workOrders: orders,
        parts,
        cursor: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { code: 'SYNC_PULL_ERROR', message: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}

interface IncomingAction {
  clientId: string;
  workOrderId: string;
  type:
    | 'VERIFY_LOTO'
    | 'START_WO'
    | 'SAVE_PROGRESS'
    | 'USE_PART'
    | 'LOG_DOWNTIME'
    | 'COMPLETE_WO'
    | 'FLAG_UNSAFE';
  payload: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const { ctx } = await getServerContext();
    const body = (await req.json()) as { actions?: IncomingAction[] };
    const actions = body.actions ?? [];

    const results: Array<{ clientId: string; ok: boolean; error?: string }> = [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'VERIFY_LOTO': {
            await verifyLotoForWorkOrder(ctx, {
              workOrderId: action.workOrderId,
              lotoLockId: String(action.payload['lotoLockId'] ?? ''),
            });
            break;
          }
          case 'START_WO': {
            await startWorkOrder(ctx, action.workOrderId);
            break;
          }
          case 'SAVE_PROGRESS': {
            await saveWorkOrderProgress(ctx, {
              workOrderId: action.workOrderId,
              checklistResult: (action.payload['checklistResult'] as ChecklistResultEntry[]) ?? [],
              note: action.payload['note'] ? String(action.payload['note']) : undefined,
            });
            break;
          }
          case 'USE_PART': {
            await recordWorkOrderPartUsage(ctx, {
              workOrderId: action.workOrderId,
              partId: String(action.payload['partId'] ?? ''),
              quantityUsed: Number(action.payload['quantityUsed'] ?? 1),
              clientId: action.clientId,
            });
            break;
          }
          case 'LOG_DOWNTIME': {
            await recordDowntimeLog(ctx, {
              workOrderId: action.workOrderId,
              assetId: String(action.payload['assetId'] ?? ''),
              durationMinutes: Number(action.payload['durationMinutes'] ?? 15),
              reason: String(action.payload['reason'] ?? 'توقف ثبت‌شده در دستورکار'),
              isPlanned: Boolean(action.payload['isPlanned']),
            });
            break;
          }
          case 'COMPLETE_WO': {
            await completeWorkOrder(ctx, {
              workOrderId: action.workOrderId,
              checklistResult: (action.payload['checklistResult'] as ChecklistResultEntry[]) ?? [],
              completionNote: action.payload['completionNote']
                ? String(action.payload['completionNote'])
                : undefined,
              clientId: action.clientId,
            });
            try {
              await cancelWorkOrderJobs(action.workOrderId, [-1440, 0, 60]);
            } catch {
              // ignore queue error
            }
            break;
          }
          case 'FLAG_UNSAFE': {
            await flagUnsafeWorkOrder(
              ctx,
              action.workOrderId,
              String(action.payload['reason'] ?? 'شرایط ناایمن اعلام‌شده توسط تکنسین'),
            );
            break;
          }
        }
        results.push({ clientId: action.clientId, ok: true });
      } catch (err) {
        results.push({
          clientId: action.clientId,
          ok: false,
          error: err instanceof Error ? err.message : 'خطای نامشخص در اجرای عملیات',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { code: 'SYNC_PUSH_ERROR', message: err instanceof Error ? err.message : 'Error' },
      { status: 400 },
    );
  }
}
