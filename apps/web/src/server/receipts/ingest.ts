import { prisma, Prisma, type CommunicationStatus, type EventType } from '@cadence/db';
import {
  isStatusEvent,
  projectStatus,
  type ReceiptAck,
  type ReceiptBatch,
  type ReceiptEvent,
} from '@cadence/shared';
import { recomputeRollups } from '../rollups';

/**
 * Receipt ingestion — where the asynchronous, out-of-order, at-least-once truth
 * lands. The append-only event log is the source of truth; the communication's
 * status + per-stage timestamps are a derived projection.
 *
 * Idempotency and consistency come from one move: each receipt is written to
 * the event log inside a transaction, with `dedupeKey = eventId` under a unique
 * constraint. A duplicate hits the constraint, the transaction rolls back, and
 * *no side effect* runs. So replays are free and partial application is
 * impossible.
 */
export async function ingestReceipts(batch: ReceiptBatch): Promise<ReceiptAck> {
  let applied = 0;
  let duplicates = 0;
  for (const event of batch.events) {
    const outcome = await applyEvent(event);
    if (outcome === 'applied') applied += 1;
    else if (outcome === 'duplicate') duplicates += 1;
    // 'unknown' (no matching communication) is counted as received-not-applied.
  }
  return { received: batch.events.length, applied, duplicates };
}

type Outcome = 'applied' | 'duplicate' | 'unknown';

const TIMESTAMP_FIELD: Partial<Record<EventType, string>> = {
  SENT: 'sentAt',
  DELIVERED: 'deliveredAt',
  OPENED: 'openedAt',
  READ: 'readAt',
  CLICKED: 'clickedAt',
  CONVERTED: 'convertedAt',
  FAILED: 'failedAt',
  BOUNCED: 'failedAt',
};

async function applyEvent(event: ReceiptEvent): Promise<Outcome> {
  const occurredAt = new Date(event.occurredAt);

  // Cheap existence check up front so an unknown id doesn't blow up the FK.
  const comm = await prisma.communication.findUnique({
    where: { id: event.communicationId },
    select: { id: true, customerId: true, campaignId: true },
  });
  if (!comm) return 'unknown';

  // Fast-path dedupe: most duplicates are caught here without an exception.
  // The transaction + P2002 catch below is the backstop for the rare race
  // where two copies of the same eventId arrive concurrently.
  const already = await prisma.communicationEvent.findUnique({
    where: { dedupeKey: event.eventId },
    select: { id: true },
  });
  if (already) return 'duplicate';

  let convertedCustomerId: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      // 1) Append to the log. Unique dedupeKey makes this the idempotency gate.
      await tx.communicationEvent.create({
        data: {
          communicationId: comm.id,
          type: event.type,
          occurredAt,
          receivedAt: new Date(),
          dedupeKey: event.eventId,
          metadata: (event.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      // 2) UNSUBSCRIBED is a consent side-effect, not a lifecycle status.
      if (event.type === 'UNSUBSCRIBED') {
        await tx.customer.update({
          where: { id: comm.customerId },
          data: { marketingOptIn: false },
        });
        return;
      }

      // 3) Project the lifecycle status forward (monotonic) and stamp the stage.
      const current = await tx.communication.findUniqueOrThrow({
        where: { id: comm.id },
        select: { status: true, convertedAt: true, ...timestampSelect(event.type) },
      });

      const update: Prisma.CommunicationUpdateInput = {};
      const { status, advanced } = projectStatus(current.status as CommunicationStatus, event.type);
      if (advanced) update.status = status;

      // Record the stage timestamp if not already set (even out of order).
      const tsField = TIMESTAMP_FIELD[event.type];
      if (tsField && (current as Record<string, unknown>)[tsField] == null) {
        (update as Record<string, unknown>)[tsField] = occurredAt;
      }
      if ((event.type === 'FAILED' || event.type === 'BOUNCED') && event.metadata?.reason) {
        update.failureReason = event.metadata.reason;
      }
      if (Object.keys(update).length > 0) {
        await tx.communication.update({ where: { id: comm.id }, data: update });
      }

      // 4) Attribution: a conversion creates the order it drove, linked back.
      if (event.type === 'CONVERTED' && event.metadata?.order && current.convertedAt == null) {
        const order = event.metadata.order;
        await tx.order.create({
          data: {
            externalId: `conv-${event.eventId}`,
            customerId: comm.customerId,
            orderedAt: occurredAt,
            totalCents: order.totalCents,
            currency: order.currency ?? 'INR',
            channel: 'CAMPAIGN_ATTRIBUTED',
            attributedCommunicationId: comm.id,
            ...(order.items
              ? {
                  items: {
                    create: order.items.map((i) => ({
                      productName: i.productName,
                      category: i.category,
                      quantity: i.quantity,
                      unitPriceCents: i.unitPriceCents,
                    })),
                  },
                }
              : {}),
          },
        });
        convertedCustomerId = comm.customerId;
      }
    });
  } catch (err) {
    // Concurrent duplicate lost the race on the unique dedupeKey — expected.
    const code = (err as { code?: string }).code;
    if (
      code === 'P2002' ||
      (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
    ) {
      return 'duplicate';
    }
    throw err;
  }

  // Post-commit, eventually-consistent work: rollups + campaign completion.
  if (convertedCustomerId) await recomputeRollups(convertedCustomerId);
  await maybeCompleteCampaign(comm.campaignId);

  return 'applied';
}

/** Select only the timestamp column relevant to this event (plus convertedAt). */
function timestampSelect(type: EventType): Record<string, boolean> {
  const field = TIMESTAMP_FIELD[type];
  return field ? { [field]: true } : {};
}

/**
 * A campaign's delivery is "complete" once no recipient is still pre-delivery
 * (QUEUED or SENT). Engagement events can still arrive afterwards and keep
 * updating stats — COMPLETED marks the send finished, not the story.
 */
async function maybeCompleteCampaign(campaignId: string): Promise<void> {
  const pending = await prisma.communication.count({
    where: { campaignId, status: { in: ['QUEUED', 'SENT'] } },
  });
  if (pending > 0) return;
  await prisma.campaign.updateMany({
    where: { id: campaignId, status: 'RUNNING' },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
}
