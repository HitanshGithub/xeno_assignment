import { prisma } from '@cadence/db';

/**
 * Performance insights, derived from the projected timestamps on each
 * communication (set when the corresponding receipt landed, regardless of
 * order) plus attributed orders. Counting non-null stage timestamps — rather
 * than the single current `status` — gives an accurate funnel even though a
 * communication only ever holds one status at a time.
 */

export interface CampaignFunnel {
  audience: number;
  sent: number;
  delivered: number;
  viewed: number; // opened (email) or read (messaging)
  clicked: number;
  converted: number;
  failed: number;
  unsubscribed: number;
  attributedRevenueCents: number;
  rates: {
    deliveryRate: number; // delivered / sent
    viewRate: number; // viewed / delivered
    clickRate: number; // clicked / delivered
    conversionRate: number; // converted / delivered
  };
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

export async function campaignStats(campaignId: string): Promise<CampaignFunnel> {
  const base = { campaignId } as const;
  const [audience, sent, delivered, viewed, clicked, converted, failed, unsubscribed, revenue] =
    await Promise.all([
      prisma.communication.count({ where: base }),
      prisma.communication.count({ where: { ...base, sentAt: { not: null } } }),
      prisma.communication.count({ where: { ...base, deliveredAt: { not: null } } }),
      prisma.communication.count({
        where: { ...base, OR: [{ openedAt: { not: null } }, { readAt: { not: null } }] },
      }),
      prisma.communication.count({ where: { ...base, clickedAt: { not: null } } }),
      prisma.communication.count({ where: { ...base, convertedAt: { not: null } } }),
      prisma.communication.count({ where: { ...base, status: { in: ['FAILED', 'BOUNCED'] } } }),
      prisma.communicationEvent.count({
        where: { type: 'UNSUBSCRIBED', communication: { campaignId } },
      }),
      prisma.order.aggregate({
        where: { attributedCommunication: { campaignId } },
        _sum: { totalCents: true },
      }),
    ]);

  const attributedRevenueCents = revenue._sum.totalCents ?? 0;

  return {
    audience,
    sent,
    delivered,
    viewed,
    clicked,
    converted,
    failed,
    unsubscribed,
    attributedRevenueCents,
    rates: {
      deliveryRate: ratio(delivered, sent),
      viewRate: ratio(viewed, delivered),
      clickRate: ratio(clicked, delivered),
      conversionRate: ratio(converted, delivered),
    },
  };
}

export interface DashboardStats {
  customers: number;
  optedIn: number;
  campaigns: number;
  campaignsRunning: number;
  messagesSent: number;
  delivered: number;
  clicked: number;
  converted: number;
  attributedRevenueCents: number;
}

export async function dashboardStats(): Promise<DashboardStats> {
  const [
    customers,
    optedIn,
    campaigns,
    campaignsRunning,
    messagesSent,
    delivered,
    clicked,
    converted,
    revenue,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { marketingOptIn: true } }),
    prisma.campaign.count(),
    prisma.campaign.count({ where: { status: { in: ['LAUNCHING', 'RUNNING'] } } }),
    prisma.communication.count({ where: { sentAt: { not: null } } }),
    prisma.communication.count({ where: { deliveredAt: { not: null } } }),
    prisma.communication.count({ where: { clickedAt: { not: null } } }),
    prisma.communication.count({ where: { convertedAt: { not: null } } }),
    prisma.order.aggregate({
      where: { channel: 'CAMPAIGN_ATTRIBUTED' },
      _sum: { totalCents: true },
    }),
  ]);

  return {
    customers,
    optedIn,
    campaigns,
    campaignsRunning,
    messagesSent,
    delivered,
    clicked,
    converted,
    attributedRevenueCents: revenue._sum.totalCents ?? 0,
  };
}
