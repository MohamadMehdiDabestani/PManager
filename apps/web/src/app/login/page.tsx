import { KeyRound, Lock, ShieldAlert, Smartphone, Wrench } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loginAction } from '@/app/actions/phase1-actions';

export default function LoginPage() {
  async function handleFormLogin(formData: FormData) {
    'use server';
    await loginAction(formData);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30">
            <Wrench className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">سامانه مدیریت نت پارس صنعت</h1>
          <p className="text-sm text-muted-foreground">
            احراز هویت امن شبکه داخلی کارخانه (Auth.js + CASL RBAC)
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ورود به پنل کارخانه</CardTitle>
            <CardDescription>
              مدیران با رمز عبور و تکنسین‌های سالن تولید با پین ۴ رقمی تبلت وارد شوند.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">
                  <Lock className="h-4 w-4 me-1.5" />
                  رمز عبور سازمانی
                </TabsTrigger>
                <TabsTrigger value="pin">
                  <Smartphone className="h-4 w-4 me-1.5" />
                  ورود سریع با PIN
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password">
                <form action={handleFormLogin} className="space-y-4 pt-3">
                  <input type="hidden" name="mode" value="PASSWORD" />
                  <div className="space-y-2">
                    <Label htmlFor="username-pass">نام کاربری</Label>
                    <Input
                      id="username-pass"
                      name="username"
                      placeholder="مثلاً: manager یا admin"
                      defaultValue="manager"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret-pass">رمز عبور</Label>
                    <Input
                      id="secret-pass"
                      name="secret"
                      type="password"
                      placeholder="••••••"
                      defaultValue="123456"
                      dir="ltr"
                      required
                    />
                  </div>
                  <Button type="submit" size="industrial" className="w-full">
                    <KeyRound className="h-5 w-5 me-2" />
                    ورود به سامانه نت
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="pin">
                <form action={handleFormLogin} className="space-y-4 pt-3">
                  <input type="hidden" name="mode" value="PIN" />
                  <div className="space-y-2">
                    <Label htmlFor="username-pin">کد پرسنلی / نام کاربری تکنسین</Label>
                    <Input
                      id="username-pin"
                      name="username"
                      placeholder="مثلاً: tech1"
                      defaultValue="tech1"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret-pin">پین ۴ رقمی تبلت سالن تولید</Label>
                    <Input
                      id="secret-pin"
                      name="secret"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="۱۲۳۴"
                      defaultValue="1234"
                      dir="ltr"
                      className="text-center text-lg tracking-widest font-bold"
                      required
                    />
                  </div>
                  <Button type="submit" size="industrial" className="w-full">
                    <Smartphone className="h-5 w-5 me-2" />
                    ورود سریع تکنسین (مخصوص دستکش)
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2 border-t pt-4">
            <div className="text-xs text-muted-foreground">حساب‌های پیش‌فرض Seed (رمز: 123456):</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">admin (PIN: 1111)</Badge>
              <Badge variant="outline">manager (PIN: 2222)</Badge>
              <Badge variant="outline">planner (PIN: 3333)</Badge>
              <Badge variant="outline">tech1 (PIN: 1234)</Badge>
            </div>
          </CardFooter>
        </Card>

        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" />
          <div>
            <AlertTitle>اجرا روی شبکه داخلی (Intranet)</AlertTitle>
            <AlertDescription>
              تمامی نشست‌ها با کوکی امن `httpOnly` و مجوزهای سطح سایت (`plantId`) در CASL محافظت می‌شوند.
            </AlertDescription>
          </div>
        </Alert>
      </div>
    </div>
  );
}
