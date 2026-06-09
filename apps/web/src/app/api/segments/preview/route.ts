import { segmentDefinitionSchema } from '@cadence/shared';
import { z } from 'zod';
import { previewSegment } from '@/server/segments/evaluate';
import { ok, readJson, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

const schema = z.object({
  definition: segmentDefinitionSchema,
  take: z.number().int().min(0).max(50).optional(),
});

/**
 * Live audience preview for an unsaved definition — drives the "who's in this
 * segment" panel as the marketer edits the rule tree.
 */
export const POST = withErrors(async (req: Request) => {
  const { definition, take } = await readJson(req, schema);
  return ok(await previewSegment(definition, take ?? 8));
});
