import {
  sendRequestSchema,
  sendResponseSchema,
  type SendMessage,
  type SendResponse,
} from '@cadence/shared';
import { env } from '../env';

export class ChannelError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`channel service responded ${status}`);
    this.name = 'ChannelError';
  }
}

/**
 * The CRM → channel send hop. Sends a validated batch with bearer auth and the
 * callback URL the channel should post receipts to, then validates the response
 * shape on the way back in. Network/HTTP failures surface as `ChannelError` so
 * the caller can decide what to do (the launch path leaves communications
 * QUEUED on failure — they're safe to retry thanks to per-message idempotency).
 */
export async function sendBatch(
  batchId: string,
  messages: SendMessage[],
): Promise<SendResponse> {
  const payload = {
    batchId,
    callbackUrl: `${env.CRM_BASE_URL}/api/receipts`,
    messages,
  };
  // Validate what we're about to send — fail fast on a bad message.
  sendRequestSchema.parse(payload);

  const res = await fetch(`${env.CHANNEL_SERVICE_URL}/v1/send`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.CHANNEL_SERVICE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new ChannelError(res.status, await res.text().catch(() => ''));
  }
  return sendResponseSchema.parse(await res.json());
}

export type { SendMessage };
