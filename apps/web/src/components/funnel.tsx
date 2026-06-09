import { type Channel } from '@cadence/shared';
import { money, pct } from '@/lib/format';
import { CHANNEL_META } from '@cadence/shared';

export interface FunnelData {
  audience: number;
  sent: number;
  delivered: number;
  viewed: number;
  clicked: number;
  converted: number;
  failed: number;
  unsubscribed: number;
  attributedRevenueCents: number;
}

/**
 * The campaign funnel as a set of proportional bars. Each stage shows its count
 * and its rate relative to the stage above, so drop-off is visible at a glance.
 */
export function Funnel({ data, channel }: { data: FunnelData; channel: Channel }) {
  const base = Math.max(data.sent, 1);
  const viewedLabel = CHANNEL_META[channel].engagementStages.includes('OPENED') ? 'Opened' : 'Read';

  const stages = [
    { label: 'Sent', value: data.sent, of: data.sent, color: 'var(--color-ink-faint)' },
    { label: 'Delivered', value: data.delivered, of: data.sent, color: 'var(--color-info)' },
    { label: viewedLabel, value: data.viewed, of: data.delivered, color: 'var(--color-info)' },
    { label: 'Clicked', value: data.clicked, of: data.delivered, color: 'var(--color-brand)' },
    { label: 'Converted', value: data.converted, of: data.clicked, color: 'var(--color-accent)' },
  ];

  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <div key={s.label}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="text-ink-muted">{s.label}</span>
            <span className="tabular-nums">
              <span className="text-ink font-medium">{s.value.toLocaleString('en-IN')}</span>
              {s.label !== 'Sent' && (
                <span className="text-ink-faint ml-2 text-xs">{pct(s.value, s.of)} of prev</span>
              )}
            </span>
          </div>
          <div className="bg-surface-3 h-2.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max((s.value / base) * 100, s.value > 0 ? 2 : 0)}%`,
                background: s.color,
              }}
            />
          </div>
        </div>
      ))}

      <div className="grid grid-cols-3 gap-3 pt-3">
        <Mini label="Attributed revenue" value={money(data.attributedRevenueCents)} tone="accent" />
        <Mini label="Failed" value={data.failed.toLocaleString('en-IN')} tone="danger" />
        <Mini label="Unsubscribed" value={data.unsubscribed.toLocaleString('en-IN')} tone="muted" />
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'accent' | 'danger' | 'muted';
}) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div className="border-border bg-surface-2 rounded-lg border px-3 py-2.5">
      <div className="text-ink-faint text-[11px] tracking-wide uppercase">{label}</div>
      <div className={`font-display mt-0.5 text-lg ${color}`}>{value}</div>
    </div>
  );
}
