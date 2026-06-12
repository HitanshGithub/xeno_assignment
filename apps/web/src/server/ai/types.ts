import { z } from 'zod';
import {
  CHANNELS,
  FIELD_KEYS,
  OPERATORS,
  segmentDefinitionSchema,
  type Channel,
  type SegmentDefinition,
} from '@cadence/shared';

/**
 * AI I/O contracts.
 *
 * A note on shape: the Anthropic structured-output feature does not support
 * recursive JSON schemas, but the segment rule tree is recursive. So the AI
 * emits a *flat* group — a combinator plus a list of conditions — which is a
 * valid (un-nested) rule tree. `toDefinition()` lifts it into the shared
 * `SegmentDefinition` type; nested groups remain available for manual editing
 * in the UI. This keeps the model output reliable without losing expressivity
 * where it actually matters.
 */

export const aiConditionSchema = z.object({
  field: z.enum(FIELD_KEYS),
  op: z.enum(OPERATORS),
  value: z.union([z.number(), z.string(), z.boolean(), z.array(z.union([z.number(), z.string()]))]),
});

export const segmentPlanSchema = z.object({
  name: z.string(),
  description: z.string(),
  rationale: z.string(),
  combinator: z.enum(['AND', 'OR']),
  conditions: z.array(aiConditionSchema),
});
export type SegmentPlan = z.infer<typeof segmentPlanSchema>;

export const messageDraftSchema = z.object({
  /** Empty string when the channel has no subject line. */
  subject: z.string(),
  body: z.string(),
  rationale: z.string(),
});
export type MessageDraft = z.infer<typeof messageDraftSchema>;

export const performanceInsightSchema = z.object({
  headline: z.string(),
  narrative: z.string(),
  takeaways: z.array(z.string()),
  recommendation: z.string(),
});
export type PerformanceInsight = z.infer<typeof performanceInsightSchema>;

/** The agentic one-shot: a brief goal → a complete, editable campaign plan. */
export const campaignPlanSchema = z.object({
  campaignName: z.string(),
  goalRestated: z.string(),
  segmentName: z.string(),
  segmentDescription: z.string(),
  combinator: z.enum(['AND', 'OR']),
  conditions: z.array(aiConditionSchema),
  channel: z.enum(CHANNELS),
  channelRationale: z.string(),
  messageSubject: z.string(),
  messageBody: z.string(),
  messageRationale: z.string(),
});
export type CampaignPlan = z.infer<typeof campaignPlanSchema>;

/** Lift a flat plan's conditions into a validated rule tree. */
export function toDefinition(
  combinator: 'AND' | 'OR',
  conditions: SegmentPlan['conditions'],
): SegmentDefinition {
  return segmentDefinitionSchema.parse({ combinator, conditions });
}

// --- Inputs ----------------------------------------------------------------

export interface BrandContext {
  name: string;
  tagline?: string | null;
  description?: string | null;
  voice?: string | null;
  currency: string;
}

export interface CompileSegmentInput {
  instruction: string;
  brand: BrandContext;
}

export interface DraftMessageInput {
  goal: string;
  channel: Channel;
  audienceDescription: string;
  brand: BrandContext;
  /** Optional marketer steer ("make it playful", "mention 20% off"). */
  guidance?: string;
}

export interface InsightInput {
  campaignName: string;
  channel: Channel;
  goal?: string | null;
  funnel: {
    audience: number;
    sent: number;
    delivered: number;
    viewed: number;
    clicked: number;
    converted: number;
    failed: number;
    unsubscribed: number;
    attributedRevenueCents: number;
  };
  brand: BrandContext;
}

export interface PlanCampaignInput {
  goal: string;
  brand: BrandContext;
}

/**
 * The product's AI surface. Two implementations back it: a real Anthropic
 * provider and a deterministic mock, chosen at runtime by whether a key is
 * present. The rest of the app depends only on this interface.
 */
export interface CadenceAi {
  readonly provider: 'anthropic' | 'gemini' | 'mock';
  compileSegment(input: CompileSegmentInput): Promise<SegmentPlan>;
  draftMessage(input: DraftMessageInput): Promise<MessageDraft>;
  summarizePerformance(input: InsightInput): Promise<PerformanceInsight>;
  planCampaign(input: PlanCampaignInput): Promise<CampaignPlan>;
}
