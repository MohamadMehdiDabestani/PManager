import {
  listNotifications,
  listUsers,
  listWorkOrders,
  formatJalaliDateTime,
} from '@cmms/core';
import {
  Bell,
  MessageSquare,
  Send,
  Mail,
  Radio,
  ShieldAlert,
  CheckCheck,
  Clock,
  Settings2,
  Bot,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  sendTestNotificationAction,
  triggerEscalationSimulationAction,
  updateUserChannelPrefsAction,
  markAllNotificationsReadAction,
} from '@/app/actions/phase4-actions';
import fa from '@/messages/fa.json';

export const dynamic = 'force-dynamic';

const channelMeta: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  }
> = {
  SMS: { label: 'پیامک (SMS)', variant: 'warning' },
  BALE: { label: 'ربات بله (Bale Bot)', variant: 'success' },
  EITAA: { label: 'ربات ایتا (Eitaa Bot)', variant: 'info' },
  EMAIL: { label: 'ایمیل (SMTP)', variant: 'secondary' },
  IN_APP: { label: 'داخل برنامه (SSE)', variant: 'default' },
  WEB_PUSH: { label: 'پوش وب (VAPID)', variant: 'outline' },
};

const statusMeta: Record<
  string,
  {
    label: string;
    variant: 'success' | 'warning' | 'destructive' | 'secondary';
  }
> = {
  SENT: { label: 'ارسال‌شده (SENT)', variant: 'success' },
  PENDING: { label: 'در صف ارسال (PENDING)', variant: 'warning' },
  FAILED: { label: 'ناموفق (FAILED)', variant: 'destructive' },
  CANCELLED: { label: 'لغوشده (بسته‌شدن دستورکار)', variant: 'secondary' },
};

