import type {
  Channel,
  CampaignStatus,
  CommunicationStatus,
  SegmentDefinition,
} from '@cadence/shared';

/** Shapes the API returns (JSON — dates are ISO strings). Kept here so pages
 *  share one source of truth without importing the Prisma runtime client. */

export interface CampaignListItem {
  id: string;
  name: string;
  goal: string | null;
  status: CampaignStatus;
  channel: Channel;
  createdAt: string;
  launchedAt: string | null;
  completedAt: string | null;
  messageSubject: string | null;
  messageBody: string;
  segment?: { name: string; cachedCount: number | null } | null;
}

export interface CampaignDetail extends CampaignListItem {
  segmentId: string | null;
  aiRationale: unknown;
  segment?: {
    name: string;
    cachedCount: number | null;
    description: string | null;
    definition: SegmentDefinition;
  } | null;
}

export interface SegmentItem {
  id: string;
  name: string;
  description: string | null;
  source: 'MANUAL' | 'AI';
  prompt: string | null;
  definition: SegmentDefinition;
  cachedCount: number | null;
  cachedAt: string | null;
  createdAt: string;
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

export interface CampaignFunnel {
  audience: number;
  sent: number;
  delivered: number;
  viewed: number;
  clicked: number;
  converted: number;
  failed: number;
  unsubscribed: number;
  attributedRevenueCents: number;
  rates: {
    deliveryRate: number;
    viewRate: number;
    clickRate: number;
    conversionRate: number;
  };
}

export interface CommSample {
  id: string;
  recipient: string;
  status: CommunicationStatus;
  failureReason: string | null;
  updatedAt: string;
  customer: { firstName: string; lastName: string | null };
}

export interface MessageDraft {
  subject: string;
  body: string;
  rationale: string;
}

export interface PerformanceInsight {
  headline: string;
  narrative: string;
  takeaways: string[];
  recommendation: string;
}

export interface AiPlanResponse {
  plan: {
    campaignName: string;
    goalRestated: string;
    segmentName: string;
    segmentDescription: string;
    combinator: 'AND' | 'OR';
    conditions: SegmentDefinition['conditions'];
    channel: Channel;
    channelRationale: string;
    messageSubject: string;
    messageBody: string;
    messageRationale: string;
  };
  definition: SegmentDefinition;
  description: string;
  preview: {
    total: number;
    sample: Array<{
      id: string;
      name: string;
      city: string | null;
      orderCount: number;
      lifetimeValueCents: number;
      lastOrderAt: string | null;
      daysSinceLastOrder: number | null;
    }>;
  };
}
