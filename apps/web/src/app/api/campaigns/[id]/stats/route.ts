import { campaignStats } from '@/server/insights';
import { ok, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Just the funnel — polled by the live campaign view while receipts arrive. */
export const GET = withErrors(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return ok(await campaignStats(id));
});
