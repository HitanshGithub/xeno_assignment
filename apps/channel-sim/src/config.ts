/**
 * Channel simulator configuration. Everything has a working default so the
 * service boots with zero env, but the secrets and the CRM callback base
 * should be set in any real deployment.
 */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num('CHANNEL_PORT', 4000),

  /** Bearer token the CRM must present on /v1/send. */
  apiKey: process.env.CHANNEL_SERVICE_API_KEY ?? 'dev-send-key-change-me',
  /** Secret used to HMAC-sign receipts so the CRM can trust them. */
  callbackSecret: process.env.CHANNEL_CALLBACK_SECRET ?? 'dev-callback-secret-change-me',

  /** Default CRM base, used only if a send omits an absolute callbackUrl. */
  crmBaseUrl: process.env.CRM_BASE_URL ?? 'http://localhost:3000',

  /**
   * Wall-clock compression. Real engagement plays out over minutes/hours; for a
   * live demo we scale every simulated delay by this factor (0.15 ≈ a ~10 min
   * journey compressed into ~90s). Set to 1 for realistic timing.
   */
  speed: num('CHANNEL_SPEED', 0.15),

  /**
   * Fraction of receipts deliberately delivered twice (same eventId) to prove
   * the CRM's idempotent ingestion under at-least-once delivery.
   */
  duplicateRate: num('CHANNEL_DUPLICATE_RATE', 0.03),

  /** Retry policy for the receipt callback hop (the lossy network edge). */
  callback: {
    concurrency: num('CHANNEL_CALLBACK_CONCURRENCY', 24),
    maxAttempts: num('CHANNEL_CALLBACK_MAX_ATTEMPTS', 5),
    baseDelayMs: num('CHANNEL_CALLBACK_BASE_DELAY_MS', 500),
  },
} as const;
