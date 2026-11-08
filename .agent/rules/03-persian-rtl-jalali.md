# Persian / RTL / Jalali
- <html lang="fa" dir="rtl">. Use Tailwind logical utilities (ms-*, me-*, ps-*, pe-*, start-*, end-*, text-start). Avoid left/right classes.
- Font: Vazirmatn (self-hosted woff2). No Google Fonts.
- Dates: store UTC; render Jalali via date-fns-jalali or jalaali-js; date pickers must be Jalali-capable. Allow user toggle Jalali/Gregorian.
- Digits: support Persian digits display; always normalize Persian/Arabic digits to ASCII on input (phone, numbers, search).
- Normalize Arabic ي ك to Persian ی ک in search and free-text storage.
- Search: normalized column or trigram index in PostgreSQL.
- Codes (asset tags, serials) inside RTL text: wrap in <bdi> or dir="ltr".
- Charts/tables/pagination must mirror correctly in RTL.
- Always use IANA Asia/Tehran, never a hardcoded offset.
