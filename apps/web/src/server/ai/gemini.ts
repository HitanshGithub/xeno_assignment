import { GoogleGenAI } from '@google/genai';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { channelMeta, formatMoney } from '@cadence/shared';
import { env } from '../env';
import {
  campaignPlanSchema,
  messageDraftSchema,
  performanceInsightSchema,
  segmentPlanSchema,
  type CadenceAi,
  type CampaignPlan,
  type CompileSegmentInput,
  type DraftMessageInput,
  type InsightInput,
  type MessageDraft,
  type PerformanceInsight,
  type PlanCampaignInput,
  type SegmentPlan,
} from './types';
import { draftSystem, insightSystem, planSystem, segmentSystem } from './prompts';

/**
 * Google Gemini-backed AI (free-tier friendly). Same shared prompts as the
 * Anthropic provider; structure is enforced with Gemini's JSON output mode
 * (`responseMimeType: application/json`) plus the zod-derived JSON schema
 * inlined in the prompt, then re-validated through the same zod schema — so the
 * result is type-safe at our boundary regardless of provider. One Flash model
 * (env `GEMINI_MODEL`) serves every skill to stay well within the free tier.
 */
export class GeminiAi implements CadenceAi {
  readonly provider = 'gemini' as const;
  private readonly client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  private async object<T>(schema: z.ZodType<T>, system: string, prompt: string): Promise<T> {
    const { $schema: _drop, ...jsonSchema } = zodToJsonSchema(schema, {
      $refStrategy: 'none',
      target: 'jsonSchema7',
    }) as Record<string, unknown>;

    const contents =
      `${prompt}\n\nReturn ONLY a single JSON object that conforms to this JSON Schema. ` +
      `No markdown, no code fences, no commentary.\n\nJSON Schema:\n${JSON.stringify(jsonSchema)}`;

    const res = await this.client.models.generateContent({
      model: env.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        temperature: 0.6,
      },
    });

    const text = res.text?.trim();
    if (!text) throw new Error('Gemini returned no text');
    // JSON mode returns clean JSON; strip a stray code fence just in case.
    const json = text.startsWith('```') ? text.replace(/^```(?:json)?|```$/g, '').trim() : text;
    return schema.parse(JSON.parse(json));
  }

  compileSegment(input: CompileSegmentInput): Promise<SegmentPlan> {
    return this.object(
      segmentPlanSchema,
      segmentSystem(input.brand),
      `Marketer's request: "${input.instruction}"`,
    );
  }

  draftMessage(input: DraftMessageInput): Promise<MessageDraft> {
    const meta = channelMeta(input.channel);
    const prompt = [
      `Channel: ${meta.label}.`,
      `Audience: ${input.audienceDescription}.`,
      `Campaign goal: ${input.goal}.`,
      input.guidance ? `Marketer guidance: ${input.guidance}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return this.object(messageDraftSchema, draftSystem(input.brand), prompt);
  }

  summarizePerformance(input: InsightInput): Promise<PerformanceInsight> {
    const f = input.funnel;
    const prompt = [
      `Campaign: "${input.campaignName}" over ${channelMeta(input.channel).label}.`,
      input.goal ? `Goal: ${input.goal}.` : '',
      `Funnel — audience ${f.audience}, sent ${f.sent}, delivered ${f.delivered}, viewed ${f.viewed}, clicked ${f.clicked}, converted ${f.converted}, failed ${f.failed}, unsubscribed ${f.unsubscribed}.`,
      `Attributed revenue: ${f.attributedRevenueCents} paise (${formatMoney(f.attributedRevenueCents, input.brand.currency, { decimals: false })}).`,
    ]
      .filter(Boolean)
      .join('\n');
    return this.object(performanceInsightSchema, insightSystem(input.brand), prompt);
  }

  planCampaign(input: PlanCampaignInput): Promise<CampaignPlan> {
    return this.object(campaignPlanSchema, planSystem(input.brand), `Marketer's goal: "${input.goal}"`);
  }
}
