'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  MessageSquareText,
  Pencil,
  Rocket,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react';
import {
  CHANNELS,
  CHANNEL_META,
  TEMPLATE_VARS,
  channelMeta,
  type Channel,
} from '@cadence/shared';
import { api } from '@/lib/api';
import type { AiPlanResponse, MessageDraft } from '@/lib/types';
import type { SegmentDefinition } from '@cadence/shared';
import { PageHeader } from '@/components/page-header';
import { Button, Card, Field, Input, Textarea } from '@/components/ui';
import { RuleView } from '@/components/rule-view';
import { AudiencePreview } from '@/components/audience-preview';
import { ChannelBadge } from '@/components/badges';

const EXAMPLES = [
  'Win back lapsed weekly drinkers with a cold-brew offer',
  'Reward our VIPs in Mumbai with early access to the new roast',
  'Welcome shoppers who joined in the last 30 days',
  'Re-engage customers who bought beans but went quiet for 2 months',
];

type Phase = 'idle' | 'planning' | 'review';

export default function CopilotPage() {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [plan, setPlan] = useState<AiPlanResponse | null>(null);

  // Editable campaign fields (seeded from the AI plan, owned by the marketer).
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<Channel>('WHATSAPP');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [guidance, setGuidance] = useState('');
  const [redrafting, setRedrafting] = useState(false);
  const [launching, setLaunching] = useState(false);

  async function generate(g: string) {
    const text = g.trim();
    if (!text) return;
    setGoal(text);
    setPhase('planning');
    setPlan(null);
    try {
      const res = await api.post<AiPlanResponse>('/api/ai/plan', { goal: text });
      setPlan(res);
      setName(res.plan.campaignName);
      setChannel(res.plan.channel);
      setSubject(res.plan.messageSubject);
      setBody(res.plan.messageBody);
      setPhase('review');
    } catch (e) {
      toast.error(`Couldn't plan that: ${(e as Error).message}`);
      setPhase('idle');
    }
  }

  async function redraft() {
    if (!plan) return;
    setRedrafting(true);
    try {
      const draft = await api.post<MessageDraft>('/api/ai/draft', {
        goal: plan.plan.goalRestated,
        channel,
        audienceDescription: plan.description,
        guidance: guidance.trim() || undefined,
      });
      setSubject(draft.subject);
      setBody(draft.body);
      toast.success('Message redrafted');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRedrafting(false);
    }
  }

  async function launch() {
    if (!plan) return;
    setLaunching(true);
    try {
      const segment = await api.post<{ id: string }>('/api/segments', {
        name: plan.plan.segmentName,
        description: plan.plan.segmentDescription,
        source: 'AI',
        prompt: goal,
        definition: plan.definition as SegmentDefinition,
      });
      const campaign = await api.post<{ id: string }>('/api/campaigns', {
        name,
        goal: plan.plan.goalRestated,
        channel,
        segmentId: segment.id,
        messageSubject: channelMeta(channel).supportsSubject && subject ? subject : undefined,
        messageBody: body,
        aiRationale: {
          segment: plan.plan.segmentDescription,
          channel: plan.plan.channelRationale,
          message: plan.plan.messageRationale,
        },
      });
      await api.post(`/api/campaigns/${campaign.id}/launch`);
      toast.success('Campaign launched — watching delivery live');
      router.push(`/campaigns/${campaign.id}`);
    } catch (e) {
      toast.error(`Launch failed: ${(e as Error).message}`);
      setLaunching(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Campaign co-pilot"
        subtitle="Describe what you want to achieve. Cadence proposes the audience, the channel, and the message — you review and ship."
      />

      {/* Goal input */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <Sparkles className="size-5" />
          </span>
          <div className="flex-1">
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(goal);
              }}
              placeholder="e.g. Win back lapsed weekly drinkers with a cold-brew offer…"
              rows={2}
              className="resize-none border-0 bg-transparent px-0 text-base focus:ring-0"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-ink-faint">⌘/Ctrl + Enter to generate</span>
              <Button onClick={() => generate(goal)} loading={phase === 'planning'} disabled={!goal.trim()}>
                <Wand2 className="size-4" /> Generate plan
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {phase === 'idle' && (
        <div className="mt-5">
          <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">Try one of these</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => generate(ex)}
                className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-brand/40 hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'planning' && (
        <div className="mt-6 flex items-center gap-3 text-ink-muted">
          <Sparkles className="size-5 animate-pulse-dot text-brand" />
          Designing your campaign — audience, channel, and message…
        </div>
      )}

      {phase === 'review' && plan && (
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          {/* Left: audience + channel */}
          <div className="space-y-5 lg:col-span-3">
            <Card className="p-5">
              <SectionTitle icon={<Target className="size-4" />} title="Audience" hint={plan.plan.segmentName} />
              <p className="mb-3 text-sm text-ink-muted">{plan.description}.</p>
              <div className="mb-4">
                <RuleView group={plan.definition} />
              </div>
              <AudiencePreview preview={plan.preview} />
            </Card>

            <Card className="p-5">
              <SectionTitle icon={<ArrowRight className="size-4" />} title="Channel" />
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      channel === ch
                        ? 'border-brand bg-brand-soft text-ink'
                        : 'border-border bg-surface-2 text-ink-muted hover:text-ink'
                    }`}
                  >
                    <span>{CHANNEL_META[ch].icon}</span>
                    {CHANNEL_META[ch].label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-faint">{plan.plan.channelRationale}</p>
            </Card>
          </div>

          {/* Right: message + launch */}
          <div className="space-y-5 lg:col-span-2">
            <Card className="p-5">
              <SectionTitle icon={<MessageSquareText className="size-4" />} title="Message" />
              <div className="space-y-3">
                <Field label="Campaign name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                {channelMeta(channel).supportsSubject && (
                  <Field label="Subject">
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </Field>
                )}
                <Field label="Body" hint={<ChannelBadge channel={channel} />}>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
                </Field>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARS.map((v) => (
                    <span
                      key={v}
                      className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={guidance}
                    onChange={(e) => setGuidance(e.target.value)}
                    placeholder="Steer the redraft (optional)…"
                    className="flex-1"
                  />
                  <Button variant="secondary" size="sm" onClick={redraft} loading={redrafting}>
                    <Pencil className="size-3.5" /> Redraft
                  </Button>
                </div>
              </div>
            </Card>

            <Button onClick={launch} loading={launching} className="w-full py-3 text-base">
              <Rocket className="size-4" /> Launch to {plan.preview.total.toLocaleString('en-IN')} shoppers
            </Button>
            <p className="text-center text-xs text-ink-faint">
              Opted-out shoppers and anyone without a {channelMeta(channel).addressType} are excluded
              automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-brand">{icon}</span>
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {hint && <span className="ml-auto text-xs text-ink-faint">{hint}</span>}
    </div>
  );
}
