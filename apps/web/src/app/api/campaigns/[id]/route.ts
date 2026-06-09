import { z } from 'zod';
import { prisma } from '@cadence/db';
import { CHANNELS } from '@cadence/shared';
import { deleteCampaign, getCampaign, updateCampaign } from '@/server/campaigns';
import { campaignStats } from '@/server/insights';
import { HttpError, ok, readJson, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Campaign detail: the record, its live funnel, and a recent-communications sample. */
export const GET = withErrors(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const campaign = await getCampaign(id);
  if (!campaign) throw new HttpError(404, 'campaign_not_found');

  const [stats, sample] = await Promise.all([
    campaignStats(id),
    prisma.communication.findMany({
      where: { campaignId: id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        recipient: true,
        status: true,
        failureReason: true,
        updatedAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return ok({ campaign, stats, sample });
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional(),
  channel: z.enum(CHANNELS).optional(),
  segmentId: z.string().optional(),
  messageSubject: z.string().optional(),
  messageBody: z.string().min(1).optional(),
});

export const PATCH = withErrors(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req, patchSchema);
  try {
    return ok(await updateCampaign(id, body));
  } catch (e) {
    throw new HttpError(409, e instanceof Error ? e.message : 'cannot_update');
  }
});

export const DELETE = withErrors(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteCampaign(id);
  return ok({ deleted: true });
});
