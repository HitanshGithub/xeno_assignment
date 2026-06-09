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
          <ul className="divide-border divide-y">
            {data.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="hover:bg-surface-2 flex items-center gap-4 px-5 py-4 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-ink truncate font-medium">{c.name}</div>
                    {c.goal && (
                      <div className="text-ink-muted mt-0.5 truncate text-sm">{c.goal}</div>
                    )}
                    <div className="text-ink-faint mt-1 text-xs">
                      {c.segment?.name ?? 'No segment'}
                      {c.segment?.cachedCount != null &&
                        ` · ${c.segment.cachedCount} shoppers`} · {relativeTime(c.createdAt)}
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
