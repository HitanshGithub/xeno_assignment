import { z } from 'zod';
import { getAi, toDefinition } from '@/server/ai';
import { getBrand } from '@/server/brand';
import { describeSegment } from '@/server/segments';
import { previewSegment } from '@/server/segments/evaluate';
import { ok, readJson, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

const schema = z.object({ instruction: z.string().min(1) });

/**
 * Natural language → a proposed audience, evaluated live. Returns the AI's plan,
 * the compiled rule tree, a plain-English description, and a real preview (count
 * + sample) so the marketer sees exactly who they'd reach before saving.
 */
export const POST = withErrors(async (req: Request) => {
  const { instruction } = await readJson(req, schema);
  const brand = await getBrand();

  const plan = await getAi().compileSegment({ instruction, brand });
  const definition = toDefinition(plan.combinator, plan.conditions);
  const preview = await previewSegment(definition, 8);

  return ok({ plan, definition, description: describeSegment(definition), preview });
});
