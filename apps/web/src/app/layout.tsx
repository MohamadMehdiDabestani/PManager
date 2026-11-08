import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'سامانه مدیریت نت کارخانه | PManager CMMS',
  description: 'سیستم مدیریت نگهداری و تعمیرات پیشگیرانه کارخانه (CMMS)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
