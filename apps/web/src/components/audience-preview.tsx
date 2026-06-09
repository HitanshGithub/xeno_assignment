import { Users } from 'lucide-react';
import { money, relativeTime } from '@/lib/format';

export interface PreviewData {
  total: number;
  sample: Array<{
    id: string;
    name: string;
    city: string | null;
    orderCount: number;
    lifetimeValueCents: number;
    lastOrderAt: string | Date | null;
    daysSinceLastOrder: number | null;
  }>;
}

/** Audience size + a top-value sample — "here's exactly who you'd reach". */
export function AudiencePreview({ preview }: { preview: PreviewData }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <Users className="size-4 text-brand" />
        <span className="font-display text-2xl text-ink">{preview.total.toLocaleString('en-IN')}</span>
        <span className="text-ink-muted">shoppers match</span>
      </div>

      {preview.sample.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 font-medium">Shopper</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 text-right font-medium">Orders</th>
                <th className="px-3 py-2 text-right font-medium">Lifetime</th>
                <th className="px-3 py-2 text-right font-medium">Last order</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-ink">{c.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{c.city ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{c.orderCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">
                    {money(c.lifetimeValueCents)}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">{relativeTime(c.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.total > preview.sample.length && (
            <div className="bg-surface-2 px-3 py-2 text-center text-xs text-ink-faint">
              + {(preview.total - preview.sample.length).toLocaleString('en-IN')} more
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">No shoppers match these rules yet.</p>
      )}
    </div>
  );
}
