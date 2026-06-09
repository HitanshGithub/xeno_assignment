import { z } from 'zod';
import { getAi, toDefinition } from '@/server/ai';
import { getBrand } from '@/server/brand';
import { describeSegment } from '@/server/segments';
import { previewSegment } from '@/server/segments/evaluate';
import { ok, readJson, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

const schema = z.object({ goal: z.string().min(1) });

/**
 * The co-pilot: a one-line goal becomes a complete, editable campaign plan —
 * audience (compiled + previewed), channel (with rationale), and message. The
 * marketer reviews and edits every part before launching.
 */
export const POST = withErrors(async (req: Request) => {
  const { goal } = await readJson(req, schema);
  const brand = await getBrand();

  const plan = await getAi().planCampaign({ goal, brand });
  const definition = toDefinition(plan.combinator, plan.conditions);
  const preview = await previewSegment(definition, 8);

  return ok({ plan, definition, description: describeSegment(definition), preview });
});
