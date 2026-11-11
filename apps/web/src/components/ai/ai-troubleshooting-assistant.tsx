'use client';

import { useActionState, useState } from 'react';
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { diagnoseFailureAction, type DiagnoseActionState } from '@/app/actions/phase5-actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AiAssistantProps {
  assets: Array<{
    id: string;
    name: string;
    code: string;
    criticality: string;
    requiresLoto: boolean;
  }>;
  defaultAssetId?: string;
  defaultWorkOrderId?: string;
}

export function AiTroubleshootingAssistant({
  assets,
  defaultAssetId,
  defaultWorkOrderId,
}: AiAssistantProps) {
  const [selectedAssetId, setSelectedAssetId] = useState(defaultAssetId ?? assets[0]?.id ?? '');
  const [symptomText, setSymptomText] = useState('');
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  const [state, formAction, isPending] = useActionState<DiagnoseActionState, FormData>(
    diagnoseFailureAction,
    { success: false, result: null, error: null },
  );

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const sampleSymptoms = [
    'صدای زوزه و لرزش شدید در دور بالا',
    'افت فشار ناگهانی در مدار و داغ شدن پمپ',
    'نشتی روغن از کاسه‌نمد شفت و افزایش دما',
    'بوی سوختگی سیم‌پیچ و افت ولتاژ فاز',
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                دستیار هوشمند عیب‌یابی ماشین‌آلات (AI Maintenance Assistant)
                <Sparkles className="h-4 w-4 text-amber-400" />
              </CardTitle>
              <CardDescription className="text-xs">
                بررسی سوابق خرابی تجهیز، کدهای خطای گذشته و ارائه چک‌لیست عیب‌یابی در خط تولید
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary text-[11px]">
            نظارت انسانی (Human-in-the-Loop)
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-3">
          {defaultWorkOrderId && (
            <input type="hidden" name="workOrderId" value={defaultWorkOrderId} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                انتخاب دستگاه / تجهیز
              </Label>
              <select
                name="assetId"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                شرح علائم خرابی، صدا یا لرزش غیرعادی
              </Label>
              <Input
                name="symptom"
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                placeholder="مثال: صدای کوبش در پمپ هیدرولیک و افزایش دمای یاتاقان تا ۷۵ درجه..."
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Quick Preset Symptom Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>علائم پرتکرار:</span>
            {sampleSymptoms.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSymptomText(s)}
                className="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] text-foreground hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              {selectedAsset?.requiresLoto && (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  این تجهیز نیازمند الزامی قفل ایمنی LOTO است.
                </span>
              )}
            </div>

            <Button type="submit" size="sm" disabled={isPending} className="h-9 px-4">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  در حال تحلیل سوابق و عیب‌یابی...
                </>
              ) : (
                <>
                  <BrainCircuit className="h-4 w-4 me-2" />
                  تحلیل هوشمند و عیب‌یابی
                </>
              )}
            </Button>
          </div>
        </form>

        {state.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {state.error}
          </div>
        )}

        {state.result && (
          <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3.5 mt-3 animate-in fade-in-50">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">
                  {state.result.assetName} ({state.result.assetCode})
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ارائه‌دهنده: {state.result.provider} {state.result.simulated && '(شبیه‌سازی آفلاین)'}
                </span>
              </div>
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs">
                پیشنهاد کمکی - تایید با تکنسین
              </Badge>
            </div>

            {/* Mandatory Safety Warnings */}
            {state.result.safetyWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-1">
                {state.result.safetyWarnings.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-300">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommended Action Steps */}
            <div>
              <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                اقدامات اولویت‌دار پیشنهادی:
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {state.result.suggestedActionItems.map((item, idx) => (
                  <li
                    key={idx}
                    className="rounded-md border border-border bg-muted/30 p-2 text-foreground"
                  >
                    <span className="font-bold text-primary me-1">{idx + 1}.</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Expandable Full Analysis */}
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                {showFullAnalysis ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 me-1" />
                    بستن تحلیل فنی کامل
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 me-1" />
                    مشاهده تحلیل فنی کامل و استانداردهای بازرسی
                  </>
                )}
              </Button>

              {showFullAnalysis && (
                <div className="mt-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-foreground whitespace-pre-line font-sans">
                  {state.result.analysisText}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
