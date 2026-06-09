'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coffee, LayoutDashboard, Send, Sparkles, Users, Contact } from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/copilot', label: 'Co-pilot', icon: Sparkles, highlight: true },
  { href: '/campaigns', label: 'Campaigns', icon: Send },
  { href: '/segments', label: 'Segments', icon: Users },
  { href: '/customers', label: 'Customers', icon: Contact },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="border-border bg-surface/60 flex h-screen w-60 shrink-0 flex-col border-r px-3 py-5">
      <Link href="/" className="mb-7 flex items-center gap-2.5 px-2">
        <span className="bg-brand text-brand-ink grid size-9 place-items-center rounded-xl">
          <Coffee className="size-5" />
        </span>
        <div className="leading-tight">
          <div className="font-display text-xl tracking-tight">Cadence</div>
          <div className="text-ink-faint text-[11px]">Brew &amp; Bean</div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-surface-3 text-ink'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                item.highlight && !active && 'text-brand hover:text-brand-hover',
              )}
            >
              <Icon className={cn('size-[18px]', active && 'text-brand')} />
              {item.label}
              {item.highlight && (
                <span className="bg-brand-soft text-brand ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  AI
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-border bg-surface-2 text-ink-faint mt-4 rounded-lg border p-3 text-xs">
        Describe a goal in the <span className="text-brand">Co-pilot</span> — Cadence finds the
        audience, writes the message, and sends it.
      </div>
    </aside>
  );
}
