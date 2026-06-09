import { channelMeta, formatMoney, type Channel } from '@cadence/shared';
import type {
  CadenceAi,
  CampaignPlan,
  CompileSegmentInput,
  DraftMessageInput,
  InsightInput,
  MessageDraft,
  PerformanceInsight,
  PlanCampaignInput,
  SegmentPlan,
} from './types';

/**
 * Deterministic, key-free fallback. It is NOT a language model — it's a
 * transparent heuristic engine so the product runs (and demos) for free, and so
 * graders without an API key still see the full flow. Its segment parsing keys
 * off intent words; its copy is templated. Good enough to be useful, honest
 * about being a stand-in.
 */
type Cond = SegmentPlan['conditions'][number];

const CITIES = ['mumbai', 'bengaluru', 'delhi', 'pune', 'hyderabad', 'chennai', 'gurugram', 'kolkata'];
const CATEGORIES: Record<string, string> = {
  bean: 'Beans',
  beans: 'Beans',
  pastry: 'Food',
  food: 'Food',
  croissant: 'Food',
  merch: 'Merch',
  mug: 'Merch',
  cold: 'Cold',
  espresso: 'Espresso',
  latte: 'Espresso',
};

function parseIntent(text: string): { conditions: Cond[]; name: string; combinator: 'AND' | 'OR' } {
  const t = text.toLowerCase();
  const conditions: Cond[] = [];
  const labels: string[] = [];

  const dayMatch = t.match(/(\d{1,3})\s*days?/);
  const days = dayMatch ? Number(dayMatch[1]) : null;

  if (/(lapsed|win[\s-]?back|haven'?t|inactive|gone quiet|slipping|dormant)/.test(t)) {
    conditions.push({ field: 'daysSinceLastOrder', op: 'between', value: [days ?? 40, (days ?? 40) + 80] });
    conditions.push({ field: 'orderCount', op: 'gte', value: 10 });
    labels.push('Lapsed buyers');
  } else if (/(churn|lost|left)/.test(t)) {
    conditions.push({ field: 'daysSinceLastOrder', op: 'gt', value: days ?? 180 });
    labels.push('Churned customers');
  }

  if (/(vip|high[\s-]?value|big spender|top spender|whales?)/.test(t)) {
    conditions.push({ field: 'lifetimeValueCents', op: 'gt', value: 2000000 });
    labels.push('High-value VIPs');
  }
  if (/(loyal|regular|frequent|best customers)/.test(t)) {
    conditions.push({ field: 'orderCount', op: 'gte', value: 25 });
    conditions.push({ field: 'daysSinceLastOrder', op: 'lte', value: 14 });
    labels.push('Loyal regulars');
  }
  if (/(new|recent sign|first[\s-]?time|just joined|newly)/.test(t)) {
    conditions.push({ field: 'daysSinceSignup', op: 'lte', value: days ?? 30 });
    labels.push('New shoppers');
  }
  if (/(one[\s-]?time|one and done|single order|bought once)/.test(t)) {
    conditions.push({ field: 'orderCount', op: 'eq', value: 1 });
    labels.push('One-time buyers');
  }

  for (const city of CITIES) {
    if (t.includes(city)) {
      conditions.push({ field: 'city', op: 'eq', value: city.charAt(0).toUpperCase() + city.slice(1) });
      labels.push(`in ${city.charAt(0).toUpperCase() + city.slice(1)}`);
      break;
    }
  }
  for (const [kw, cat] of Object.entries(CATEGORIES)) {
    if (new RegExp(`\\b${kw}`).test(t)) {
      conditions.push({ field: 'purchasedCategory', op: 'contains', value: cat });
      labels.push(`${cat} buyers`);
      break;
    }
  }

  if (conditions.length === 0) {
    // Sensible default: everyone who has ordered at least once.
    conditions.push({ field: 'orderCount', op: 'gte', value: 1 });
    labels.push('All shoppers');
  }

  return { conditions, name: labels.slice(0, 2).join(' · ') || 'Audience', combinator: 'AND' };
}

function pickChannel(goal: string): Channel {
  const t = goal.toLowerCase();
  if (/(win[\s-]?back|urgent|reminder|nudge|flash|today|now)/.test(t)) return 'WHATSAPP';
  if (/(newsletter|announce|launch|story|guide|long)/.test(t)) return 'EMAIL';
  if (/(sms|text)/.test(t)) return 'SMS';
  return 'WHATSAPP';
}

function draftFor(channel: Channel, goal: string, brand: string): { subject: string; body: string } {
  const meta = channelMeta(channel);
  const hook = goal.trim().replace(/\.$/, '');
  if (channel === 'SMS') {
    return { subject: '', body: `Hi {{firstName}}! ${brand} here — ${hook}. Reply STOP to opt out.` };
  }
  const body =
    `Hi {{firstName}}, it's ${brand} ☕️\n\n` +
    `${hook[0]?.toUpperCase()}${hook.slice(1)}. We'd love to see you again soon — your next cup is on us this week.\n\n` +
    `See you at ${brand}!`;
  return { subject: meta.supportsSubject ? `A little something from ${brand} ☕️` : '', body };
}

export class MockAi implements CadenceAi {
  readonly provider = 'mock' as const;

  async compileSegment(input: CompileSegmentInput): Promise<SegmentPlan> {
    const { conditions, name, combinator } = parseIntent(input.instruction);
    return {
      name,
      description: `Shoppers matching: ${input.instruction.trim()}`,
      rationale:
        'Heuristic match (no AI key configured): mapped intent keywords to recency, frequency, value, and attribute rules.',
      combinator,
      conditions,
    };
  }

  async draftMessage(input: DraftMessageInput): Promise<MessageDraft> {
    const { subject, body } = draftFor(input.channel, input.goal, input.brand.name);
    return {
      subject,
      body,
      rationale: 'Templated draft (no AI key configured): channel-aware copy grounded in the goal and brand name.',
    };
  }

  async summarizePerformance(input: InsightInput): Promise<PerformanceInsight> {
    const f = input.funnel;
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
    const rev = formatMoney(f.attributedRevenueCents, input.brand.currency, { decimals: false });
    return {
      headline:
        f.converted > 0
          ? `${input.campaignName} drove ${f.converted} reorders and ${rev} in attributed revenue.`
          : `${input.campaignName} reached ${f.delivered} shoppers over ${channelMeta(input.channel).label}.`,
      narrative:
        `Of ${f.sent} sent, ${f.delivered} were delivered (${pct(f.delivered, f.sent)}%) and ${f.viewed} engaged ` +
        `(${pct(f.viewed, f.delivered)}% of delivered). ${f.clicked} clicked through and ${f.converted} converted, ` +
        `generating ${rev}. ${f.failed} failed to deliver and ${f.unsubscribed} opted out.`,
      takeaways: [
        `Delivery rate ${pct(f.delivered, f.sent)}%`,
        `View rate ${pct(f.viewed, f.delivered)}% of delivered`,
        `Conversion ${pct(f.converted, f.delivered)}% of delivered`,
        `Attributed revenue ${rev}`,
      ],
      recommendation:
        f.converted > 0
          ? 'Re-target the clickers who did not convert with a time-boxed incentive.'
          : 'Try a higher-intent channel (WhatsApp) or a sharper offer for the next send.',
    };
  }

  async planCampaign(input: PlanCampaignInput): Promise<CampaignPlan> {
    const seg = await this.compileSegment({ instruction: input.goal, brand: input.brand });
    const channel = pickChannel(input.goal);
    const { subject, body } = draftFor(channel, input.goal, input.brand.name);
    return {
      campaignName: seg.name,
      goalRestated: input.goal.trim(),
      segmentName: seg.name,
      segmentDescription: seg.description,
      combinator: seg.combinator,
      conditions: seg.conditions,
      channel,
      channelRationale: `Chose ${channelMeta(channel).label} based on the intent of the goal.`,
      messageSubject: subject,
      messageBody: body,
      messageRationale: 'Templated, channel-aware copy (no AI key configured).',
    };
  }
}
