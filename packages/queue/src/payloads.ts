import { z } from 'zod';

export const GenerateWorkOrdersPayload = z.object({
  scheduleId: z.string().uuid().optional(),
  horizonDays: z.number().int().min(0).max(30).default(0),
});

export const SendNotificationPayload = z.object({
  notificationId: z.string().uuid(),
});

export const EscalatePayload = z.object({
  workOrderId: z.string().uuid(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const OverdueScanPayload = z.object({
  plantId: z.string().uuid().optional(),
});
