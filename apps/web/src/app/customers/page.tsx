'use client';
import { useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { PageHeader } from '@/components/page-header';
import { Badge, Card, Input, Button, Skeleton } from '@/components/ui';
import { money, relativeTime } from '@/lib/format';

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  city: string | null;
  tags: string[];
  marketingOptIn: boolean;
  orderCount: number;
  lifetimeValueCents: number;
  lastOrderAt: string | null;
}
interface CustomersResponse {
  total: number;
  take: number;
  skip: number;
  customers: CustomerRow[];
}

const TAKE = 25;

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [skip, setSkip] = useState(0);

  const path = `/api/customers?take=${TAKE}&skip=${skip}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
  const { data, loading } = useApi<CustomersResponse>(path);

  function runSearch() {
    setSkip(0);
    setQuery(q.trim());
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Shoppers"
        subtitle={data ? `${data.total.toLocaleString('en-IN')} customers in the base` : 'Your customer base'}
      />

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search by name, email, or city…"
            className="pl-9"
          />
        </div>
        <Button variant="secondary" onClick={runSearch}>
          Search
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Shopper</th>
                <th className="px-4 py-2.5 font-medium">City</th>
                <th className="px-4 py-2.5 font-medium">Tags</th>
                <th className="px-4 py-2.5 text-right font-medium">Orders</th>
                <th className="px-4 py-2.5 text-right font-medium">Lifetime</th>
                <th className="px-4 py-2.5 text-right font-medium">Last order</th>
                <th className="px-4 py-2.5 text-center font-medium">Opt-in</th>
              </tr>
            </thead>
            <tbody>
              {data?.customers.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/50">
                  <td className="px-4 py-2.5">
                    <div className="text-ink">
                      {c.firstName} {c.lastName ?? ''}
                    </div>
                    <div className="text-xs text-ink-faint">{c.email ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{c.city ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <Badge key={t} tone={t === 'vip' ? 'brand' : 'neutral'}>
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-muted">{c.orderCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                    {money(c.lifetimeValueCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-muted">{relativeTime(c.lastOrderAt)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {c.marketingOptIn ? (
                      <Check className="mx-auto size-4 text-accent" />
                    ) : (
                      <X className="mx-auto size-4 text-ink-faint" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {data && data.total > TAKE && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
          <span>
            {skip + 1}–{Math.min(skip + TAKE, data.total)} of {data.total.toLocaleString('en-IN')}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - TAKE))}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={skip + TAKE >= data.total}
              onClick={() => setSkip(skip + TAKE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
