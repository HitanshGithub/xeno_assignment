/**
 * Money helpers. Amounts are integer minor units (paise for INR). Formatting
 * lives only here so the rest of the codebase never hand-rolls a `/100`.
 */

const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'en-IE',
};

export function formatMoney(
  cents: number,
  currency = 'INR',
  opts: { compact?: boolean; decimals?: boolean } = {},
): string {
  const locale = LOCALE_BY_CURRENCY[currency] ?? 'en-US';
  const value = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.decimals === false ? 0 : opts.compact ? 1 : 2,
    minimumFractionDigits: opts.decimals === false || opts.compact ? 0 : 0,
  }).format(value);
}

/** Major-unit number → minor units (e.g. 250.5 → 25050). */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
