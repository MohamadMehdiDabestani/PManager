import { listPmTemplates, listAccessiblePlants } from '@cmms/core';
import {
  ClipboardCheck,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Hash,
  FileText,
  Camera,
} from 'lucide-react';
import { getServerContext } from '@/lib/server-context';
import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreatePmTemplateDialog } from './pm-template-dialog';

export const dynamic = 'force-dynamic';

const itemTypeLabels: Record<string, { label: string; icon: typeof CheckCircle2 }> = {
  BOOLEAN: { label: 'بله/خیر', icon: CheckCircle2 },
  NUMBER: { label: 'مقدار عددی', icon: Hash },
  TEXT: { label: 'متنی', icon: FileText },
  PHOTO: { label: 'تصویر مستند', icon: Camera },
};

export default async function PmTemplatesPage() {
  const { ctx, sessionUser } = await getServerContext();
  const [templates, plants] = await Promise.all([
    listPmTemplates(ctx),
    listAccessiblePlants(ctx),
  ]);

  const activePlantId = plants[0]?.id ?? '';

  return (
    <AppShell activeNav="pm-templates" user={sessionUser}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            قالب‌های چک‌لیست نت و ایمنی (PM Templates)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            استانداردسازی گام‌های بازرسی فنی، حدود مجاز کمّی (کالیبراسیون/فشار/دما) و تجهیزات حفاظت فردی (PPE)
          </p>
        </div>

        {activePlantId && <CreatePmTemplateDialog plantId={activePlantId} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {templates.map((tpl) => (
          <Card key={tpl.id} className="flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{tpl.name}</CardTitle>
                  {tpl.description && (
                    <CardDescription className="mt-1">{tpl.description}</CardDescription>
                  )}
                </div>
                <Badge variant="info" className="shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {tpl.estimatedMinutes.toLocaleString('fa-IR')} دقیقه
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* PPE Badges */}
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  الزامات حفاظت فردی (PPE):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tpl.requiredPpe.length > 0 ? (
                    tpl.requiredPpe.map((ppe) => (
                      <Badge key={ppe} variant="warning" className="text-[11px]">
                        {ppe}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">بدون الزام خاص</span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Checklist Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>آیتم‌های چک‌لیست استاندارد:</span>
                  <span>{tpl.checklist.length.toLocaleString('fa-IR')} گام</span>
                </div>

                <div className="space-y-1.5">
                  {tpl.checklist.map((item, idx) => {
                    const meta = itemTypeLabels[item.type] ?? itemTypeLabels['BOOLEAN']!;
                    const Icon = meta.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs border border-border/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-muted-foreground">
                            {(idx + 1).toLocaleString('fa-IR')}.
                          </span>
                          <span className="truncate font-medium">{item.label}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.type === 'NUMBER' && (item.minValue !== undefined || item.maxValue !== undefined) && (
                            <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">
                              {item.minValue ?? '-'} .. {item.maxValue ?? '-'} {item.unit ?? ''}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
