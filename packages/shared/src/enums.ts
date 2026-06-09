/**
 * Canonical string enums shared across both services.
 *
 * These values are kept byte-for-byte identical to the Prisma enums in
 * @cadence/db so a `Channel` from the wire can be used directly as a Prisma
 * enum. `@cadence/shared` intentionally has no dependency on the DB package —
 * the contract lives here, the persistence maps onto it.
 */

export const CHANNELS = ['WHATSAPP', 'SMS', 'EMAIL', 'RCS'] as const;
export type Channel = (typeof CHANNELS)[number];

export const EVENT_TYPES = [
  'QUEUED',
  'SENT',
  'DELIVERED',
  'OPENED',
  'READ',
  'CLICKED',
  'CONVERTED',
  'FAILED',
  'BOUNCED',
  'UNSUBSCRIBED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const COMMUNICATION_STATUSES = [
  'QUEUED',
  'SENT',
  'DELIVERED',
  'OPENED',
  'READ',
  'CLICKED',
  'CONVERTED',
  'FAILED',
  'BOUNCED',
] as const;
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];

export const CAMPAIGN_STATUSES = [
  'DRAFT',
  'LAUNCHING',
  'RUNNING',
  'COMPLETED',
  'CANCELLED',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
