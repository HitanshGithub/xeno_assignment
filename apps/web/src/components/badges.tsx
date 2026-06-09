import { CHANNEL_META, type Channel, type CampaignStatus, type CommunicationStatus } from '@cadence/shared';
import { Badge } from './ui';

export function ChannelBadge({ channel }: { channel: Channel }) {
  const meta = CHANNEL_META[channel];
  return (
    <Badge tone="neutral">
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </Badge>
  );
}

const CAMPAIGN_TONE: Record<CampaignStatus, Parameters<typeof Badge>[0]['tone']> = {
  DRAFT: 'neutral',
  LAUNCHING: 'warn',
  RUNNING: 'brand',
  COMPLETED: 'accent',
  CANCELLED: 'danger',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <Badge tone={CAMPAIGN_TONE[status]}>
      {status === 'RUNNING' && <span className="size-1.5 animate-pulse-dot rounded-full bg-brand" />}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

const COMM_TONE: Record<CommunicationStatus, Parameters<typeof Badge>[0]['tone']> = {
  QUEUED: 'neutral',
  SENT: 'neutral',
  DELIVERED: 'info',
  OPENED: 'info',
  READ: 'info',
  CLICKED: 'brand',
  CONVERTED: 'accent',
  FAILED: 'danger',
  BOUNCED: 'danger',
};

export function CommStatusBadge({ status }: { status: CommunicationStatus }) {
  return <Badge tone={COMM_TONE[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}
