import { toPersianDigits } from '@cmms/core/i18n';
import fa from '@/messages/fa.json';

export default function HomePage() {
  const kpis = [
    { label: 'انطباق نت پیشگیرانه (PM Compliance)', value: `${toPersianDigits(94)}%`, badge: 'مطلوب' },
    { label: 'دستورکارهای فعال امروز', value: toPersianDigits(12), badge: 'در جریان' },
    { label: 'میانگین زمان تعمیر (MTTR)', value: `${toPersianDigits(45)} دقیقه`, badge: 'بهبودیافته' },
    { label: 'ایمنی LOTO تاییدشده', value: `${toPersianDigits(100)}%`, badge: 'الزامی' },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-10">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">{fa.app.title}</h1>
            <p className="mt-2 text-sm text-slate-400">{fa.app.subtitle}</p>
          </div>
          <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
            آماده بهره‌برداری در شبکه داخلی (Intranet)
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{item.label}</span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {item.badge}
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-white">{item.value}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
