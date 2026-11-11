'use server';

import { diagnoseEquipmentFailure, type DiagnoseResult } from '@cmms/core';
import { getServerContext } from '@/lib/server-context';

export interface DiagnoseActionState {
  success?: boolean;
  error?: string | null;
  result?: DiagnoseResult | null;
}

export async function diagnoseFailureAction(
  _prevState: DiagnoseActionState,
  formData: FormData,
): Promise<DiagnoseActionState> {
  try {
    const { ctx } = await getServerContext();
    const assetId = String(formData.get('assetId') ?? '').trim();
    const symptom = String(formData.get('symptom') ?? '').trim();
    const workOrderId = String(formData.get('workOrderId') ?? '').trim() || undefined;

    if (!assetId) {
      return { success: false, error: 'لطفاً تجهیز مورد نظر را انتخاب نمایید.' };
    }
    if (!symptom || symptom.length < 5) {
      return { success: false, error: 'لطفاً شرح علائم خرابی یا صدای غیرعادی را کامل‌تر وارد کنید.' };
    }

    const result = await diagnoseEquipmentFailure(ctx, {
      assetId,
      symptom,
      workOrderId,
    });

    return {
      success: true,
      result,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'خطای پیش‌بینی‌نشده در ارتباط با دستیار هوشمند',
      result: null,
    };
  }
}
