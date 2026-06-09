import { dashboardStats } from '@/server/insights';
import { listCampaigns } from '@/server/campaigns';
import { ok, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Headline stats + the most recent campaigns for the home dashboard. */
export const GET = withErrors(async () => {
  const [stats, campaigns] = await Promise.all([dashboardStats(), listCampaigns()]);
  return ok({ stats, campaigns: campaigns.slice(0, 6) });
});
