# نقشه راه و وضعیت پیشرفت پروژه (ROADMAP & STATUS)

> **وضعیت فعلی:** ✅ **فاز ۰، فاز ۱ و فاز ۲ تکمیل شدند** | 🎯 **فاز بعدی: فاز ۳ (چرخه دستورکار Work Order، ایمنی LOTO و تجربه موبایل/آفلاین تکنسین PWA)**

این فایل منبع حقیقت (Source of Truth) برای پیگیری پیشرفت فازهای پروژه **PManager CMMS** بین سشن‌ها و چت‌های مختلف است. در پایان هر فاز یا تسک بزرگ، وضعیت این فایل باید به‌روزرسانی شود.

---

## تصمیمات معماری تثبیت‌شده (Locked Decisions)
- **سیستم طراحی رابط کاربری:** استفاده الزامی از کامپوننت‌های **shadcn/ui** (`Card`, `Button`, `Badge`, `Table`, `Dialog`, `Tabs`, `Input`, `Label`, `Alert`, `Separator`) در `apps/web/src/components/ui/` با پشتیبانی کامل از RTL فارسی و دکمه‌های صنعتی دستکش‌پذیر (`size="industrial"` - ارتفاع ۵۶px).
- **ORM:** استفاده انحصاری از **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`) در `packages/db` (عدم استفاده از Prisma).
- **کنترل دسترسی (Authorization):** استفاده از **CASL** (`@casl/ability`) در `packages/core/auth` به همراه `accessibleWhere` برای تولید شرط‌های SQL در Drizzle.
- **احراز هویت (Authentication):** **Auth.js (NextAuth v5)** با استراتژی محلی (نام کاربری + رمز عبور سازمانی و ورود سریع تبلت با PIN چهاررقمی برای تکنسین‌های سالن تولید).
- **انبار قطعات (Spare Parts):** سطح پایه (تعریف قطعه، موجودی فعلی، حداقل موجودی و ثبت مصرف روی دستورکار).
- **زنجیره اولویت اعلان‌ها:** `IN_APP` (همیشه فعال) + Fallback به ترتیب: **۱. پیامک (SMS) ← ۲. ایتا (Eitaa) ← ۳. ایمیل (Email SMTP)**.
- **زیرساخت:** PostgreSQL محلی + Redis روی سرور Docker ریموت (با تنظیمات `appendonly yes` و `noeviction`).

---

## وضعیت فازهای اجرایی

### ✅ فاز ۰: ستاپ زیرساخت، مهاجرت به Drizzle و اسکلت Monorepo (تکمیل‌شده)
- [x] مهاجرت کامل مستندات، قوانین (`.agent/rules`)، مهارت‌ها (`.agent/skills`) و قالب‌ها به Drizzle ORM.
- [x] راه‌اندازی Monorepo با `pnpm` و `Turborepo` و TypeScript strict.
- [x] پیاده‌سازی اسکیمای کامل اولیه در `packages/db` (۱۵ جدول اصلی) و تولید مهاجرت اولیه (`drizzle/0000_third_ozymandias.sql`).
- [x] پیاده‌سازی هسته `packages/core`: CASL + `accessibleWhere`، نرمال‌ساز فارسی/اعداد، محاسبه سررسید نت (`computeNextDue`) و سرویس ممیزی (`writeAuditLog`).
- [x] راه‌اندازی `packages/queue` و `apps/worker` با BullMQ و زمان‌بندی‌های منطقه زمانی `Asia/Tehran`.
- [x] راه‌اندازی اسکلت `apps/web` (Next.js App Router، فارسی و RTL) و اندپوینت `/api/v1/health`.

---

### ✅ فاز ۱: سیستم طراحی shadcn/ui، احراز هویت (Auth.js)، سازمان/کاربران و درخت تجهیزات (Assets) (تکمیل‌شده)
- [x] راه‌اندازی کامل سیستم طراحی **shadcn/ui** در `apps/web` (`components.json` و کامپوننت‌های `button`, `card`, `badge`, `input`, `label`, `table`, `dialog`, `tabs`, `separator`, `alert`).
- [x] اسکریپت Seed دیتابیس (`pnpm db:seed`) در `packages/db/src/seed.ts` با داده‌های واقعی کارخانه به زبان فارسی (کارخانه پارس صنعت، سالن‌ها، ۵ کاربر در نقش‌های مختلف با رمز و PIN، تجهیزات صنعتی همراه با LOTO و کنتور ساعت‌شمار).
- [x] راه‌اندازی کامل **Auth.js (NextAuth v5)** در `apps/web/src/auth.ts` و صفحه ورود صنعتی (`/login`) با دو تب رمز عبور و ورود سریع تکنسین (PIN).
- [x] سرویس‌ها و صفحات مدیریت کارخانه (`Plant`)، محل استقرار (`Location`) و کاربران (`User`) در `/organization`.
- [x] سرویس‌ها، REST API (`/api/v1/assets` و `/api/v1/assets/meter`) و رابط کاربری درخت تجهیزات (`/assets` و `/assets/[id]`)، تعریف مراحل **LOTO** روی دستگاه، تولید توکن امن **QR Code**، صفحه اسکنر موبایل تکنسین (`/m/scan`) و ثبت کارکرد (`AssetMeterReading`).

---

### ✅ فاز ۲: موتور زمان‌بندی نت پیشگیرانه (PM Scheduling Engine) و ورکرها (تکمیل‌شده)
- [x] مدیریت قالب‌های چک‌لیست نت (`PMTemplate`) و PPE مورد نیاز (`/pm-templates` و سازنده تعاملی چک‌لیست).
- [x] مدیریت برنامه‌های نت (`PMSchedule` — تقویمی، کارکردی، ترکیبی، ثابت `FIXED` و شناور `FLOATING`) و تقویم کاری کارخانه (`/pm-schedules`).
- [x] تکمیل پردازشگرهای BullMQ در `apps/worker`: تولید خودکار و بدون تکرار دستورکار (`generate-work-orders` با `onConflictDoNothing` و Snapshot چک‌لیست)، پایش تاخیرها (`overdue-scan`) و پیش‌بینی کارکرد (`project-meter-due`).
- [x] صفحه مدیریت و مشاهده دستورکارهای صادرشده (`/work-orders`) و REST APIهای `/api/v1/pm-templates`، `/api/v1/pm-schedules` و `/api/v1/work-orders`.

---

### 🎯 فاز ۳: چرخه دستورکار (Work Order)، ایمنی LOTO و تجربه موبایل/آفلاین تکنسین (PWA) — *(در نوبت اجرا)*
- [ ] سرویس‌ها و جریان کامل دستورکار (`OPEN` -> `ASSIGNED` -> `IN_PROGRESS` -> `DONE`) با گیت اجباری تاییدیه **LOTO**.
- [ ] رابط موبایل تکنسین (Mobile-first، کلیدهای بزرگ ۵۶px، اسکن QR، تکمیل چک‌لیست، ثبت مصرف قطعه و ثبت توقفات `DowntimeLog`).
- [ ] پیاده‌سازی PWA (`Serwist`) و صف آفلاین با `Dexie (IndexedDB)` به همراه همگام‌سازی خودکار.

---

### ⏳ فاز ۴: سیستم اعلان، یادآوری و Escalation بومی
- [ ] پیاده‌سازی آداپتورهای کانال اعلان به ترتیب اولویت: **پیامک (SMS)**، **ایتا (Eitaa)**، **ایمیل (SMTP)**، **Web Push** و **داخل برنامه (SSE)**.
- [ ] پیاده‌سازی جاب‌های یادآوری قبل از سررسید و Escalation سه‌سطحی (سرپرست ← مدیر نت ← مدیر کارخانه) با رعایت ساعات سکوت.

---

### ⏳ فاز ۵: داشبورد مدیریتی، شاخص‌های KPI و قابلیت‌های هوشمند (AI)
- [ ] محاسبه و نمایش نمودارهای **PM Compliance**، **MTBF**، **MTTR** و **Downtime** با `Recharts` (راست‌به‌چپ و تاریخ جلالی).
- [ ] گزارش‌گیری و خروجی ممیزی ایزو (`AuditLog` viewer & export).
- [ ] قابلیت‌های هوش مصنوعی کمکی با نظارت انسانی (Human-in-the-loop).
