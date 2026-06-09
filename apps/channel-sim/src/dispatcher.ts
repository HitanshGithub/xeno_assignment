import type { ReceiptEvent, SendMessage } from '@cadence/shared';
import { signPayload, SIGNATURE_HEADER } from '@cadence/shared/server';
import { config } from './config';
import { createLogger } from './logger';
import { RetryQueue } from './queue';
import { simulate, type TimelineEvent } from './simulator';
import { store } from './store';

const log = createLogger('dispatch');

/** The lossy network hop. Every receipt is a task here so it gets retried. */
export const receiptQueue = new RetryQueue({
  name: 'receipts',
  concurrency: config.callback.concurrency,
  maxAttempts: config.callback.maxAttempts,
  baseDelayMs: config.callback.baseDelayMs,
});

interface AcceptedMessage {
  message: SendMessage;
  providerMessageId: string;
  callbackUrl: string;
  acceptedAtMs: number;
}

/**
 * Kick off the simulated lifecycle for one accepted message: compute its
 * timeline, then schedule each event to fire (scaled to demo speed). When an
 * event fires it's pushed onto the retry queue for delivery, and with a small
 * probability delivered twice — same eventId — so the CRM's dedupe is exercised
 * for real, not just asserted.
 */
export function dispatch({
  message,
  providerMessageId,
  callbackUrl,
  acceptedAtMs,
}: AcceptedMessage) {
  const timeline = simulate(message);
  let seq = 0;
  for (const event of timeline) {
    const eventSeq = seq++;
    const scaledDelay = Math.max(0, event.offsetMs * config.speed);
    setTimeout(() => {
      const occurredAt = new Date(acceptedAtMs + scaledDelay).toISOString();
      const receipt = buildReceipt(message, providerMessageId, event, occurredAt, eventSeq);
      enqueueDelivery(receipt, callbackUrl);

      // Occasionally deliver the same receipt twice (at-least-once reality).
      if (Math.random() < config.duplicateRate) {
        store.stats.duplicatesInjected += 1;
        enqueueDelivery(receipt, callbackUrl);
      }
    }, scaledDelay);
  }
}

function buildReceipt(
  message: SendMessage,
  providerMessageId: string,
  event: TimelineEvent,
  occurredAt: string,
  seq: number,
): ReceiptEvent {
  return {
    // Stable across duplicate deliveries → the CRM's dedupe key.
    eventId: `evt_${providerMessageId}_${seq}_${event.type}`,
    providerMessageId,
    communicationId: message.communicationId,
    type: event.type,
    occurredAt,
    metadata: event.metadata,
  };
}

function enqueueDelivery(receipt: ReceiptEvent, callbackUrl: string) {
  receiptQueue.enqueue(
    () => deliver(receipt, callbackUrl),
    `${receipt.type} ${receipt.providerMessageId}`,
  );
}

async function deliver(receipt: ReceiptEvent, callbackUrl: string): Promise<void> {
  const body = JSON.stringify({ events: [receipt] });
  const signature = signPayload(config.callbackSecret, body);

  const res = await fetch(callbackUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signature },
    body,
  });

  if (!res.ok) {
    // Non-2xx → throw so the RetryQueue backs off and retries.
    throw new Error(`receipt callback ${res.status} ${res.statusText}`);
  }
  store.stats.receiptsDelivered += 1;
  log.debug('receipt delivered', { type: receipt.type, to: callbackUrl });
}
