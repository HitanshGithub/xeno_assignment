'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Lightbulb, MessageSquareText, Sparkles, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import type { CampaignDetail, CampaignFunnel, CommSample, PerformanceInsight } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button, Card, Skeleton } from '@/components/ui';
import { CampaignStatusBadge, ChannelBadge, CommStatusBadge } from '@/components/badges';
import { Funnel } from '@/components/funnel';
import { RuleView } from '@/components/rule-view';
import { relativeTime } from '@/lib/format';

interface DetailResponse {
  campaign: CampaignDetail;
  stats: CampaignFunnel;
  sample: CommSample[];
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useApi<DetailResponse>(`/api/campaigns/${id}`, { pollMs: 3500 });
  const [insight, setInsight] = useState<PerformanceInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  async function generateInsight() {
    setLoadingInsight(true);
    try {
      const res = await api.post<{ insight: PerformanceInsight }>(`/api/campaigns/${id}/insight`);
      setInsight(res.insight);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingInsight(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!data) return <p className="text-ink-muted">Campaign not found.</p>;

  const { campaign, stats, sample } = data;
  const live = campaign.status === 'RUNNING' || campaign.status === 'LAUNCHING';

  return (
    <div className="animate-fade-up">
      <Link
        href="/campaigns"
        className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Campaigns
      </Link>

      <PageHeader
        title={campaign.name}
        subtitle={campaign.goal ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <ChannelBadge channel={campaign.channel} />
            <CampaignStatusBadge status={campaign.status} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Funnel + insight */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-ink text-lg">Performance funnel</h3>
              {live && (
                <span className="text-brand inline-flex items-center gap-1.5 text-xs">
                  <span className="animate-pulse-dot bg-brand size-1.5 rounded-full" /> Live ·
                  updating as receipts arrive
                </span>
              )}
            </div>
            <Funnel data={stats} channel={campaign.channel} />
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="text-brand size-4" />
                <h3 className="font-display text-ink text-lg">AI insight</h3>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={generateInsight}
                loading={loadingInsight}
              >
                <Sparkles className="size-3.5" /> {insight ? 'Refresh' : 'Read the results'}
              </Button>
            </div>
            {insight ? (
              <div className="space-y-3">
                <p className="font-display text-ink text-lg">{insight.headline}</p>
                <p className="text-ink-muted text-sm leading-relaxed">{insight.narrative}</p>
                <ul className="flex flex-wrap gap-2">
                  {insight.takeaways.map((t, i) => (
                    <li
                      key={i}
                      className="border-border bg-surface-2 text-ink-muted rounded-full border px-2.5 py-1 text-xs"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="border-brand/25 bg-brand-soft/40 rounded-lg border px-3 py-2.5 text-sm">
                  <span className="text-brand font-medium">Recommended next: </span>
                  <span className="text-ink">{insight.recommendation}</span>
                </div>
              </div>
            ) : (
              <p className="text-ink-faint text-sm">
                Let Cadence read this campaign&apos;s funnel and tell you what worked and what to do
                next.
              </p>
            )}
          </Card>

          {/* Communications */}
          <Card className="p-5">
            <h3 className="font-display text-ink mb-3 text-lg">Recent communications</h3>
            {sample.length > 0 ? (
              <div className="border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <tbody>
                    {sample.map((c) => (
                      <tr key={c.id} className="border-border/60 border-b last:border-0">
                        <td className="text-ink px-3 py-2">
                          {c.customer.firstName} {c.customer.lastName ?? ''}
                        </td>
                        <td className="text-ink-faint px-3 py-2">{c.recipient}</td>
                        <td className="text-ink-faint px-3 py-2 text-right text-xs">
                          {relativeTime(c.updatedAt)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <CommStatusBadge status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-ink-faint text-sm">No communications yet.</p>
            )}
          </Card>
        </div>

        {/* Right rail: message + audience + rationale */}
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="text-brand size-4" />
              <h3 className="font-display text-ink text-lg">Message</h3>
            </div>
            {campaign.messageSubject && (
              <div className="mb-2 text-sm">
                <span className="text-ink-faint">Subject: </span>
                <span className="text-ink">{campaign.messageSubject}</span>
              </div>
            )}
            <div className="border-border bg-surface-2 text-ink rounded-lg border p-3 text-sm whitespace-pre-wrap">
              {campaign.messageBody}
            </div>
          </Card>

          {campaign.segment && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Target className="text-brand size-4" />
                <h3 className="font-display text-ink text-lg">Audience</h3>
                <span className="text-ink-faint ml-auto text-xs">
                  {campaign.segment.cachedCount ?? '—'} shoppers
                </span>
              </div>
              <div className="text-ink-muted mb-2 text-sm">{campaign.segment.name}</div>
              <RuleView group={campaign.segment.definition} />
            </Card>
          )}

          {isRationale(campaign.aiRationale) && (
            <Card className="p-5">
              <h3 className="font-display text-ink mb-2 text-lg">Why this plan</h3>
              <dl className="space-y-2 text-sm">
                {campaign.aiRationale.channel && (
                  <Rationale label="Channel" text={campaign.aiRationale.channel} />
                )}
                {campaign.aiRationale.message && (
                  <Rationale label="Message" text={campaign.aiRationale.message} />
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Rationale({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <dt className="text-ink-faint text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-ink-muted">{text}</dd>
    </div>
  );
}

function isRationale(v: unknown): v is { channel?: string; message?: string } {
  return typeof v === 'object' && v !== null && ('channel' in v || 'message' in v);
}
