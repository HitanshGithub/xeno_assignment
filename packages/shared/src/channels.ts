import type { Channel, EventType } from './enums';

/**
 * Per-channel behaviour. This is the single place that encodes how each channel
 * differs — what address it needs, whether it has a subject line, its body
 * limit, and crucially *which lifecycle events it can emit*.
 *
 * The differences are real and matter for the simulation and the stats:
 *  - Email reports OPENED (tracking pixel) but not READ.
 *  - WhatsApp / RCS report READ (blue ticks) but not OPENED.
 *  - SMS has delivery receipts and (via shortlink) clicks, but no open/read.
 */
export interface ChannelMeta {
  channel: Channel;
  label: string;
  /** What `recipient` must be for this channel. */
  addressType: 'email' | 'phone';
  /** Email-style subject line support. */
  supportsSubject: boolean;
  supportsRichMedia: boolean;
  /** Soft body length used for drafting guidance; SMS is the strict one. */
  maxBodyLength: number;
  /**
   * Ordered "happy path" engagement events this channel can report, after the
   * delivery confirmation. CONVERTED can follow any of these.
   */
  engagementStages: EventType[];
  /** Emoji/icon hint for the UI. */
  icon: string;
}

export const CHANNEL_META: Record<Channel, ChannelMeta> = {
  WHATSAPP: {
    channel: 'WHATSAPP',
    label: 'WhatsApp',
    addressType: 'phone',
    supportsSubject: false,
    supportsRichMedia: true,
    maxBodyLength: 1024,
    engagementStages: ['DELIVERED', 'READ', 'CLICKED'],
    icon: '💬',
  },
  RCS: {
    channel: 'RCS',
    label: 'RCS',
    addressType: 'phone',
    supportsSubject: false,
    supportsRichMedia: true,
    maxBodyLength: 1000,
    engagementStages: ['DELIVERED', 'READ', 'CLICKED'],
    icon: '📲',
  },
  SMS: {
    channel: 'SMS',
    label: 'SMS',
    addressType: 'phone',
    supportsSubject: false,
    supportsRichMedia: false,
    maxBodyLength: 160,
    engagementStages: ['DELIVERED', 'CLICKED'],
    icon: '✉️',
  },
  EMAIL: {
    channel: 'EMAIL',
    label: 'Email',
    addressType: 'email',
    supportsSubject: true,
    supportsRichMedia: true,
    maxBodyLength: 5000,
    engagementStages: ['DELIVERED', 'OPENED', 'CLICKED'],
    icon: '📧',
  },
};

export function channelMeta(channel: Channel): ChannelMeta {
  return CHANNEL_META[channel];
}

/** Does this channel expect an email address (vs a phone number)? */
export function channelUsesEmail(channel: Channel): boolean {
  return CHANNEL_META[channel].addressType === 'email';
}
