import Link from 'next/link';
import {
  Activity,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  KeyRound,
  LogOut,
  QrCode,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import fa from '@/messages/fa.json';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { logoutAction } from '@/app/actions/phase1-actions';
import type { Role } from '@cmms/db';

interface AppShellProps {
  children: React.ReactNode;
  activeNav?:
    | 'dashboard'
    | 'assets'
    | 'pm-templates'
    | 'pm-schedules'
    | 'work-orders'
    | 'organization'
    | 'scan';
  user?: {
    fullName: string;
    username: string;
    role: Role;
  } | null;
}

export function AppShell({ children, activeNav = 'dashboard', user }: AppShellProps) {
  const navItems = [
    { key: 'dashboard', href: '/', label: fa.nav.dashboard, icon: Activity },
    { key: 'work-orders', href: '/work-orders', label: fa.nav.workOrders, icon: ClipboardList },
    { key: 'pm-schedules', href: '/pm-schedules', label: fa.nav.pmSchedules, icon: CalendarClock },
    { key: 'pm-templates', href: '/pm-templates', label: fa.nav.pmTemplates, icon: ClipboardCheck },
    { key: 'assets', href: '/assets', label: fa.nav.assets, icon: Cpu },
    { key: 'organization', href: '/organization', label: fa.nav.organization, icon: Building2 },
    { key: 'scan', href: '/m/scan', label: 'اسکنر سریع QR (تکنسین)', icon: QrCode },
  ] as const;

  const roleLabel = user ? (fa.roles[user.role] ?? user.role) : 'حالت پیش‌نمایش مدیر نت';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      {/* Industrial RTL Sidebar */}
      <aside className="w-full lg:w-72 border-b lg:border-b-0 lg:border-e border-border bg-card/75 p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-base text-foreground">پارس صنعت | CMMS</h1>
              <p className="text-xs text-muted-foreground">سامانه نت پیشگیرانه کارخانه</p>
            </div>
          </div>

          <Separator className="my-5" />

          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <Button
                  key={item.key}
                  asChild
                  variant={isActive ? 'default' : 'ghost'}
                  className="justify-start h-11 text-sm font-medium"
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4 me-2" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 pt-4 border-t border-border space-y-3">
          <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                {user ? user.fullName : 'کاربر مهمان (دمو)'}
              </span>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>نقش سازمانی:</span>
              <Badge variant="info">{roleLabel}</Badge>
            </div>
          </div>

          {user ? (
            <form action={logoutAction}>
              <Button variant="outline" size="sm" className="w-full justify-center" type="submit">
                <LogOut className="h-4 w-4 me-2" />
                {fa.nav.logout}
              </Button>
            </form>
          ) : (
            <Button asChild variant="secondary" size="sm" className="w-full justify-center">
              <Link href="/login">
                <KeyRound className="h-4 w-4 me-2" />
                {fa.nav.login} (Auth.js)
              </Link>
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-5 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
