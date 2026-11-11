import Link from 'next/link';
import {
  Download,
  FileText,
  Filter,
  History,
  Info,
  Layers,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  formatJalaliDateTime,
  listAuditLogs,
  toPersianDigits,
  type AuditLogEntry,
} from '@cmms/core';
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
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const dynamic = 'force-dynamic';

interface AuditLogsPageProps {
  searchParams: Promise<{
    entity?: string;
    action?: string;
  }>;
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const { ctx, sessionUser } = await getServerContext();
  const params = await searchParams;

  let auditEntries: AuditLogEntry[] = [];
  let errorMsg: string | null = null;

  try {
    const res = await listAuditLogs(ctx, {
      entity: params.entity || undefined,
      action: params.action || undefined,
      limit: 100,
    });
    auditEntries = res.logs;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'دسترسی مشاهده لاگ‌های ممیزی مجاز نیست.';
  }

  const exportUrl = `/api/v1/audit-logs/export${
    params.entity ? `?entity=${encodeURIComponent(params.entity)}` : ''
  }`;

  return (
    <AppShell activeNav="audit-logs" user={sessionUser}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                دفترچه ممیزی ایزو و ردیابی تغییرات (ISO Audit Trail)
              </h2>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                ISO 55001 / ISO 9001
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              ثبت غیرقابل تغییر و زمان‌بندی‌شده تمام تراکنش‌های حیاتی، مجوزهای LOTO و تغییرات پیکربندی
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={exportUrl} target="_blank">
                <Download className="h-4 w-4 me-2 text-primary" />
                دانلود گزارش ممیزی (CSV استاندارد)
              </Link>
            </Button>
          </div>
        </div>

        {errorMsg ? (
          <Card className="border-red-500/30 bg-red-500/10">
            <CardHeader className="flex flex-row items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-red-400" />
              <div>
                <CardTitle className="text-base text-red-400">عدم دسترسی به ممیزی</CardTitle>
                <CardDescription className="text-xs text-red-300/80">
                  {errorMsg}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        ) : (
          <>
            {/* Quick Filter Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> فیلتر سریع موجودیت:
              </span>
              <Button asChild variant={!params.entity ? 'default' : 'outline'} size="sm" className="h-7 text-xs">
                <Link href="/audit-logs">همه رویدادها</Link>
              </Button>
              <Button asChild variant={params.entity === 'WorkOrder' ? 'default' : 'outline'} size="sm" className="h-7 text-xs">
                <Link href="/audit-logs?entity=WorkOrder">دستورکارها (WorkOrder)</Link>
              </Button>
              <Button asChild variant={params.entity === 'Asset' ? 'default' : 'outline'} size="sm" className="h-7 text-xs">
                <Link href="/audit-logs?entity=Asset">تجهیزات (Asset)</Link>
              </Button>
              <Button asChild variant={params.entity === 'PmSchedule' ? 'default' : 'outline'} size="sm" className="h-7 text-xs">
                <Link href="/audit-logs?entity=PmSchedule">برنامه‌های نت (PMSchedule)</Link>
              </Button>
              <Button asChild variant={params.entity === 'Part' ? 'default' : 'outline'} size="sm" className="h-7 text-xs">
                <Link href="/audit-logs?entity=Part">انبار قطعات (Part)</Link>
              </Button>
            </div>

            {/* Audit Log Table */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">
                      ثبت وقایع ممیزی ({toPersianDigits(auditEntries.length)} رویداد اخیر)
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    Append-Only Immutable
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  لاگ‌ها به صورت سیستمی و غیرقابل حذف نگهداری شده و تغییر وضعیت قبل/بعد را ثبت می‌نمایند.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    رویدادی با فیلتر انتخابی در سیستم ثبت نشده است.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>زمان (جلالی / تهران)</TableHead>
                        <TableHead>عامل تغییر</TableHead>
                        <TableHead>عملیات انجام‌شده</TableHead>
                        <TableHead>موجودیت و شناسه</TableHead>
                        <TableHead>جزئیات قبل / بعد</TableHead>
                        <TableHead>آدرس IP / دستگاه</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditEntries.map((log) => {
                        const hasChanges = Boolean(log.before || log.after);
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {formatJalaliDateTime(log.at)}
                            </TableCell>

                            <TableCell>
                              <div className="font-medium text-xs flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{log.actorName}</span>
                              </div>
                              {log.actorUsername && (
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  @{log.actorUsername}
                                </div>
                              )}
                            </TableCell>

                            <TableCell>
                              <Badge variant="info" className="text-xs">
                                {log.actionLabelFa}
                              </Badge>
                              {log.reason && (
                                <div className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                                  علت: {log.reason}
                                </div>
                              )}
                            </TableCell>

                            <TableCell>
                              <div className="font-medium text-xs flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5 text-primary" />
                                <span>{log.entity}</span>
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">
                                {log.entityId}
                              </div>
                            </TableCell>

                            <TableCell className="text-xs max-w-xs">
                              {hasChanges ? (
                                <details className="text-[11px] bg-muted/40 p-1.5 rounded cursor-pointer">
                                  <summary className="text-primary hover:underline">
                                    مشاهده تغییرات داده
                                  </summary>
                                  <div className="mt-2 space-y-1.5 font-mono text-[10px] text-muted-foreground overflow-x-auto max-h-36">
                                    {log.before && (
                                      <div>
                                        <span className="text-red-400 font-bold">قبل: </span>
                                        <pre>{JSON.stringify(log.before, null, 2)}</pre>
                                      </div>
                                    )}
                                    {log.after && (
                                      <div>
                                        <span className="text-emerald-400 font-bold">بعد: </span>
                                        <pre>{JSON.stringify(log.after, null, 2)}</pre>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">-</span>
                              )}
                            </TableCell>

                            <TableCell className="font-mono text-[11px] text-muted-foreground">
                              {log.ip || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
