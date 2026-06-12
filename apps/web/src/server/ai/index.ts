import { resolvedAiProvider } from '../env';
import { AnthropicAi } from './anthropic';
import { GeminiAi } from './gemini';
import { MockAi } from './mock';
import type { CadenceAi } from './types';

let instance: CadenceAi | null = null;

/**
 * The single AI entrypoint for the app. Picks a real provider (Anthropic or
 * Gemini) when its key is present, otherwise the deterministic mock — so the
 * product always works.
 */
export function getAi(): CadenceAi {
  if (!instance) {
    const provider = resolvedAiProvider();
    instance =
      provider === 'anthropic'
        ? new AnthropicAi()
        : provider === 'gemini'
          ? new GeminiAi()
          : new MockAi();
  }
  return instance;
}

export type {
  CadenceAi,
  SegmentPlan,
  MessageDraft,
  PerformanceInsight,
  CampaignPlan,
  BrandContext,
} from './types';
export { toDefinition } from './types';
