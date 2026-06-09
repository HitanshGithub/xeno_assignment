import { z } from 'zod';
import { segmentDefinitionSchema } from '@cadence/shared';
import { createSegment, listSegments } from '@/server/segments';
import { ok, readJson, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

export const GET = withErrors(async () => ok(await listSegments()));

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  source: z.enum(['MANUAL', 'AI']).optional(),
  prompt: z.string().optional(),
  definition: segmentDefinitionSchema,
});

export const POST = withErrors(async (req: Request) => {
  const body = await readJson(req, createSchema);
  const segment = await createSegment(body);
  return ok(segment, { status: 201 });
});
