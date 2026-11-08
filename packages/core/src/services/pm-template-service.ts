import { z } from 'zod';
import { and, eq, isNull, desc } from 'drizzle-orm';
import {
  pmTemplates,
  type PmTemplate,
  type ChecklistItemDefinition,
} from '@cmms/db';
import { assertCan, accessibleWhere } from '../auth/index';
import type { ServiceContext } from '../context';
import { writeAuditLog } from './audit-service';

export const STANDARD_PPE_LIST = [
  'کلاه ایمنی',
  'عینک ایمنی',
  'دستکش عایق برق',
  'دستکش ضدبرش',
  'کفش ایمنی',
  'گوشی صداگیر',
  'ماسک تنفسی',
  'کمربند ایمنی (هارنس)',
  'لباس کار نسوز',
  'شیلد محافظ صورت',
] as const;

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'عنوان آیتم چک‌لیست الزامی است'),
  type: z.enum(['BOOLEAN', 'NUMBER', 'TEXT', 'PHOTO']),
  unit: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  required: z.boolean().default(true),
});

export const createPmTemplateSchema = z.object({
  plantId: z.string().uuid('شناسه کارخانه نامعتبر است'),
  name: z.string().min(2, 'نام قالب الزامی است'),
  description: z.string().optional(),
  estimatedMinutes: z.number().int().min(1).default(60),
  checklist: z.array(checklistItemSchema).default([]),
  requiredPpe: z.array(z.string()).default([]),
});

export type CreatePmTemplateInput = z.infer<typeof createPmTemplateSchema>;
export const updatePmTemplateSchema = createPmTemplateSchema.partial().omit({ plantId: true });
export type UpdatePmTemplateInput = z.infer<typeof updatePmTemplateSchema>;

export async function listPmTemplates(
  ctx: ServiceContext,
  params?: { plantId?: string },
): Promise<PmTemplate[]> {
  assertCan(ctx.ability, 'read', 'PmTemplate');
  const scopeCondition = accessibleWhere(ctx.ability, 'read', 'PmTemplate', pmTemplates);

  const conditions = [isNull(pmTemplates.deletedAt)];
  if (scopeCondition) conditions.push(scopeCondition);
  if (params?.plantId) conditions.push(eq(pmTemplates.plantId, params.plantId));

  return ctx.db
    .select()
    .from(pmTemplates)
    .where(and(...conditions))
    .orderBy(desc(pmTemplates.createdAt));
}

export async function getPmTemplateById(
  ctx: ServiceContext,
  id: string,
): Promise<PmTemplate | null> {
  assertCan(ctx.ability, 'read', 'PmTemplate');
  const scopeCondition = accessibleWhere(ctx.ability, 'read', 'PmTemplate', pmTemplates);

  const conditions = [eq(pmTemplates.id, id), isNull(pmTemplates.deletedAt)];
  if (scopeCondition) conditions.push(scopeCondition);

  const [template] = await ctx.db
    .select()
    .from(pmTemplates)
    .where(and(...conditions))
    .limit(1);

  return template ?? null;
}

export async function createPmTemplate(
  ctx: ServiceContext,
  input: CreatePmTemplateInput,
): Promise<PmTemplate> {
  const data = createPmTemplateSchema.parse(input);
  assertCan(ctx.ability, 'create', 'PmTemplate', { plantId: data.plantId });

  const [created] = await ctx.db
    .insert(pmTemplates)
    .values({
      plantId: data.plantId,
      name: data.name.trim(),
      description: data.description?.trim(),
      estimatedMinutes: data.estimatedMinutes,
      checklist: data.checklist as ChecklistItemDefinition[],
      requiredPpe: data.requiredPpe,
    })
    .returning();

  if (!created) {
    throw new Error('خطا در ایجاد قالب نت');
  }

  await writeAuditLog(ctx, {
    plantId: created.plantId,
    action: 'PM_TEMPLATE_CREATED',
    entity: 'PmTemplate',
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updatePmTemplate(
  ctx: ServiceContext,
  id: string,
  input: UpdatePmTemplateInput,
): Promise<PmTemplate> {
  const existing = await getPmTemplateById(ctx, id);
  if (!existing) {
    throw new Error('قالب نت یافت نشد');
  }

  assertCan(ctx.ability, 'update', 'PmTemplate', { plantId: existing.plantId });
  const data = updatePmTemplateSchema.parse(input);

  const updatePayload: Record<string, unknown> = {
    updatedAt: ctx.now(),
  };

  if (data.name !== undefined) updatePayload['name'] = data.name.trim();
  if (data.description !== undefined) updatePayload['description'] = data.description?.trim();
  if (data.estimatedMinutes !== undefined) updatePayload['estimatedMinutes'] = data.estimatedMinutes;
  if (data.checklist !== undefined) updatePayload['checklist'] = data.checklist;
  if (data.requiredPpe !== undefined) updatePayload['requiredPpe'] = data.requiredPpe;

  const [updated] = await ctx.db
    .update(pmTemplates)
    .set(updatePayload)
    .where(eq(pmTemplates.id, id))
    .returning();

  if (!updated) {
    throw new Error('خطا در ویرایش قالب نت');
  }

  await writeAuditLog(ctx, {
    plantId: updated.plantId,
    action: 'PM_TEMPLATE_UPDATED',
    entity: 'PmTemplate',
    entityId: updated.id,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function deletePmTemplate(
  ctx: ServiceContext,
  id: string,
): Promise<void> {
  const existing = await getPmTemplateById(ctx, id);
  if (!existing) {
    throw new Error('قالب نت یافت نشد');
  }

  assertCan(ctx.ability, 'delete', 'PmTemplate', { plantId: existing.plantId });

  await ctx.db
    .update(pmTemplates)
    .set({ deletedAt: ctx.now() })
    .where(eq(pmTemplates.id, id));

  await writeAuditLog(ctx, {
    plantId: existing.plantId,
    action: 'PM_TEMPLATE_DELETED',
    entity: 'PmTemplate',
    entityId: existing.id,
    before: existing,
  });
}
