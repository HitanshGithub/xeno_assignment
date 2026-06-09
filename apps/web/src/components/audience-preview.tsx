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
        <Users className="text-brand size-4" />
        <span className="font-display text-ink text-2xl">
          {preview.total.toLocaleString('en-IN')}
        </span>
        <span className="text-ink-muted">shoppers match</span>
      </div>

      {preview.sample.length > 0 ? (
        <div className="border-border mt-3 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-surface-2 text-ink-faint border-b text-left text-xs tracking-wide uppercase">
                <th className="px-3 py-2 font-medium">Shopper</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 text-right font-medium">Orders</th>
                <th className="px-3 py-2 text-right font-medium">Lifetime</th>
                <th className="px-3 py-2 text-right font-medium">Last order</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((c) => (
                <tr key={c.id} className="border-border/60 border-b last:border-0">
                  <td className="text-ink px-3 py-2">{c.name}</td>
                  <td className="text-ink-muted px-3 py-2">{c.city ?? '—'}</td>
                  <td className="text-ink-muted px-3 py-2 text-right tabular-nums">
                    {c.orderCount}
                  </td>
                  <td className="text-ink px-3 py-2 text-right tabular-nums">
                    {money(c.lifetimeValueCents)}
                  </td>
                  <td className="text-ink-muted px-3 py-2 text-right">
                    {relativeTime(c.lastOrderAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.total > preview.sample.length && (
            <div className="bg-surface-2 text-ink-faint px-3 py-2 text-center text-xs">
              + {(preview.total - preview.sample.length).toLocaleString('en-IN')} more
            </div>
          )}
        </div>
      ) : (
        <p className="text-ink-faint mt-3 text-sm">No shoppers match these rules yet.</p>
      )}
    </div>
  );
}
