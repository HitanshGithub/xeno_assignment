export { prisma } from './client';

// Re-export the generated client + model types + enums so the rest of the
// monorepo imports everything DB-related from a single entrypoint.
export {
  PrismaClient,
  Prisma,
  Channel,
  OrderSource,
  SegmentSource,
  CampaignStatus,
  CommunicationStatus,
  EventType,
} from '@prisma/client';

export type {
  Brand,
  Customer,
  Order,
  OrderItem,
  Segment,
  Campaign,
  Communication,
  CommunicationEvent,
} from '@prisma/client';
