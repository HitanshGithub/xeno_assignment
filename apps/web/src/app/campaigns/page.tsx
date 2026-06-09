'use client';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import type { CampaignListItem } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { CampaignStatusBadge, ChannelBadge } from '@/components/badges';
import { relativeTime } from '@/lib/format';

export default function CampaignsPage() {
  const { data, loading } = useApi<CampaignListItem[]>('/api/campaigns');

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Campaigns"
        subtitle="Every send, with its audience, channel, and live state."
        actions={
          <Link href="/copilot">
            <Button>
              <Sparkles className="size-4" /> New campaign
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <Card>
          <ul className="divide-y divide-border">
            {data.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{c.name}</div>
                    {c.goal && <div className="mt-0.5 truncate text-sm text-ink-muted">{c.goal}</div>}
                    <div className="mt-1 text-xs text-ink-faint">
                      {c.segment?.name ?? 'No segment'}
                      {c.segment?.cachedCount != null && ` · ${c.segment.cachedCount} shoppers`} ·{' '}
                      {relativeTime(c.createdAt)}
                    </div>
                  </div>
                  <ChannelBadge channel={c.channel} />
                  <CampaignStatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          icon={<Sparkles className="size-8" />}
          title="No campaigns yet"
          description="Describe a goal in the co-pilot and Cadence will build the first one for you."
          action={
            <Link href="/copilot">
              <Button>Open the co-pilot</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
