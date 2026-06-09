'use client';
import Link from 'next/link';
import { ArrowRight, IndianRupee, MousePointerClick, Send, Sparkles, Users } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import type { CampaignListItem, DashboardStats } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button, Card, Skeleton, Stat } from '@/components/ui';
import { CampaignStatusBadge, ChannelBadge } from '@/components/badges';
import { money, pct, relativeTime } from '@/lib/format';

interface DashboardResponse {
  stats: DashboardStats;
  campaigns: CampaignListItem[];
}

export default function DashboardPage() {
  const { data, loading } = useApi<DashboardResponse>('/api/dashboard');

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Good to see you"
        subtitle="Your engagement at a glance — and a one-line path to the next campaign."
        actions={
          <Link href="/copilot">
            <Button>
              <Sparkles className="size-4" /> New campaign
            </Button>
          </Link>
        }
      />

      {/* Co-pilot CTA */}
      <Card className="mb-8 overflow-hidden">
        <Link href="/copilot" className="group flex items-center gap-5 p-6">
          <span className="bg-brand-soft text-brand grid size-12 shrink-0 place-items-center rounded-xl">
            <Sparkles className="size-6" />
          </span>
          <div className="flex-1">
            <div className="font-display text-ink text-xl">Describe a goal, ship a campaign</div>
            <p className="text-ink-muted mt-0.5 text-sm">
              “Win back lapsed weekly drinkers with a cold-brew offer” → audience, message, channel,
              sent.
            </p>
          </div>
          <ArrowRight className="text-ink-faint group-hover:text-brand size-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </Card>

      {/* Stats */}
      {loading || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Shoppers"
            value={data.stats.customers.toLocaleString('en-IN')}
            sub={`${pct(data.stats.optedIn, data.stats.customers)} opted in`}
            icon={<Users className="size-5" />}
          />
          <Stat
            label="Messages sent"
            value={data.stats.messagesSent.toLocaleString('en-IN')}
            sub={`${pct(data.stats.delivered, data.stats.messagesSent)} delivered`}
            icon={<Send className="size-5" />}
          />
          <Stat
            label="Conversions"
            value={data.stats.converted.toLocaleString('en-IN')}
            sub={`${data.stats.clicked.toLocaleString('en-IN')} clicks`}
            icon={<MousePointerClick className="size-5" />}
          />
          <Stat
            label="Attributed revenue"
            value={money(data.stats.attributedRevenueCents)}
            sub="from campaigns"
            icon={<IndianRupee className="size-5" />}
          />
        </div>
      )}

      {/* Recent campaigns */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-ink text-xl">Recent campaigns</h2>
          <Link href="/campaigns" className="text-ink-muted hover:text-brand text-sm">
            View all →
          </Link>
        </div>
        {loading ? (
          <Skeleton className="h-40" />
        ) : data && data.campaigns.length > 0 ? (
          <Card>
            <ul className="divide-border divide-y">
              {data.campaigns.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="hover:bg-surface-2 flex items-center gap-4 px-5 py-4 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-ink truncate font-medium">{c.name}</div>
                      <div className="text-ink-faint mt-0.5 truncate text-xs">
                        {c.segment?.name ?? 'No segment'} · {relativeTime(c.createdAt)}
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
          <Card className="text-ink-muted p-10 text-center text-sm">
            No campaigns yet — start one from the Co-pilot.
          </Card>
        )}
      </div>
    </div>
  );
}
