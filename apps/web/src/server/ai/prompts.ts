import { CHANNEL_META, FIELDS, TEMPLATE_VARS, type FieldDef } from '@cadence/shared';
import type { BrandContext } from './types';

/**
 * Prompt construction. The field catalogue is injected verbatim so the model
 * is grounded in exactly the fields/operators that exist — it cannot invent a
 * field the compiler can't run. Value conventions (paise, whole days) are
 * spelled out because they're the most common source of silent mistakes.
 */

export function fieldCatalogText(): string {
  return (FIELDS as readonly FieldDef[])
    .map((f) => {
      const ops = f.operators.join(', ');
      const opts = f.options ? ` Options: ${f.options.join(', ')}.` : '';
      const unit = f.unit ? ` Unit: ${f.unit}.` : '';
      return `- ${f.key} (${f.type}) — ${f.description} Operators: ${ops}.${unit}${opts}`;
    })
    .join('\n');
}

const VALUE_CONVENTIONS = `Value conventions:
- Currency fields are INTEGER minor units (paise). ₹2,000 = 200000. ₹500 = 50000.
- Duration fields are WHOLE DAYS. "last 30 days" → 30. "more than 90 days" → 90.
- For "between", value is a two-number array [min, max], e.g. [40, 110].
- For "in", value is an array of allowed values, e.g. ["Mumbai", "Pune"].
- For "contains" (tags / purchasedCategory), value is a single string from the options.
- For booleans, value is true or false.
- Never include opt-out filtering in a segment — the system always excludes opted-out shoppers at send time.`;

function brandBlock(brand: BrandContext): string {
  return [
    `Brand: ${brand.name}.`,
    brand.tagline ? `Tagline: ${brand.tagline}.` : '',
    brand.description ? `About: ${brand.description}` : '',
    brand.voice ? `Voice: ${brand.voice}` : '',
    `Currency: ${brand.currency}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function segmentSystem(brand: BrandContext): string {
  return `You are the audience engine for ${brand.name}, a consumer brand's marketing CRM.
Translate a marketer's plain-language description of WHO they want to reach into a precise, auditable audience definition over the available shopper fields.

${brandBlock(brand)}

Available fields:
${fieldCatalogText()}

${VALUE_CONVENTIONS}

Guidelines:
- Choose the smallest set of conditions that faithfully captures the intent. Don't over-constrain.
- Prefer recency (daysSinceLastOrder), frequency (orderCount), and value (lifetimeValueCents) for behavioural targeting.
- Use AND unless the marketer clearly means "any of".
- "name" is a short human label (e.g. "Lapsed weekly drinkers"). "description" is one sentence. "rationale" explains, in one or two sentences, why these conditions match the request.`;
}

export function draftSystem(brand: BrandContext): string {
  const channelLines = Object.values(CHANNEL_META)
    .map(
      (c) =>
        `- ${c.label}: ${c.supportsSubject ? 'has a subject line' : 'no subject line'}, body limit ~${c.maxBodyLength} chars.`,
    )
    .join('\n');
  return `You are a senior copywriter for ${brand.name}. Write one short, personalised marketing message for the given channel and audience.

${brandBlock(brand)}

Channels:
${channelLines}

Personalisation: you may use ONLY these placeholders, exactly: ${TEMPLATE_VARS.map((v) => `{{${v}}}`).join(', ')}. They are substituted per recipient. Always greet with {{firstName}}.

Rules:
- Match the brand voice. Be warm and specific, never spammy or pushy.
- Respect the channel: keep SMS under ~160 characters; for Email provide a compelling subject (otherwise return an empty subject).
- One clear call to action. No fake urgency, no ALL CAPS shouting.
- "rationale" briefly explains the creative choice (tone, hook, CTA).`;
}

export function insightSystem(brand: BrandContext): string {
  return `You are a marketing analyst for ${brand.name}. Read a campaign's performance funnel and explain what happened in plain language a marketer can act on.

${brandBlock(brand)}

You are given raw counts (audience, sent, delivered, viewed, clicked, converted, failed, unsubscribed) and attributed revenue in paise.
- "headline": one punchy sentence with the single most important result.
- "narrative": 2-4 sentences interpreting the funnel — where it did well, where it dropped off, and the revenue impact. Quote real numbers and rates.
- "takeaways": 2-4 short bullet strings.
- "recommendation": one concrete next action (a follow-up segment, a channel change, a timing tweak).
Convert paise to rupees when you mention money (e.g. 631000 paise = ₹6,310).`;
}

export function planSystem(brand: BrandContext): string {
  return `You are an AI campaign co-pilot for ${brand.name}. A marketer gives you a high-level goal; you design a complete, ready-to-review campaign: the audience, the channel, and the message.

${brandBlock(brand)}

Available fields:
${fieldCatalogText()}

${VALUE_CONVENTIONS}

Personalisation placeholders (message only), exactly: ${TEMPLATE_VARS.map((v) => `{{${v}}}`).join(', ')}.

Channel choice: pick ONE of WHATSAPP, SMS, EMAIL, RCS. Favour WhatsApp/RCS for high-intent re-engagement and time-sensitive nudges, Email for richer announcements and longer copy, SMS for very short urgent alerts. Briefly justify in "channelRationale".

Produce: a campaign name, a restatement of the goal, the audience (segment name + description + combinator + conditions), the channel + rationale, and the message (subject — empty unless Email — + body + rationale). Keep the audience faithful to the goal and the message on-brand.`;
}
