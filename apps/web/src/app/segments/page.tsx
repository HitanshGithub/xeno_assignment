'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Sparkles, Users, Wand2 } from 'lucide-react';
import type { SegmentDefinition } from '@cadence/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import type { SegmentItem } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '@/components/ui';
import { RuleView } from '@/components/rule-view';
import { AudiencePreview, type PreviewData } from '@/components/audience-preview';
import { relativeTime } from '@/lib/format';

interface AiSegmentResponse {
  plan: { name: string; description: string; combinator: 'AND' | 'OR'; conditions: SegmentDefinition['conditions'] };
  definition: SegmentDefinition;
  description: string;
  preview: PreviewData;
}

export default function SegmentsPage() {
  const { data, loading, refetch } = useApi<SegmentItem[]>('/api/segments');
  const [instruction, setInstruction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AiSegmentResponse | null>(null);

  async function generate() {
    if (!instruction.trim()) return;
    setGenerating(true);
    setDraft(null);
    try {
      setDraft(await api.post<AiSegmentResponse>('/api/ai/segment', { instruction }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api.post('/api/segments', {
        name: draft.plan.name,
        description: draft.description,
        source: 'AI',
        prompt: instruction,
        definition: draft.definition,
      });
      toast.success('Segment saved');
      setDraft(null);
      setInstruction('');
      void refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Segments"
        subtitle="Reusable audiences. Describe one in plain language — Cadence compiles it into transparent, editable rules."
      />

      {/* NL creator */}
      <Card className="mb-7 p-5">
        <div className="flex gap-2">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder="e.g. VIPs in Mumbai who haven't ordered in 3 weeks"
          />
          <Button onClick={generate} loading={generating} disabled={!instruction.trim()}>
            <Wand2 className="size-4" /> Compile
          </Button>
        </div>

        {draft && (
          <div className="mt-5 animate-fade-up border-t border-border pt-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-display text-lg text-ink">{draft.plan.name}</span>
              <Badge tone="brand">
                <Sparkles className="size-3" /> AI
              </Badge>
            </div>
            <div className="mb-3">
              <RuleView group={draft.definition} />
            </div>
            <AudiencePreview preview={draft.preview} />
            <div className="mt-4 flex justify-end">
              <Button onClick={save} loading={saving}>
                <Check className="size-4" /> Save segment
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Existing */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-display text-lg text-ink">{s.name}</span>
                <Badge tone={s.source === 'AI' ? 'brand' : 'neutral'}>{s.source === 'AI' ? 'AI' : 'Manual'}</Badge>
                <span className="ml-auto inline-flex items-center gap-1 text-sm text-ink-muted">
                  <Users className="size-3.5" /> {s.cachedCount ?? '—'}
                </span>
              </div>
              {s.description && <p className="mb-3 text-sm text-ink-muted">{s.description}</p>}
              <RuleView group={s.definition} />
              <div className="mt-3 text-xs text-ink-faint">Created {relativeTime(s.createdAt)}</div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="size-8" />}
          title="No segments yet"
          description="Compile one above, or let the co-pilot create one as part of a campaign."
        />
      )}
    </div>
  );
}
