import { desc, eq } from 'drizzle-orm';
import { assets, workOrders, type ChecklistItemDefinition } from '@cmms/db';
import type { ServiceContext } from '../context';
import { createAiProvider, type ChatMessage } from './provider';

export interface DiagnoseRequest {
  assetId: string;
  symptom: string;
  workOrderId?: string;
}

export interface DiagnoseResult {
  assetName: string;
  assetCode: string;
  symptom: string;
  analysisText: string;
  suggestedActionItems: string[];
  safetyWarnings: string[];
  requiresLoto: boolean;
  provider: string;
  simulated: boolean;
}

/**
 * Intelligent Assistant for industrial technicians and maintenance planners.
 * Queries equipment history and generates Persian troubleshooting advice with strict safety guardrails.
 */
export async function diagnoseEquipmentFailure(
  ctx: ServiceContext,
  params: DiagnoseRequest,
): Promise<DiagnoseResult> {
  // 1. Load asset details and history
  const [asset] = await ctx.db
    .select({
      id: assets.id,
      name: assets.name,
      code: assets.code,
      criticality: assets.criticality,
      requiresLoto: assets.requiresLoto,
      lotoProcedure: assets.lotoProcedure,
    })
    .from(assets)
    .where(eq(assets.id, params.assetId))
    .limit(1);

  if (!asset) {
    throw new Error(`تجهیز مورد نظر با شناسه ${params.assetId} یافت نشد.`);
  }

  // 2. Fetch past 5 work orders on this asset for context
  const pastOrders = await ctx.db
    .select({
      title: workOrders.title,
      type: workOrders.type,
      description: workOrders.description,
      completedAt: workOrders.completedAt,
    })
    .from(workOrders)
    .where(eq(workOrders.assetId, asset.id))
    .orderBy(desc(workOrders.createdAt))
    .limit(5);

  const historySummary =
    pastOrders.length > 0
      ? pastOrders
          .map((wo, idx) => `${idx + 1}. [${wo.type}] ${wo.title} (${wo.description ?? 'بدون توضیح'})`)
          .join('\n')
      : 'سابقه‌ای ثبت نشده است (دستگاه جدید)';

  // 3. Assemble Persian Prompt with domain context and safety rules
  const systemPrompt = `شما دستیار ارشد هوش مصنوعی نگهداری و تعمیرات کارخانه‌ای (CMMS) به زبان فارسی هستید.
وظیفه شما راهنمایی تخصصی تکنسین‌های مکانیک و برق سالن تولید در عیب‌یابی تجهیزات صنعتی است.
اصول غیرقابل تغییر:
۱. ایمنی اولویت مطلق است. هرگز اجازه ندهید مرحله LOTO یا ایزولاسیون انرژی نادیده گرفته شود.
۲. پیشنهادها باید عملی، مرحله‌به‌مرحله و منطبق با مهندسی نت (روغن‌کاری، ارتعاشات، حرارت‌سنجی، تلرانس‌ها) باشند.
۳. در انتهای پاسخ، تاکید کنید که تصمیم نهایی با تکنسین مجرب است.`;

  const userPrompt = `اطلاعات تجهیز:
نام: ${asset.name}
کد: ${asset.code}
درجه اهمیت: ${asset.criticality}
الزام قفل ایمنی LOTO: ${asset.requiresLoto ? 'بله (الزامی)' : 'خیر'}

سوابق اخیر دستورکارهای این تجهیز:
${historySummary}

شرح مشکل و نشانه خرابی اعلام شده توسط تکنسین:
"${params.symptom}"

لطفاً راهنمای گام‌به‌گام برای عیب‌یابی، اقدامات پیشنهادی و هشدارهای ایمنی ارائه دهید.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const ai = createAiProvider();
  const res = await ai.chat(messages, { temperature: 0.2, maxTokens: 800 });

  const safetyWarnings: string[] = [
    'تذکر: این پیشنهادات توسط دستیار هوشمند تولید شده و تصمیم اجرایی نهایی بر عهده سرپرست و تکنسین مجرب است.',
  ];

  if (asset.requiresLoto) {
    safetyWarnings.unshift(
      'الزام ایمنی LOTO: تجهیز دارای خطر انرژی باقیمانده است؛ ثبت شماره قفل فیزیکی قبل از باز کردن قطعات اجباری است.',
    );
  }

  // Extract concise bullet points from response for easy UI presentation
  const suggestedActionItems = res.text
    .split('\n')
    .filter((line) => line.trim().startsWith('•') || line.trim().startsWith('-') || /^\d+\./.test(line.trim()))
    .map((line) => line.replace(/^[•\-\d.]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    assetName: asset.name,
    assetCode: asset.code,
    symptom: params.symptom,
    analysisText: res.text,
    suggestedActionItems:
      suggestedActionItems.length > 0
        ? suggestedActionItems
        : ['بررسی وضعیت ظاهری، لرزش و دمای بیرونی', 'تطبیق کارکرد با چک‌لیست سرویس دوره‌ای'],
    safetyWarnings,
    requiresLoto: asset.requiresLoto,
    provider: res.provider,
    simulated: res.simulated,
  };
}
