import { z } from 'zod';
import { CHANNELS } from '@cadence/shared';
import { createCampaign, listCampaigns } from '@/server/campaigns';
import { ok, readJson, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

export const GET = withErrors(async () => ok(await listCampaigns()));

const createSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  channel: z.enum(CHANNELS),
  segmentId: z.string().optional(),
  messageSubject: z.string().optional(),
  messageBody: z.string().min(1),
  aiRationale: z.unknown().optional(),
});

export const POST = withErrors(async (req: Request) => {
  const body = await readJson(req, createSchema);
  const campaign = await createCampaign({
    ...body,
    aiRationale: body.aiRationale as never,
  });
  return ok(campaign, { status: 201 });
});
