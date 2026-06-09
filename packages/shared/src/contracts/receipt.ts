import { z } from 'zod';
import { EVENT_TYPES } from '../enums';

/**
 * Contract for the channel → CRM receipt hop (`POST /api/receipts`).
 *
 * Receipts are the asynchronous truth about what happened. They are delivered
 * **at least once** and may arrive **out of order**, so every event carries a
 * stable `eventId` the CRM uses as an idempotency key, plus the `occurredAt`
 * the channel asserts (which may predate an already-ingested later event).
 *
 * A CONVERTED event may carry a simulated order in `metadata.order` — this is
 * how "an order came because of this communication" enters the system and gets
 * attributed.
 */

export const simulatedOrderSchema = z.object({
  totalCents: z.number().int().positive(),
  currency: z.string().default('INR'),
  items: z
    .array(
      z.object({
        productName: z.string(),
        category: z.string(),
        quantity: z.number().int().positive().default(1),
        unitPriceCents: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});
export type SimulatedOrder = z.infer<typeof simulatedOrderSchema>;

export const receiptMetadataSchema = z
  .object({
    /** For FAILED / BOUNCED. */
    reason: z.string().optional(),
    /** For CLICKED. */
    url: z.string().optional(),
    device: z.string().optional(),
    /** For CONVERTED. */
    order: simulatedOrderSchema.optional(),
  })
  .passthrough();

export const receiptEventSchema = z.object({
  /** Provider-unique id → the CRM's dedupe key. Idempotency hinges on this. */
  eventId: z.string().min(1),
  /** Channel-assigned message id from the send response. */
  providerMessageId: z.string().min(1),
  /** CRM communication id, echoed from the send request for direct lookup. */
  communicationId: z.string().min(1),
  type: z.enum(EVENT_TYPES),
  /** ISO timestamp the channel asserts the event happened at. */
  occurredAt: z.string().datetime(),
  metadata: receiptMetadataSchema.optional(),
});
export type ReceiptEvent = z.infer<typeof receiptEventSchema>;

/** Receipts may be batched by the channel for efficiency. */
export const receiptBatchSchema = z.object({
  events: z.array(receiptEventSchema).min(1).max(1000),
});
export type ReceiptBatch = z.infer<typeof receiptBatchSchema>;

export const receiptAckSchema = z.object({
  received: z.number().int().nonnegative(),
  applied: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
});
export type ReceiptAck = z.infer<typeof receiptAckSchema>;
