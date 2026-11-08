import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'پارس صنعت | سامانه نت پیشگیرانه کارخانه (CMMS)',
    short_name: 'پارس نت',
    description: 'اجرای آفلاین دستورکارهای نت، تایید ایمنی LOTO، اسکن QR و چک‌لیست تکنسین',
    start_url: '/m/work-orders',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#090d16',
    theme_color: '#0f172a',
    dir: 'rtl',
    lang: 'fa-IR',
    categories: ['productivity', 'utilities', 'business'],
    shortcuts: [
      {
        name: 'دستورکارهای من (تکنسین)',
        short_name: 'دستورکارها',
        description: 'مشاهده و اجرای دستورکارهای تخصیص‌یافته (حتی آفلاین)',
        url: '/m/work-orders',
      },
      {
        name: 'اسکن سریع پلاک QR تجهیز',
        short_name: 'اسکن QR',
        description: 'باز کردن شناسنامه دستگاه و ثبت کارکرد کنتور با دوربین',
        url: '/m/scan',
      },
    ],
  };
}
