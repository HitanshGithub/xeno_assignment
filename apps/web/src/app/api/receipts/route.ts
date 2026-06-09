import { receiptBatchSchema } from '@cadence/shared';
import { verifyPayload, SIGNATURE_HEADER } from '@cadence/shared/server';
import { env } from '@/server/env';
import { ingestReceipts } from '@/server/receipts';
import { fail, ok } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * The channel → CRM receipt callback. Reads the *raw* body (so the HMAC matches
 * byte-for-byte), verifies the signature, then ingests. Returns an ack with how
 * many events applied vs were duplicates — useful for the channel's own stats.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER) ?? '';

  if (!verifyPayload(env.CHANNEL_CALLBACK_SECRET, raw, signature)) {
    return fail(401, 'invalid_signature');
  }

  let parsed;
  try {
    parsed = receiptBatchSchema.parse(JSON.parse(raw));
  } catch {
    return fail(400, 'invalid_receipt_batch');
  }

  const ack = await ingestReceipts(parsed);
  return ok(ack);
}
