import { prisma } from '@cadence/db';

/**
 * Recompute a customer's denormalised RFM rollups from their orders. Called
 * after any write that changes a customer's order history (ingestion, and an
 * attributed conversion). Keeping this the single writer of the rollups bounds
 * the cost of denormalisation.
 */
export async function recomputeRollups(customerId: string): Promise<void> {
  const agg = await prisma.order.aggregate({
    where: { customerId },
    _count: { _all: true },
    _sum: { totalCents: true },
    _min: { orderedAt: true },
    _max: { orderedAt: true },
  });

  const orderCount = agg._count._all;
  const lifetime = agg._sum.totalCents ?? 0;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      orderCount,
      lifetimeValueCents: lifetime,
      firstOrderAt: agg._min.orderedAt ?? null,
      lastOrderAt: agg._max.orderedAt ?? null,
      avgOrderValueCents: orderCount > 0 ? Math.round(lifetime / orderCount) : 0,
    },
  });
}
