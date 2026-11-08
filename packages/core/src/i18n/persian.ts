/**
 * Persian / Arabic normalization utilities for search, phone numbers, and free text.
 * Rule 03-persian-rtl-jalali:
 * - Convert Persian (۰-۹) and Arabic (٠-٩) digits to ASCII (0-9) on input.
 * - Normalize Arabic ي/ك/ة to Persian ی/ک/ه.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

export function normalizeDigits(input: string): string {
  let out = input;
  for (let i = 0; i < 10; i++) {
    out = out.replaceAll(PERSIAN_DIGITS[i]!, String(i));
    out = out.replaceAll(ARABIC_DIGITS[i]!, String(i));
  }
  return out;
}

export function normalizePersianText(input: string): string {
  return normalizeDigits(input)
    .replaceAll('\u064A', '\u06CC') // Arabic Yeh (ي) -> Persian Yeh (ی)
    .replaceAll('\u0649', '\u06CC') // Alef Maksura (ى) -> Persian Yeh (ی)
    .replaceAll('\u0643', '\u06A9') // Arabic Kaf (ك) -> Persian Keheh (ک)
    .replaceAll('\u06C0', '\u0647') // Heh with Yeh above -> Heh
    .replaceAll('\u0629', '\u0647') // Teh Marbuta (ة) -> Heh (ه)
    .replaceAll('\u200C', ' ') // ZWNJ (نیم‌فاصله) -> space for normalized search column
    .replace(/\s+/g, ' ')
    .trim();
}

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

const jalaliDateTimeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const jalaliDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatJalaliDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';
  return jalaliDateTimeFormatter.format(d);
}

export function formatJalaliDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';
  return jalaliDateFormatter.format(d);
}

