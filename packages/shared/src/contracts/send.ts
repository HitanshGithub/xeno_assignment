import { z } from 'zod';
import { CHANNELS } from '../enums';

/**
 * Contract for the CRM → channel send hop (`POST /v1/send`).
 *
 * A campaign launch sends a *batch* of messages in one call (realistic — you
 * don't open a connection per recipient). The channel validates cheaply and
 * synchronously (bad address → rejected up front), accepts the rest, and then
 * does all the actual lifecycle simulation asynchronously, reporting back via
 * the receipt contract. So this response only tells you what was *accepted*,
 * never what was "delivered".
 */

export const sendMessageSchema = z.object({
  /** CRM communication id — echoed back on every receipt for correlation. */
  communicationId: z.string().min(1),
  /** Idempotency for this individual message; a retried batch is a no-op. */
  idempotencyKey: z.string().min(1),
  channel: z.enum(CHANNELS),
  recipient: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  /**
   * Opaque hints that let the simulator be smarter (e.g. an engagement
   * propensity in [0,1] derived from the customer's history). Never required.
   */
  context: z.record(z.string(), z.unknown()).optional(),
});
export type SendMessage = z.infer<typeof sendMessageSchema>;

export const sendRequestSchema = z.object({
  /** Logical batch id (the campaign launch) for logging/tracing. */
  batchId: z.string().min(1),
  /** Absolute URL the channel should POST receipts to. */
  callbackUrl: z.string().url(),
  messages: z.array(sendMessageSchema).min(1).max(5000),
});
export type SendRequest = z.infer<typeof sendRequestSchema>;

export const sendResultSchema = z.object({
  communicationId: z.string(),
  /** Channel-assigned id; correlates receipts back to this message. */
  providerMessageId: z.string().nullable(),
  status: z.enum(['ACCEPTED', 'REJECTED']),
  reason: z.string().optional(),
});
export type SendResult = z.infer<typeof sendResultSchema>;

export const sendResponseSchema = z.object({
  batchId: z.string(),
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  results: z.array(sendResultSchema),
});
export type SendResponse = z.infer<typeof sendResponseSchema>;
