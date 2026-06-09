import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Shared-secret authentication for the two service hops. This module is
 * server-only (it imports node:crypto) and is exported via `@cadence/shared/server`
 * so it never leaks into a browser bundle.
 *
 *  - Send hop (CRM → channel): a bearer token in `Authorization`.
 *  - Receipt hop (channel → CRM): an HMAC-SHA256 of the *raw request body*,
 *    so the CRM can trust that a receipt really came from the channel and was
 *    not forged or tampered with in transit.
 */

export const SIGNATURE_HEADER = 'x-cadence-signature';

/** Hex HMAC-SHA256 of the raw body under the shared secret. */
export function signPayload(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/** Constant-time verification; never throws on malformed input. */
export function verifyPayload(secret: string, rawBody: string, signature: string): boolean {
  const expected = signPayload(secret, rawBody);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature ?? '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Parse a `Bearer <token>` header, tolerant of casing and whitespace. */
export function parseBearer(headerValue: string | undefined | null): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1]!.trim() : null;
}
