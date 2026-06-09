import { getCampaign } from '@/server/campaigns';
import { campaignStats } from '@/server/insights';
import { getAi } from '@/server/ai';
import { getBrand } from '@/server/brand';
import { HttpError, ok, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** AI narrative read of a campaign's performance, grounded in its real funnel. */
export const POST = withErrors(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const campaign = await getCampaign(id);
  if (!campaign) throw new HttpError(404, 'campaign_not_found');

  const [funnel, brand] = await Promise.all([campaignStats(id), getBrand()]);
  const insight = await getAi().summarizePerformance({
    campaignName: campaign.name,
    channel: campaign.channel,
    goal: campaign.goal,
    funnel,
    brand,
  });
  return ok({ insight, funnel });
});
