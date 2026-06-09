import { z } from 'zod';
import { CHANNELS } from '@cadence/shared';
import { getAi } from '@/server/ai';
import { getBrand } from '@/server/brand';
import { ok, readJson, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

const schema = z.object({
  goal: z.string().min(1),
  channel: z.enum(CHANNELS),
  audienceDescription: z.string().min(1),
  guidance: z.string().optional(),
});

/** Draft (or re-draft) a personalised message for a channel + audience. */
export const POST = withErrors(async (req: Request) => {
  const body = await readJson(req, schema);
  const brand = await getBrand();
  const draft = await getAi().draftMessage({ ...body, brand });
  return ok(draft);
});
