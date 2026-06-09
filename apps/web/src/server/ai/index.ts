import { resolvedAiProvider } from '../env';
import { AnthropicAi } from './anthropic';
import { MockAi } from './mock';
import type { CadenceAi } from './types';

let instance: CadenceAi | null = null;

/**
 * The single AI entrypoint for the app. Picks the real provider when a key is
 * present, otherwise the deterministic mock — so the product always works.
 */
export function getAi(): CadenceAi {
  if (!instance) {
    instance = resolvedAiProvider() === 'anthropic' ? new AnthropicAi() : new MockAi();
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
