import type { CommunicationStatus, EventType } from './enums';

/**
 * Lifecycle projection.
 *
 * Receipts arrive out of order and at least once. To keep a sane current
 * `status` we rank each stage and only ever advance *forward*. OPENED (email)
 * and READ (messaging) are the same "viewed" tier — different channels, same
 * meaning — so they share a rank.
 *
 * FAILED / BOUNCED are terminal sinks: once a communication is there, normal
 * forward events are ignored (they shouldn't arrive, but at-least-once delivery
 * means we must be defensive).
 */
const RANK: Record<CommunicationStatus, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  OPENED: 3,
  READ: 3,
  CLICKED: 4,
  CONVERTED: 5,
  // Terminal failures sit out of band.
  FAILED: -1,
  BOUNCED: -1,
};

const TERMINAL_FAILURE: ReadonlySet<CommunicationStatus> = new Set(['FAILED', 'BOUNCED']);

/** Event types that map onto a communication status (UNSUBSCRIBED does not). */
const STATUS_EVENTS: ReadonlySet<EventType> = new Set([
  'QUEUED',
  'SENT',
  'DELIVERED',
  'OPENED',
  'READ',
  'CLICKED',
  'CONVERTED',
  'FAILED',
  'BOUNCED',
]);

export function isStatusEvent(type: EventType): type is EventType & CommunicationStatus {
  return STATUS_EVENTS.has(type);
}

export function isTerminalFailure(status: CommunicationStatus): boolean {
  return TERMINAL_FAILURE.has(status);
}

export function statusRank(status: CommunicationStatus): number {
  return RANK[status];
}

/**
 * Given the current projected status and an incoming event, return the status
 * the communication should now hold. Pure and monotonic: a late `DELIVERED`
 * after a `CLICKED` is a no-op; a `CLICKED` after `DELIVERED` advances.
 */
export function projectStatus(
  current: CommunicationStatus,
  incoming: EventType,
): { status: CommunicationStatus; advanced: boolean } {
  if (!isStatusEvent(incoming)) return { status: current, advanced: false };

  const next = incoming as CommunicationStatus;

  // A hard failure always wins over a non-terminal state and is sticky.
  if (TERMINAL_FAILURE.has(next)) {
    if (TERMINAL_FAILURE.has(current)) return { status: current, advanced: false };
    return { status: next, advanced: true };
  }

  // Once terminally failed, ignore forward progress events.
  if (TERMINAL_FAILURE.has(current)) return { status: current, advanced: false };

  return RANK[next] > RANK[current]
    ? { status: next, advanced: true }
    : { status: current, advanced: false };
}
