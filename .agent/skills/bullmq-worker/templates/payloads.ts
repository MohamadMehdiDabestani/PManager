import { z } from 'zod';

// IDs only. Processors re-load fresh state from the DB.
export const GenerateWorkOrdersPayload = z.object({
  scheduleId: z.string().uuid().optional(), // omit = all due schedules
  horizonDays: z.number().int().min(0).max(60).default(0),
});

export const SendNotificationPayload = z.object({ notificationId: z.string().uuid() });

export const EscalatePayload = z.object({
  workOrderId: z.string().uuid(),
  level: z.number().int().min(1).max(3),
});

export const ReminderPayload = z.object({
  workOrderId: z.string().uuid(),
  offsetMinutes: z.number().int(), // negative = before due
});

export type GenerateWorkOrders = z.infer<typeof GenerateWorkOrdersPayload>;
export type SendNotification = z.infer<typeof SendNotificationPayload>;
export type Escalate = z.infer<typeof EscalatePayload>;
export type Reminder = z.infer<typeof ReminderPayload>;
