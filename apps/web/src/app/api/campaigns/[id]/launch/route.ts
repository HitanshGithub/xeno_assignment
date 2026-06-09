import { launchCampaign, LaunchError } from '@/server/campaigns';
import { ChannelError } from '@/server/channel/client';
import { HttpError, ok, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Fire the campaign. Maps the two expected failure modes to honest statuses:
 * a bad launch state (wrong status, no audience) → 409; the channel service
 * being unreachable → 502 (the campaign stays safe to retry).
 */
export const POST = withErrors(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    return ok(await launchCampaign(id));
  } catch (e) {
    if (e instanceof LaunchError) throw new HttpError(409, e.message);
    if (e instanceof ChannelError) throw new HttpError(502, 'channel service unavailable');
    throw e;
  }
});
