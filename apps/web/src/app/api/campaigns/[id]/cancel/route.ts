import { cancelCampaign, CancelError } from '@/server/campaigns';
import { HttpError, ok, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrors(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  try {
    return ok(await cancelCampaign(id));
  } catch (e) {
    if (e instanceof CancelError) throw new HttpError(409, e.message);
    throw e;
  }
});
