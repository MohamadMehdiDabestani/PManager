import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createDbConnection } from './client';
import {
  plants,
  locations,
  users,
  userPlants,
  assets,
  assetMeters,
  parts,
  pmTemplates,
  pmSchedules,
  workOrders,
} from './schema/index';

const envPaths = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
for (const envPath of envPaths) {
  if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
}

function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(secret, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

async function seed() {
  const { db, pool } = createDbConnection();

  try {
    console.log('🌱 شروع بارگذاری داده‌های اولیه کارخانه (Seed)...');

    // ۱. ایجاد کارخانه اصلی
    const [mainPlant] = await db
      .insert(plants)
      .values({
        code: 'PARS-TEH-01',
        name: 'کارخانه تولیدی پارس صنعت (سایت مرکزی)',
        timezone: 'Asia/Tehran',
        workingDays: [6, 0, 1, 2, 3, 4], // شنبه تا پنجشنبه
      })
      .onConflictDoUpdate({
        target: plants.code,
        set: { name: 'کارخانه تولیدی پارس صنعت (سایت مرکزی)' },
      })
      .returning();

    if (!mainPlant) throw new Error('خطا در ایجاد سایت کارخانه');

    // ۲. ایجاد سالن‌ها و خطوط تولید
    const locationSeeds = [
      { code: 'HALL-PRESS', name: 'سالن پرس‌کاری سنگین' },
      { code: 'LINE-ASM-01', name: 'خط مونتاژ و رباتیک ۱' },
      { code: 'UTIL-COMP', name: 'تاسیسات و کمپرسورخانه مرکزی' },
    ];

    const createdLocations = [];
    for (const loc of locationSeeds) {
      const [insertedLoc] = await db
        .insert(locations)
        .values({
          plantId: mainPlant.id,
          code: loc.code,
          name: loc.name,
        })
        .onConflictDoUpdate({
          target: [locations.plantId, locations.code],
          set: { name: loc.name },
        })
        .returning();
      if (insertedLoc) createdLocations.push(insertedLoc);
    }

    const pressHall = createdLocations[0]!;
    const assemblyLine = createdLocations[1]!;
    const utilityRoom = createdLocations[2]!;

    // ۳. ایجاد کاربران در نقش‌های مختلف (رمز پیش‌فرض: 123456 ، پین تکنسین: 1234)
    const userSeeds = [
      {
        username: 'admin',
        fullName: 'مهندس علی رضایی (مدیر سیستم)',
        phone: '09121000001',
        email: 'admin@factory.local',
        role: 'ADMIN' as const,
        pin: '1111',
      },
      {
        username: 'manager',
        fullName: 'مهندس محمد حسینی (مدیر نت)',
        phone: '09121000002',
        email: 'manager@factory.local',
        role: 'MAINTENANCE_MANAGER' as const,
        pin: '2222',
      },
      {
        username: 'planner',
        fullName: 'سارا کریمی (برنامه‌ریز نت)',
        phone: '09121000003',
        email: 'planner@factory.local',
        role: 'PLANNER' as const,
        pin: '3333',
      },
      {
        username: 'supervisor',
        fullName: 'حسن محمدی (سرپرست شیفت)',
        phone: '09121000004',
        email: 'supervisor@factory.local',
        role: 'SUPERVISOR' as const,
        pin: '4444',
      },
      {
        username: 'tech1',
        fullName: 'رضا اکبری (تکنسین ارشد مکانیک)',
        phone: '09121000005',
        email: 'tech1@factory.local',
        role: 'TECHNICIAN' as const,
        pin: '1234',
      },
    ];

    for (const u of userSeeds) {
      const [createdUser] = await db
        .insert(users)
        .values({
          username: u.username,
          fullName: u.fullName,
          fullNameNormalized: u.fullName,
          phone: u.phone,
          email: u.email,
          passwordHash: hashSecret('123456'),
          pinHash: hashSecret(u.pin),
          role: u.role,
          active: true,
          channelPreference: ['SMS', 'EITAA', 'EMAIL'],
        })
        .onConflictDoUpdate({
          target: users.username,
          set: { fullName: u.fullName, role: u.role },
        })
        .returning();

      if (createdUser) {
        await db
          .insert(userPlants)
          .values({ userId: createdUser.id, plantId: mainPlant.id })
          .onConflictDoNothing();
      }
    }

    // ۴. ایجاد درخت تجهیزات (Assets) به همراه رویه ایمنی LOTO و توکن QR
    const assetSeeds = [
      {
        code: 'PRS-HYD-250',
        name: 'پرس هیدرولیک ۲۵۰ تن اشمرال',
        locationId: pressHall.id,
        serialNumber: 'SCH-250-99412',
        qrOpaqueToken: 'ast_prs_hyd_250_demo_token',
        status: 'OPERATIONAL' as const,
        criticality: 'CRITICAL' as const,
        requiresLoto: true,
        lotoProcedure: [
          {
            stepNumber: 1,
            energySource: 'برق سه فاز ۳۸۰ ولت تابلو اصلی',
            isolationPoint: 'کلید اتوماتیک Q1 - قفل پدلاک قرمز',
            verificationMethod: 'تست استارت از پنل اپراتور و بررسی ولتاژ با مولتی‌متر',
          },
          {
            stepNumber: 2,
            energySource: 'فشار روغن هیدرولیک و انرژی پتانسیل رام پرس',
            isolationPoint: 'شیر تخلیه فشار V-12 و قرار دادن بلوک ایمنی مکانیکی زیر رام',
            verificationMethod: 'مشاهده گیج فشار روی صفر بار و استقرار فیزیکی بلوک مهار',
          },
        ],
        meter: { name: 'ساعت کارکرد پمپ اصلی', unit: 'ساعت', currentReading: 4820 },
      },
      {
        code: 'CMP-ATL-01',
        name: 'کمپرسور اسکرو اطلس کوپکو GA75',
        locationId: utilityRoom.id,
        serialNumber: 'ATC-GA75-8821',
        qrOpaqueToken: 'ast_cmp_atl_01_demo_token',
        status: 'OPERATIONAL' as const,
        criticality: 'HIGH' as const,
        requiresLoto: true,
        lotoProcedure: [
          {
            stepNumber: 1,
            energySource: 'تغذیه برق اصلی کمپرسور',
            isolationPoint: 'سکسیونر تابلو برق تاسیسات C-01',
            verificationMethod: 'خاموش شدن نمایشگر Elektronikon و تست عدم استارت',
          },
          {
            stepNumber: 2,
            energySource: 'هوای فشرده محبوس در مخزن سپراتور',
            isolationPoint: 'بستن شیر خروجی خط و باز کردن شیر تخلیه کندانس',
            verificationMethod: 'نمایش عدد ۰ بار روی مانومتر مخزن',
          },
        ],
        meter: { name: 'ساعت کارکرد کل (Running Hours)', unit: 'ساعت', currentReading: 11950 },
      },
      {
        code: 'CNV-ASM-02',
        name: 'نوار نقاله زنجیری خط مونتاژ ۱',
        locationId: assemblyLine.id,
        serialNumber: 'CNV-1402-09',
        qrOpaqueToken: 'ast_cnv_asm_02_demo_token',
        status: 'UNDER_MAINTENANCE' as const,
        criticality: 'MEDIUM' as const,
        requiresLoto: false,
        lotoProcedure: [],
        meter: { name: 'ساعت کارکرد گیربکس', unit: 'ساعت', currentReading: 2150 },
      },
    ];

    for (const a of assetSeeds) {
      const [createdAsset] = await db
        .insert(assets)
        .values({
          plantId: mainPlant.id,
          locationId: a.locationId,
          code: a.code,
          name: a.name,
          nameNormalized: a.name,
          serialNumber: a.serialNumber,
          qrOpaqueToken: a.qrOpaqueToken,
          status: a.status,
          criticality: a.criticality,
          requiresLoto: a.requiresLoto,
          lotoProcedure: a.lotoProcedure,
        })
        .onConflictDoUpdate({
          target: [assets.plantId, assets.code],
          set: {
            name: a.name,
            status: a.status,
            criticality: a.criticality,
            requiresLoto: a.requiresLoto,
            lotoProcedure: a.lotoProcedure,
          },
        })
        .returning();

      if (createdAsset && a.meter) {
        const existingMeters = await db
          .select()
          .from(assetMeters)
          .where(eq(assetMeters.assetId, createdAsset.id));

        if (existingMeters.length === 0) {
          await db.insert(assetMeters).values({
            assetId: createdAsset.id,
            name: a.meter.name,
            unit: a.meter.unit,
            currentReading: a.meter.currentReading,
          });
        }
      }
    }

    // ۵. ایجاد قطعات یدکی پایه
    const partSeeds = [
      { code: 'PRT-FLT-HYD01', name: 'فیلتر برگشت هیدرولیک ۲۵ میکرون', unit: 'عدد', quantityOnHand: 14, minQuantity: 5 },
      { code: 'PRT-OIL-VG68', name: 'روغن هیدرولیک بهران هیدرولیک ۶۸', unit: 'لیتر', quantityOnHand: 220, minQuantity: 100 },
      { code: 'PRT-BRG-6208', name: 'بلبرینگ SKF 6208-2RS', unit: 'عدد', quantityOnHand: 3, minQuantity: 6 },
    ];

    for (const p of partSeeds) {
      await db
        .insert(parts)
        .values({
          plantId: mainPlant.id,
          code: p.code,
          name: p.name,
          nameNormalized: p.name,
          unit: p.unit,
          quantityOnHand: p.quantityOnHand,
          minQuantity: p.minQuantity,
        })
        .onConflictDoNothing();
    }

    // ۶. ایجاد قالب‌های چک‌لیست نت (PM Templates) و برنامه‌های زمان‌بندی (PM Schedules)
    const existingTemplates = await db
      .select()
      .from(pmTemplates)
      .where(eq(pmTemplates.plantId, mainPlant.id));

    if (existingTemplates.length === 0) {
      const [pressAsset] = await db
        .select()
        .from(assets)
        .where(eq(assets.code, 'PRS-HYD-01'));
      const [compAsset] = await db
        .select()
        .from(assets)
        .where(eq(assets.code, 'CMP-AIR-01'));
      const [convAsset] = await db
        .select()
        .from(assets)
        .where(eq(assets.code, 'CNV-ASM-02'));
      const [techUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'tech1'));

      const [tplPress] = await db
        .insert(pmTemplates)
        .values({
          plantId: mainPlant.id,
          name: 'سرویس ماهانه پرس هیدرولیک ۱۰۰۰ تن',
          description: 'بازرسی فشار مدار، دمای روغن، شیرهای پروپورشنال و نشتی جک‌ها',
          estimatedMinutes: 90,
          requiredPpe: ['کلاه ایمنی', 'عینک ایمنی', 'دستکش عایق برق', 'کفش ایمنی'],
          checklist: [
            {
              id: 'chk-1',
              label: 'بررسی سطح و شفافیت روغن مخزن هیدرولیک',
              type: 'BOOLEAN',
              required: true,
            },
            {
              id: 'chk-2',
              label: 'فشار خط اصلی پمپ در حالت بار کامل',
              type: 'NUMBER',
              unit: 'bar',
              minValue: 210,
              maxValue: 250,
              required: true,
            },
            {
              id: 'chk-3',
              label: 'دمای روغن هیدرولیک در حین کار',
              type: 'NUMBER',
              unit: '°C',
              minValue: 35,
              maxValue: 55,
              required: true,
            },
            {
              id: 'chk-4',
              label: 'تصویر وضعیت گیج فشار و فیلتر برگشت',
              type: 'PHOTO',
              required: false,
            },
          ],
        })
        .returning();

      const [tplComp] = await db
        .insert(pmTemplates)
        .values({
          plantId: mainPlant.id,
          name: 'سرویس ۵۰۰ ساعته کمپرسور اسکرو اطلس کوپکو',
          description: 'تعویض فیلتر هوا، بررسی سپراتور روغن و تخلیه کندانس درایر',
          estimatedMinutes: 60,
          requiredPpe: ['گوشی صداگیر', 'عینک ایمنی', 'دستکش ضدبرش', 'ماسک تنفسی'],
          checklist: [
            {
              id: 'chk-c1',
              label: 'تمیزکاری یا تعویض المنت فیلتر هوای ورودی',
              type: 'BOOLEAN',
              required: true,
            },
            {
              id: 'chk-c2',
              label: 'اختلاف فشار فیلتر سپراتور روغن',
              type: 'NUMBER',
              unit: 'bar',
              minValue: 0,
              maxValue: 0.8,
              required: true,
            },
            {
              id: 'chk-c3',
              label: 'بررسی عملکرد شیر تخلیه اتوماتیک کندانس',
              type: 'BOOLEAN',
              required: true,
            },
          ],
        })
        .returning();

      const [tplConv] = await db
        .insert(pmTemplates)
        .values({
          plantId: mainPlant.id,
          name: 'بازرسی و گریس‌کاری هفتگی نوار نقاله خط مونتاژ',
          description: 'روان‌کاری یاتاقان‌ها، تنظیم کشش زنجیر و کنترل کلیدهای امرجنسی طنابی',
          estimatedMinutes: 45,
          requiredPpe: ['کفش ایمنی', 'دستکش ضدبرش'],
          checklist: [
            {
              id: 'chk-v1',
              label: 'گریس‌کاری ۴ عدد یاتاقان سر و ته نوار با گریس لیتیوم',
              type: 'BOOLEAN',
              required: true,
            },
            {
              id: 'chk-v2',
              label: 'تست عملکرد میکروسوئیچ توقف اضطراری (Pull Cord)',
              type: 'BOOLEAN',
              required: true,
            },
            {
              id: 'chk-v3',
              label: 'گزارش وضعیت ظاهری زنجیر و دنده‌ها',
              type: 'TEXT',
              required: false,
            },
          ],
        })
        .returning();

      const now = new Date();
      const inTwoDays = new Date(now.getTime() + 2 * 86_400_000);
      const inFiveDays = new Date(now.getTime() + 5 * 86_400_000);
      const yesterday = new Date(now.getTime() - 1 * 86_400_000);

      if (pressAsset && tplPress) {
        const [schedPress] = await db
          .insert(pmSchedules)
          .values({
            plantId: mainPlant.id,
            assetId: pressAsset.id,
            templateId: tplPress.id,
            triggerType: 'CALENDAR',
            anchorMode: 'FIXED',
            intervalDays: 30,
            nextDueAt: inTwoDays,
            leadDays: 3,
            priority: 'URGENT',
            defaultAssigneeId: techUser?.id ?? null,
            active: true,
          })
          .returning();

        if (schedPress) {
          await db
            .insert(workOrders)
            .values({
              plantId: mainPlant.id,
              assetId: pressAsset.id,
              pmScheduleId: schedPress.id,
              type: 'PM',
              status: 'ASSIGNED',
              priority: 'URGENT',
              title: tplPress.name,
              description: tplPress.description,
              assigneeId: techUser?.id ?? null,
              dueAt: inTwoDays,
              checklistSnapshot: tplPress.checklist,
            })
            .onConflictDoNothing();
        }
      }

      if (compAsset && tplComp) {
        const [compMeter] = await db
          .select()
          .from(assetMeters)
          .where(eq(assetMeters.assetId, compAsset.id));

        await db.insert(pmSchedules).values({
          plantId: mainPlant.id,
          assetId: compAsset.id,
          templateId: tplComp.id,
          triggerType: 'HYBRID',
          anchorMode: 'FLOATING',
          intervalDays: 60,
          meterId: compMeter?.id ?? null,
          intervalMeter: 500,
          lastDoneMeter: 11500,
          nextDueAt: inFiveDays,
          leadDays: 5,
          priority: 'HIGH',
          defaultAssigneeId: techUser?.id ?? null,
          active: true,
        });
      }

      if (convAsset && tplConv) {
        const [schedConv] = await db
          .insert(pmSchedules)
          .values({
            plantId: mainPlant.id,
            assetId: convAsset.id,
            templateId: tplConv.id,
            triggerType: 'CALENDAR',
            anchorMode: 'FLOATING',
            intervalDays: 7,
            nextDueAt: yesterday,
            leadDays: 2,
            priority: 'MEDIUM',
            defaultAssigneeId: techUser?.id ?? null,
            active: true,
          })
          .returning();

        if (schedConv) {
          await db
            .insert(workOrders)
            .values({
              plantId: mainPlant.id,
              assetId: convAsset.id,
              pmScheduleId: schedConv.id,
              type: 'PM',
              status: 'OVERDUE',
              priority: 'HIGH',
              title: tplConv.name,
              description: tplConv.description,
              assigneeId: techUser?.id ?? null,
              dueAt: yesterday,
              checklistSnapshot: tplConv.checklist,
            })
            .onConflictDoNothing();
        }
      }
    }

    console.log('✅ داده‌های اولیه کارخانه با موفقیت ثبت شدند.');
    console.log('🔑 حساب‌های کاربری آماده ورود (رمز عبور همگی: 123456):');
    console.log('   - مدیر سیستم: admin (PIN: 1111)');
    console.log('   - مدیر نت: manager (PIN: 2222)');
    console.log('   - برنامه‌ریز: planner (PIN: 3333)');
    console.log('   - سرپرست: supervisor (PIN: 4444)');
    console.log('   - تکنسین: tech1 (PIN: 1234)');
  } finally {
    await pool.end();
  }
}

void seed();
