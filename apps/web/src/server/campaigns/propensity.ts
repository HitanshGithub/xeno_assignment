const DAY = 24 * 60 * 60 * 1000;
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

interface PropensityInput {
  orderCount: number;
  lastOrderAt: Date | null;
  avgOrderValueCents: number;
}

/**
 * A cheap engagement propensity in [0,1] from the customer's RFM signals,
 * passed to the channel as send context. The simulator scales its
 * open/click/convert odds by it, so targeting genuinely better customers
 * produces genuinely better campaign stats — closing the loop between "who you
 * chose" and "what happened".
 *
 * Weighting: recency dominates (the strongest real predictor), then frequency,
 * then monetary value.
 */
export function computePropensity(input: PropensityInput, now = new Date()): number {
  const recency = input.lastOrderAt
    ? clamp(1 - (now.getTime() - input.lastOrderAt.getTime()) / DAY / 180)
    : 0;
  const frequency = clamp(input.orderCount / 40);
  const monetary = clamp(input.avgOrderValueCents / 60000); // ₹600 AOV → 1.0
  return clamp(0.5 * recency + 0.35 * frequency + 0.15 * monetary);
}
