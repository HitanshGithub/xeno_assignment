import { prisma, type Prisma } from '@cadence/db';
import { channelUsesEmail, type Channel, type SegmentDefinition } from '@cadence/shared';
import { compileSegment } from './compiler';

const DAY = 24 * 60 * 60 * 1000;

export interface CustomerPreview {
  id: string;
  name: string;
  city: string | null;
  orderCount: number;
  lifetimeValueCents: number;
  lastOrderAt: Date | null;
  daysSinceLastOrder: number | null;
}

/** How many customers match — the headline number on the segment card. */
export function countSegment(definition: SegmentDefinition, now = new Date()): Promise<number> {
  return prisma.customer.count({ where: compileSegment(definition, now) });
}

/** Count + a top-N sample (highest value first) for the audience preview. */
export async function previewSegment(
  definition: SegmentDefinition,
  take = 8,
  now = new Date(),
): Promise<{ total: number; sample: CustomerPreview[] }> {
  const where = compileSegment(definition, now);
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { lifetimeValueCents: 'desc' },
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        city: true,
        orderCount: true,
        lifetimeValueCents: true,
        lastOrderAt: true,
      },
    }),
  ]);

  const sample = rows.map((r) => ({
    id: r.id,
    name: [r.firstName, r.lastName].filter(Boolean).join(' '),
    city: r.city,
    orderCount: r.orderCount,
    lifetimeValueCents: r.lifetimeValueCents,
    lastOrderAt: r.lastOrderAt,
    daysSinceLastOrder: r.lastOrderAt
      ? Math.floor((now.getTime() - r.lastOrderAt.getTime()) / DAY)
      : null,
  }));

  return { total, sample };
}

export interface RecipientRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  orderCount: number;
  lifetimeValueCents: number;
  avgOrderValueCents: number;
  lastOrderAt: Date | null;
}

/**
 * The actual send list: matches the segment, is opted in, and has a usable
 * address for the chosen channel. Opt-out and missing-address filtering happens
 * here (never in the segment definition) so an audience count and a send list
 * can legitimately differ — and the marketer sees why.
 */
export function resolveRecipients(
  definition: SegmentDefinition,
  channel: Channel,
  now = new Date(),
): Promise<RecipientRow[]> {
  const addressFilter: Prisma.CustomerWhereInput = channelUsesEmail(channel)
    ? { email: { not: null } }
    : { phone: { not: null } };

  const where: Prisma.CustomerWhereInput = {
    AND: [compileSegment(definition, now), { marketingOptIn: true }, addressFilter],
  };

  return prisma.customer.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      city: true,
      orderCount: true,
      lifetimeValueCents: true,
      avgOrderValueCents: true,
      lastOrderAt: true,
    },
  });
}
