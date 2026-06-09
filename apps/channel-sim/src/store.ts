import type { SendResult } from '@cadence/shared';

/**
 * In-memory state for the simulator: send idempotency + counters.
 *
 * Scope note: this is intentionally process-local and non-durable. A real
 * channel would persist idempotency keys (Redis/DB) so a restart doesn't
 * re-accept a replayed batch. For this assignment the trade is explicit — the
 * interesting durability/idempotency story lives on the CRM (receipt) side,
 * which *is* persisted.
 */
class SimStore {
  /** idempotencyKey -> the result we returned, so retried sends are no-ops. */
  private readonly sends = new Map<string, SendResult>();

  readonly stats = {
    sendBatches: 0,
    accepted: 0,
    rejected: 0,
    receiptsDelivered: 0,
    duplicatesInjected: 0,
    deadLettered: 0,
  };

  /** Returns a prior result if this key was already accepted, else null. */
  priorResult(idempotencyKey: string): SendResult | null {
    return this.sends.get(idempotencyKey) ?? null;
  }

  remember(idempotencyKey: string, result: SendResult): void {
    this.sends.set(idempotencyKey, result);
  }

  get knownKeys(): number {
    return this.sends.size;
  }
}

export const store = new SimStore();