export default async function NotificationsPage() {
  const { ctx, sessionUser } = await getServerContext();
  const [notifs, userList, workOrderList] = await Promise.all([
    listNotifications(ctx, { limit: 60 }),
    listUsers(ctx),
    listWorkOrders(ctx),
  ]);

  const unreadCount = notifs.filter((n) => !n.readAt).length;
  const baleSentCount = notifs.filter((n) => n.channel === 'BALE').length;
  const smsSentCount = notifs.filter((n) => n.channel === 'SMS').length;

  return (
    <AppShell activeNav="notifications" user={sessionUser}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-primary" />
            مرکز اعلان‌های بومی، ربات بله/ایتا و پلکان Escalation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            الگوی Outbox دیتابیس + زنجیره جایگزین خودکار (۱. پیامک ← ۲. ربات بله ← ۳. ربات ایتا ← ۴. ایمیل ← ۵. اعلان داخل برنامه SSE)
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">
              <CheckCheck className="h-4 w-4 me-2 text-emerald-400" />
              علامت‌گذاری همه به عنوان خوانده‌شده ({unreadCount.toLocaleString('fa-IR')})
            </Button>
          </form>
        )}
      </div>

      {/* Channel Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>۱. پیامک سازمانی</span>
              <MessageSquare className="h-4 w-4 text-amber-400" />
            </CardDescription>
            <CardTitle className="text-base">SMS Gateway</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
            <span>ارسال‌شده: {smsSentCount.toLocaleString('fa-IR')}</span>
            <Badge variant="warning">اولویت ۱</Badge>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-emerald-300">
              <span>۲. ربات پیام‌رسان بله</span>
              <Bot className="h-4 w-4 text-emerald-400" />
            </CardDescription>
            <CardTitle className="text-base text-emerald-400">Bale Bot API</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
            <span>ارسال‌شده: {baleSentCount.toLocaleString('fa-IR')}</span>
            <Badge variant="success">فعال (tapi.bale.ai)</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>۳. ربات پیام‌رسان ایتا</span>
              <Send className="h-4 w-4 text-sky-400" />
            </CardDescription>
            <CardTitle className="text-base">Eitaa Bot API</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
            <span>بومی ایران</span>
            <Badge variant="info">اولویت ۳</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>۴. ایمیل سازمانی</span>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-base">SMTP Internal</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
            <span>شبکه اینترانت</span>
            <Badge variant="secondary">اولویت ۴</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>۵. داخل برنامه</span>
              <Radio className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-base">SSE Live Stream</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
            <span>همیشه روشن</span>
            <Badge variant="default">منبع حقیقت</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="outbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="outbox">
            صندوق اعلان‌ها و لاگ ارسال ({notifs.length.toLocaleString('fa-IR')})
          </TabsTrigger>
          <TabsTrigger value="preferences">
            اتصال کاربران به ربات بله / ایتا و ساعات سکوت
          </TabsTrigger>
          <TabsTrigger value="simulator">
            تست ارسال بله/پیامک و شبیه‌ساز Escalation سه‌سطحی
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Outbox & Delivery History */}
        <TabsContent value="outbox">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">سابقه اعلان‌ها، یادآورها و هشدارهای Escalation</CardTitle>
              <CardDescription>
                تمام اعلان‌ها ابتدا در جدول `notifications` ثبت می‌شوند (Outbox) و سپس توسط ورکر BullMQ از طریق زنجیره کانال‌های کاربر ارسال می‌گردند.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>عنوان و متن پیام</TableHead>
                    <TableHead>گیرنده / نقش</TableHead>
                    <TableHead>کانال ارسال</TableHead>
                    <TableHead>اولویت</TableHead>
                    <TableHead>وضعیت تحویل</TableHead>
                    <TableHead>زمان ارسال (جلالی)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifs.map((n) => {
                    const ch = channelMeta[n.channel] ?? {
                      label: n.channel,
                      variant: 'outline' as const,
                    };
                    const st = statusMeta[n.status] ?? {
                      label: n.status,
                      variant: 'secondary' as const,
                    };
                    const roleFa =
                      fa.roles[n.recipientRole as keyof typeof fa.roles] ?? n.recipientRole;

                    return (
                      <TableRow key={n.id}>
                        <TableCell>
                          <div className="font-semibold text-sm">{n.title}</div>
                          <div className="text-xs text-muted-foreground max-w-md">
                            {n.body}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs">{n.recipientName}</div>
                          <div className="text-[11px] text-muted-foreground">{roleFa}</div>
                        </TableCell>

                        <TableCell>
                          <Badge variant={ch.variant}>{ch.label}</Badge>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              n.priority === 'URGENT'
                                ? 'destructive'
                                : n.priority === 'HIGH'
                                  ? 'warning'
                                  : 'info'
                            }
                          >
                            {n.priority}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                          {n.error && (
                            <div className="text-[11px] text-red-400 mt-1">{n.error}</div>
                          )}
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          {formatJalaliDateTime(n.sentAt ?? n.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: User Channel Preferences (Bale Chat ID, Eitaa Chat ID, Phone, Quiet Hours) */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                تنظیمات کانال‌های ارتباطی پرسنل (شماره موبایل، شناسه ربات بله، ایتا و ساعات سکوت)
              </CardTitle>
              <CardDescription>
                در ساعات سکوت (پیش‌فرض ۲۲:۰۰ تا ۰۶:۰۰ به وقت تهران)، اعلان‌های عادی به تعویق می‌افتند؛ اما هشدارهای اضطراری (`URGENT` / Escalation سطح ۳) بدون تاخیر ارسال می‌شوند.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userList.map((u) => {
                const roleFa = fa.roles[u.role as keyof typeof fa.roles] ?? u.role;
                const chainStr = (
                  u.channelPreference ?? ['SMS', 'BALE', 'EITAA', 'EMAIL']
                ).join(',');

                return (
                  <form
                    key={u.id}
                    action={updateUserChannelPrefsAction}
                    className="rounded-xl border border-border bg-muted/25 p-4 space-y-3"
                  >
                    <input type="hidden" name="userId" value={u.id} />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{u.fullName}</span>
                        <Badge variant="info">{roleFa}</Badge>
                      </div>
                      <Button type="submit" size="sm" variant="secondary">
                        ذخیره تنظیمات کانال کاربر
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">شماره موبایل (SMS)</Label>
                        <Input
                          name="phone"
                          defaultValue={u.phone ?? ''}
                          dir="ltr"
                          placeholder="0912..."
                          className="h-9 font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-emerald-400">
                          شناسه چت ربات بله (Bale Chat ID)
                        </Label>
                        <Input
                          name="baleChatId"
                          defaultValue={u.baleChatId ?? ''}
                          dir="ltr"
                          placeholder="bale_chat_id"
                          className="h-9 font-mono text-xs border-emerald-500/40"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-sky-400">
                          شناسه چت ربات ایتا (Eitaa Chat ID)
                        </Label>
                        <Input
                          name="eitaaChatId"
                          defaultValue={u.eitaaChatId ?? ''}
                          dir="ltr"
                          placeholder="eitaa_chat_id"
                          className="h-9 font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">ترتیب اولویت زنجیره (Fallback)</Label>
                        <select
                          name="chainOrder"
                          defaultValue={chainStr}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="SMS,BALE,EITAA,EMAIL">
                            ۱. پیامک ← ۲. بله ← ۳. ایتا ← ۴. ایمیل
                          </option>
                          <option value="BALE,SMS,EITAA,EMAIL">
                            ۱. ربات بله ← ۲. پیامک ← ۳. ایتا ← ۴. ایمیل
                          </option>
                          <option value="EITAA,BALE,SMS,EMAIL">
                            ۱. ربات ایتا ← ۲. بله ← ۳. پیامک ← ۴. ایمیل
                          </option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            شروع سکوت
                          </Label>
                          <Input
                            name="quietHoursStart"
                            defaultValue={u.quietHoursStart ?? '22:00'}
                            dir="ltr"
                            className="h-9 font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">پایان سکوت</Label>
                          <Input
                            name="quietHoursEnd"
                            defaultValue={u.quietHoursEnd ?? '06:00'}
                            dir="ltr"
                            className="h-9 font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Test Fallback & 3-Level Escalation Simulator */}
        <TabsContent value="simulator">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Direct Test Notification */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-5 w-5 text-emerald-400" />
                  تست ارسال اعلان از طریق ربات بله / پیامک / ایتا
                </CardTitle>
                <CardDescription>
                  اگر کانال انتخابی برای کاربر در دسترس نباشد، سیستم به صورت خودکار به کانال بعدی در زنجیره Fallback سوئیچ می‌کند.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={sendTestNotificationAction} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>انتخاب گیرنده</Label>
                      <select
                        name="userId"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {userList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({u.username})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>کانال ترجیحی شروع</Label>
                      <select
                        name="preferredChannel"
                        defaultValue="BALE"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="BALE">ربات پیام‌رسان بله (Bale Bot)</option>
                        <option value="SMS">پیامک سازمانی (SMS)</option>
                        <option value="EITAA">ربات پیام‌رسان ایتا (Eitaa Bot)</option>
                        <option value="EMAIL">ایمیل سازمانی (SMTP)</option>
                        <option value="IN_APP">داخل برنامه (SSE)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>عنوان پیام</Label>
                    <Input
                      name="title"
                      defaultValue="هشدار سرویس پیشگیرانه (ارسال از ربات بله)"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>متن پیام</Label>
                    <Input
                      name="body"
                      defaultValue="دستورکار سرویس ماهانه پرس هیدرولیک ۱۰۰۰ تن آماده اجرا است. لطفاً گیت LOTO را بررسی نمایید."
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <Send className="h-4 w-4 me-2" />
                    ثبت در Outbox و ارسال فوری
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* 3-Level Escalation Simulator */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                  شبیه‌ساز پلکان هشدار سه‌سطحی (3-Level Escalation)
                </CardTitle>
                <CardDescription>
                  در صورت عدم انجام یا عدم تایید دستورکار عقب‌افتاده، هشدارها به ترتیب به سرپرست شیفت (L1)، مدیر نت (L2) و مدیر کارخانه (L3 - عبوری از ساعات سکوت) ارسال می‌شوند.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={triggerEscalationSimulationAction} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>انتخاب دستورکار دارای تاخیر / فعال</Label>
                    <select
                      name="workOrderId"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {workOrderList
                        .filter((w) => w.status !== 'DONE')
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.title} ({w.assetCode} - {w.status})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>سطح Escalation</Label>
                    <select
                      name="level"
                      defaultValue="1"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="1">
                        سطح ۱ (L1): هشدار به سرپرست شیفت (SUPERVISOR)
                      </option>
                      <option value="2">
                        سطح ۲ (L2 - پس از ۴ ساعت): هشدار به مدیر نت (MAINTENANCE_MANAGER)
                      </option>
                      <option value="3">
                        سطح ۳ بحرانی (L3 - پس از ۸ ساعت): هشدار فوری به مدیر کارخانه (PLANT_HEAD)
                      </option>
                    </select>
                  </div>

                  <Button type="submit" variant="destructive" className="w-full">
                    <ShieldAlert className="h-4 w-4 me-2" />
                    اجرای آنی سطح Escalation انتخابی
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
