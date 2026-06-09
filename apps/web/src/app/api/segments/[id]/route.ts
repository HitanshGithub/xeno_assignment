import { z } from 'zod';
import { segmentDefinitionSchema } from '@cadence/shared';
import { deleteSegment, getSegment, updateSegment } from '@/server/segments';
import { previewSegment } from '@/server/segments/evaluate';
import { HttpError, ok, readJson, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrors(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const segment = await getSegment(id);
  if (!segment) throw new HttpError(404, 'segment_not_found');
  // Include a fresh preview so the detail view shows who's currently in.
  const preview = await previewSegment(segmentDefinitionSchema.parse(segment.definition), 10);
  return ok({ segment, preview });
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  definition: segmentDefinitionSchema.optional(),
});

export const PATCH = withErrors(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req, patchSchema);
  const segment = await updateSegment(id, body);
  return ok(segment);
});

export const DELETE = withErrors(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteSegment(id);
  return ok({ deleted: true });
});
