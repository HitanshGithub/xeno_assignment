import { formatMoney } from '@cadence/shared';

export { formatMoney };

/** Compact money for stat cards (₹6.3K). */
export function money(cents: number, currency = 'INR'): string {
  return formatMoney(cents, currency, { compact: cents >= 100000, decimals: false });
}

export function pct(num: number, den: number): string {
  if (den <= 0) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en-IN', { notation: n >= 10000 ? 'compact' : 'standard' }).format(
    n,
  );
}

/** "3 days ago", "in 2 months", etc. */
export function relativeTime(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') return rtf.format(Math.round(diff / ms), unit);
  }
  return '—';
}

export function shortDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
