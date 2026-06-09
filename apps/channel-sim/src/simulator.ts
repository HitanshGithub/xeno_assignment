import type { Channel, EventType, SendMessage, SimulatedOrder } from '@cadence/shared';
import { chance, clamp, pick, randInt } from './random';

/**
 * The lifecycle state machine. Given an accepted message, it produces the
 * ordered timeline of events that "happened" to it, each with a natural-time
 * offset (ms from acceptance) the dispatcher later scales for the demo.
 *
 * Rates are rough real-world marketing benchmarks and differ per channel —
 * that's the point: a campaign over WhatsApp should genuinely outperform one
 * over email in the resulting stats. An optional `engagementPropensity` in the
 * message context (the CRM derives it from the customer's recency/frequency)
 * scales the engagement probabilities, so targeting better customers really
 * does convert better.
 */

export interface TimelineEvent {
  type: EventType;
  /** Cumulative natural-time offset from acceptance, in ms. */
  offsetMs: number;
  metadata?: Record<string, unknown>;
}

interface ChannelRates {
  deliver: number;
  /** P(view | delivered): OPENED for email, READ for messaging, n/a for SMS. */
  view: number;
  /** P(click | eligible). */
  click: number;
  /** P(convert | clicked). */
  convert: number;
  /** P(unsubscribe | viewed). */
  unsub: number;
  /** Of failures, the share that present as a hard BOUNCE (email only really). */
  bounceShare: number;
}

const RATES: Record<Channel, ChannelRates> = {
  WHATSAPP: { deliver: 0.97, view: 0.85, click: 0.3, convert: 0.18, unsub: 0.01, bounceShare: 0 },
  RCS: { deliver: 0.95, view: 0.75, click: 0.28, convert: 0.16, unsub: 0.01, bounceShare: 0 },
  EMAIL: { deliver: 0.93, view: 0.42, click: 0.12, convert: 0.09, unsub: 0.02, bounceShare: 0.6 },
  SMS: { deliver: 0.96, view: 0, click: 0.1, convert: 0.06, unsub: 0.015, bounceShare: 0 },
};

/** Tiny catalogue used to fabricate a believable order on conversion. */
const PRODUCTS = [
  { productName: 'Signature Latte', category: 'Espresso', unitPriceCents: 25000 },
  { productName: 'Cold Brew', category: 'Cold', unitPriceCents: 28000 },
  { productName: 'Cappuccino', category: 'Espresso', unitPriceCents: 24000 },
  { productName: 'Butter Croissant', category: 'Food', unitPriceCents: 18000 },
  { productName: 'Whole Bean 250g', category: 'Beans', unitPriceCents: 65000 },
] as const;

const DEVICES = ['ios', 'android', 'web', 'desktop'] as const;

function viewEventType(channel: Channel): EventType | null {
  if (channel === 'EMAIL') return 'OPENED';
  if (channel === 'SMS') return null;
  return 'READ';
}

function fabricateOrder(): SimulatedOrder {
  const lines = randInt(1, 3);
  const items = Array.from({ length: lines }, () => {
    const p = pick(PRODUCTS);
    return { ...p, quantity: randInt(1, 2) };
  });
  const totalCents = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  return { totalCents, currency: 'INR', items };
}

export function simulate(message: SendMessage): TimelineEvent[] {
  const rates = RATES[message.channel];
  const propensity =
    typeof message.context?.engagementPropensity === 'number'
      ? clamp(message.context.engagementPropensity as number, 0, 1)
      : 0.5;
  // 0.35x at propensity 0 → ~1.1x at propensity 1.
  const factor = clamp(0.35 + 0.75 * propensity, 0.2, 1.2);

  const events: TimelineEvent[] = [];
  let t = randInt(200, 800);
  events.push({ type: 'SENT', offsetMs: t });

  // Delivery vs hard failure.
  if (!chance(rates.deliver)) {
    t += randInt(1000, 4000);
    const bounced = chance(rates.bounceShare);
    events.push({
      type: bounced ? 'BOUNCED' : 'FAILED',
      offsetMs: t,
      metadata: { reason: bounced ? 'mailbox_unavailable' : 'carrier_rejected' },
    });
    return events;
  }
  t += randInt(1000, 5000);
  events.push({ type: 'DELIVERED', offsetMs: t });

  // View (open/read) — channel dependent.
  const viewType = viewEventType(message.channel);
  let viewed = false;
  if (viewType && chance(rates.view * factor)) {
    t += randInt(5000, 60000);
    events.push({ type: viewType, offsetMs: t, metadata: { device: pick(DEVICES) } });
    viewed = true;
  }

  // A viewer might unsubscribe instead of engaging further — terminal.
  if (viewed && chance(rates.unsub * factor)) {
    t += randInt(4000, 40000);
    events.push({ type: 'UNSUBSCRIBED', offsetMs: t, metadata: { reason: 'user_opt_out' } });
    return events;
  }

  // Click: SMS can be clicked straight off delivery (shortlink); others need a view.
  const clickEligible = message.channel === 'SMS' ? true : viewed;
  if (clickEligible && chance(rates.click * factor)) {
    t += randInt(2000, 30000);
    events.push({
      type: 'CLICKED',
      offsetMs: t,
      metadata: { url: 'https://brewandbean.example/offer', device: pick(DEVICES) },
    });

    // Conversion: an order placed because of this communication.
    if (chance(rates.convert * factor)) {
      t += randInt(30000, 600000);
      events.push({ type: 'CONVERTED', offsetMs: t, metadata: { order: fabricateOrder() } });
    }
  }

  return events;
}
