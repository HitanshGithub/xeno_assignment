import 'server-only';
import { z } from 'zod';

/**
 * Server-side configuration, parsed once. `server-only` guarantees this never
 * ends up in a client bundle. Everything has a dev default so the app boots
 * with an empty environment; production sets the real values.
 */
const schema = z.object({
  // Service-to-service wiring.
  CHANNEL_SERVICE_URL: z.string().url().default('http://localhost:4000'),
  CRM_BASE_URL: z.string().url().default('http://localhost:3000'),
  CHANNEL_SERVICE_API_KEY: z.string().min(1).default('dev-send-key-change-me'),
  CHANNEL_CALLBACK_SECRET: z.string().min(1).default('dev-callback-secret-change-me'),

  // AI provider.
  AI_PROVIDER: z.enum(['auto', 'anthropic', 'mock']).default('auto'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_REASONING: z.string().default('claude-sonnet-4-6'),
  AI_MODEL_DRAFT: z.string().default('claude-haiku-4-5-20251001'),
});

export const env = schema.parse(process.env);

/** Resolved AI mode: 'anthropic' only when a key is actually present. */
export function resolvedAiProvider(): 'anthropic' | 'mock' {
  if (env.AI_PROVIDER === 'mock') return 'mock';
  if (env.AI_PROVIDER === 'anthropic') return 'anthropic';
  // auto
  return env.ANTHROPIC_API_KEY ? 'anthropic' : 'mock';
}
