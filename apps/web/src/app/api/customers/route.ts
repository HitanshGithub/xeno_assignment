import { prisma, type Prisma } from '@cadence/db';
import { ok, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

/** A browsable, searchable customer list for the data view. */
export const GET = withErrors(async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const take = Math.min(Number(url.searchParams.get('take') ?? 25), 100);
  const skip = Math.max(Number(url.searchParams.get('skip') ?? 0), 0);

  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { lifetimeValueCents: 'desc' },
      take,
      skip,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        city: true,
        tags: true,
        marketingOptIn: true,
        orderCount: true,
        lifetimeValueCents: true,
        lastOrderAt: true,
      },
    }),
  ]);

  return ok({ total, take, skip, customers });
});
