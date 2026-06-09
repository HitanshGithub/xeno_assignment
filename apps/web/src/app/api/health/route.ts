import { prisma } from '@cadence/db';
import { resolvedAiProvider } from '@/server/env';
import { ok, fail } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Liveness + a quick DB ping and the resolved AI provider. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: 'ok', db: 'up', ai: resolvedAiProvider() });
  } catch {
    return fail(503, 'db_unavailable');
  }
}
