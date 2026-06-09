import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic-backed AI. Every skill forces a typed object via a single-tool
 * `tool_choice`: we hand the model a tool whose `input_schema` is derived from
 * our zod schema and require it to call that tool, then validate the tool input
 * back through the same zod schema. So the model can only answer in the shape
 * we asked for, and the result is type-safe at our boundary — no free-text
 * parsing. Reasoning-heavy skills run on Sonnet; cheap drafting runs on Haiku —
 * a deliberate cost/latency split for an at-volume CRM.
 */
export class AnthropicAi implements CadenceAi {
  readonly provider = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  private async object<T>(
    schema: z.ZodType<T>,
    system: string,
    prompt: string,
    model: string,
  ): Promise<T> {
    // Drop the `$schema` meta key — Anthropic wants a bare object schema.
    const { $schema: _drop, ...inputSchema } = zodToJsonSchema(schema, {
      $refStrategy: 'none',
      target: 'jsonSchema7',
    }) as Record<string, unknown>;

    const res = await this.client.messages.create({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          name: 'emit_result',
          description: 'Return the structured result for this task.',
          input_schema: inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_result' },
    });

    const block = res.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      throw new Error('AI did not return a tool call');
    }
    // Validate the model's output against the same schema we asked for.
    return schema.parse(block.input);
  }

  compileSegment(input: CompileSegmentInput): Promise<SegmentPlan> {
    return this.object(
      segmentPlanSchema,
      segmentSystem(input.brand),
      `Marketer's request: "${input.instruction}"`,
      env.AI_MODEL_REASONING,
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
    return this.object(messageDraftSchema, draftSystem(input.brand), prompt, env.AI_MODEL_DRAFT);
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
    return this.object(
      performanceInsightSchema,
      insightSystem(input.brand),
      prompt,
      env.AI_MODEL_REASONING,
    );
  }

  planCampaign(input: PlanCampaignInput): Promise<CampaignPlan> {
    return this.object(
      campaignPlanSchema,
      planSystem(input.brand),
      `Marketer's goal: "${input.goal}"`,
      env.AI_MODEL_REASONING,
    );
  }
}
