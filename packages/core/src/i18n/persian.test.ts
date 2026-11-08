import { describe, it, expect } from 'vitest';
import { normalizeDigits, normalizePersianText, toPersianDigits } from './persian';

describe('Persian & Arabic text/digit normalization', () => {
  it('converts Persian and Arabic digits to ASCII', () => {
    expect(normalizeDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(normalizeDigits('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789');
  });

  it('normalizes Arabic Yeh and Kaf to Persian equivalents', () => {
    expect(normalizePersianText('پمپ هيدروليك   شماره ١٢')).toBe('پمپ هیدرولیک شماره 12');
  });

  it('converts ASCII digits to Persian digits for display', () => {
    expect(toPersianDigits(1405)).toBe('۱۴۰۵');
  });
});
