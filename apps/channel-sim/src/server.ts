import express, { type Request, type Response } from 'express';
import {
  channelMeta,
  sendRequestSchema,
  type SendResult,
  type SendResponse,
} from '@cadence/shared';
import { parseBearer } from '@cadence/shared/server';
import { config } from './config';
import { createLogger } from './logger';
import { dispatch, receiptQueue } from './dispatcher';
import { store } from './store';
import { randomId } from './random';

const log = createLogger('http');
const startedAt = Date.now();

function recipientLooksValid(
  channel: Parameters<typeof channelMeta>[0],
  recipient: string,
): boolean {
  const meta = channelMeta(channel);
  if (meta.addressType === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  // phone: + and 8–15 digits
  return /^\+?\d{8,15}$/.test(recipient.replace(/[\s-]/g, ''));
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  app.get('/', (_req, res) => {
    res.type('text').send('Cadence channel simulator — POST /v1/send, GET /health, GET /stats');
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
  });

  app.get('/stats', (_req, res) => {
    res.json({
      ...store.stats,
      knownIdempotencyKeys: store.knownKeys,
      receiptQueue: { ...receiptQueue.metrics, depth: receiptQueue.depth() },
      config: { speed: config.speed, duplicateRate: config.duplicateRate },
    });
  });

  app.post('/v1/send', handleSend);

  // 404 + error handler.
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    log.error('unhandled error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

function handleSend(req: Request, res: Response) {
  // 1) Auth — bearer token.
  if (parseBearer(req.headers.authorization) !== config.apiKey) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // 2) Validate the batch envelope.
  const parsed = sendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
  }
  const { batchId, callbackUrl, messages } = parsed.data;
  store.stats.sendBatches += 1;

  const acceptedAtMs = Date.now();
  const results: SendResult[] = [];

  for (const message of messages) {
    // 3) Idempotency — a replayed batch returns the same result, no re-send.
    const prior = store.priorResult(message.idempotencyKey);
    if (prior) {
      results.push(prior);
      continue;
    }

    // 4) Cheap synchronous validation → reject bad recipients up front.
    if (!recipientLooksValid(message.channel, message.recipient)) {
      const rejected: SendResult = {
        communicationId: message.communicationId,
        providerMessageId: null,
        status: 'REJECTED',
        reason: `invalid recipient for ${message.channel}`,
      };
      store.remember(message.idempotencyKey, rejected);
      store.stats.rejected += 1;
      results.push(rejected);
      continue;
    }

    // 5) Accept → assign provider id, remember, and kick off the async lifecycle.
    const providerMessageId = randomId('ch');
    const accepted: SendResult = {
      communicationId: message.communicationId,
      providerMessageId,
      status: 'ACCEPTED',
    };
    store.remember(message.idempotencyKey, accepted);
    store.stats.accepted += 1;
    results.push(accepted);

    dispatch({ message, providerMessageId, callbackUrl, acceptedAtMs });
  }

  const response: SendResponse = {
    batchId,
    accepted: results.filter((r) => r.status === 'ACCEPTED').length,
    rejected: results.filter((r) => r.status === 'REJECTED').length,
    results,
  };
  log.info('batch accepted', {
    batchId,
    total: messages.length,
    accepted: response.accepted,
    rejected: response.rejected,
  });
  // 202: we've accepted responsibility; outcomes arrive later via callbacks.
  return res.status(202).json(response);
}
