import { Building2, MapPin, Plus, Users } from 'lucide-react';
import {
  listAccessiblePlants,
  listLocations,
  listUsers,
  toPersianDigits,
} from '@cmms/core';
import fa from '@/messages/fa.json';
import { getServerContext } from '@/lib/server-context';
import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  createLocationAction,
  createUserAction,
} from '@/app/actions/phase1-actions';

export const dynamic = 'force-dynamic';

export default async function OrganizationPage() {
  const { ctx, sessionUser } = await getServerContext();

  let plantList: Awaited<ReturnType<typeof listAccessiblePlants>> = [];
  let locationList: Awaited<ReturnType<typeof listLocations>> = [];
  let userList: Awaited<ReturnType<typeof listUsers>> = [];

  try {
    [plantList, locationList, userList] = await Promise.all([
      listAccessiblePlants(ctx),
      listLocations(ctx),
      listUsers(ctx),
    ]);
  } catch {
    // Handled gracefully if DB not yet seeded
  }

  const defaultPlantId = plantList[0]?.id ?? '';

  return (
    <AppShell activeNav="organization" user={sessionUser}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            مدیریت سازمان، سالن‌های تولید و پرسنل نت
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            مدیریت ساختار کارخانه، خطوط تولید، نقش‌های دسترسی CASL و اولویت کانال‌های اعلان
          </p>
        </div>
      </div>

      <Tabs defaultValue="locations" className="w-full">
        <TabsList>
          <TabsTrigger value="locations">
            <MapPin className="h-4 w-4 me-1.5" />
            سایت‌ها و سالن‌های تولید ({toPersianDigits(locationList.length)})
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 me-1.5" />
            پرسنل و نقش‌های دسترسی ({toPersianDigits(userList.length)})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>سالن‌ها و خطوط تولید</CardTitle>
                <CardDescription>
                  کارخانه فعال: {plantList[0]?.name ?? 'ثبت‌نشده'} (منطقه زمانی:{' '}
                  <bdi>{plantList[0]?.timezone ?? 'Asia/Tehran'}</bdi>)
                </CardDescription>
              </div>
              {defaultPlantId && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 me-1.5" />
                      افزودن سالن / خط جدید
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>ثبت سالن یا خط تولید جدید</DialogTitle>
                      <DialogDescription>
                        کد و عنوان فارسی سالن را برای دسته‌بندی تجهیزات وارد نمایید.
                      </DialogDescription>
                    </DialogHeader>
                    <form action={createLocationAction} className="space-y-4 pt-2">
                      <input type="hidden" name="plantId" value={defaultPlantId} />
                      <div className="space-y-2">
                        <Label htmlFor="loc-code">کد سالن / خط</Label>
                        <Input
                          id="loc-code"
                          name="code"
                          placeholder="مثلاً: HALL-WELD-02"
                          dir="ltr"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loc-name">نام سالن / خط تولید</Label>
                        <Input
                          id="loc-name"
                          name="name"
                          placeholder="مثلاً: سالن جوشکاری بدنه ۲"
                          required
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit">ثبت سالن</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>کد سالن</TableHead>
                    <TableHead>نام سالن / خط تولید</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationList.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-mono font-bold">
                        <bdi>{loc.code}</bdi>
                      </TableCell>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(
                          loc.createdAt,
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>کاربران، تکنسین‌ها و مدیران نت</CardTitle>
                <CardDescription>
                  دسترسی هر کاربر بر اساس نقش و سایت (`plantId`) توسط CASL کنترل می‌شود.
                </CardDescription>
              </div>
              {defaultPlantId && ctx.ability.can('create', 'User') && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 me-1.5" />
                      تعریف کاربر جدید
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>تعریف کاربر / تکنسین جدید</DialogTitle>
                      <DialogDescription>
                        اطلاعات هویتی، نقش CASL و پین ۴ رقمی ورود سریع تبلت را مشخص کنید.
                      </DialogDescription>
                    </DialogHeader>
                    <form action={createUserAction} className="space-y-4 pt-2">
                      <input type="hidden" name="plantId" value={defaultPlantId} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="u-username">نام کاربری</Label>
                          <Input
                            id="u-username"
                            name="username"
                            placeholder="مثلاً: tech2"
                            dir="ltr"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="u-fullname">نام و نام خانوادگی</Label>
                          <Input
                            id="u-fullname"
                            name="fullName"
                            placeholder="مثلاً: مهدی نوری"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="u-phone">شماره موبایل (پیامک/ایتا)</Label>
                          <Input
                            id="u-phone"
                            name="phone"
                            placeholder="0912..."
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="u-role">نقش سازمانی</Label>
                          <select
                            id="u-role"
                            name="role"
                            defaultValue="TECHNICIAN"
                            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            {Object.entries(fa.roles).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="u-pass">رمز عبور اولیه</Label>
                          <Input
                            id="u-pass"
                            name="password"
                            type="password"
                            defaultValue="123456"
                            dir="ltr"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="u-pin">پین ۴ رقمی تبلت</Label>
                          <Input
                            id="u-pin"
                            name="pin"
                            defaultValue="1234"
                            maxLength={6}
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit">ایجاد کاربر</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام کاربری</TableHead>
                    <TableHead>نام و نام خانوادگی</TableHead>
                    <TableHead>نقش سازمانی (CASL)</TableHead>
                    <TableHead>شماره همراه</TableHead>
                    <TableHead>زنجیره اولویت اعلان</TableHead>
                    <TableHead>وضعیت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userList.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono font-semibold">
                        <bdi>{u.username}</bdi>
                      </TableCell>
                      <TableCell className="font-medium">{u.fullName}</TableCell>
                      <TableCell>
                        <Badge variant="info">{fa.roles[u.role] ?? u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <bdi>{u.phone ? toPersianDigits(u.phone) : '-'}</bdi>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(u.channelPreference ?? ['SMS', 'EITAA', 'EMAIL']).map((ch) => (
                            <Badge key={ch} variant="outline">
                              {ch}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.active ? 'success' : 'secondary'}>
                          {u.active ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
