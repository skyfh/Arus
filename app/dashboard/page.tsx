'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/lib/hooks/use-portfolio';
import { HomeTab } from '@/components/home-tab';

/** Dashboard shell: desktop sidebar + main column; mobile shows Home content. */
export default function DashboardPage() {
  const { data } = usePortfolio();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(j => { setName(j.name ?? ''); setHandle(j.handle ?? ''); }).catch(() => {});
  }, []);

  return (
    <main className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-56 flex-col gap-1 p-4 border-r border-[color:var(--line)] bg-[color:var(--surface)]" aria-label="Main navigation">
        <p className="font-bold text-[color:var(--ink)] px-3 py-2">Arus</p>
        {([
          ['Home', '/dashboard', true],
          ['Get paid', '/dashboard/requests', false],
          ['Send', '/dashboard/send', false],
          ['Allowances', '/dashboard/allowances', false],
          ['Activity', '/dashboard/activity', false],
          ['Cash out', '/dashboard/cashout', false],
          ['Profile', '/dashboard/profile', false],
        ] as [string, string, boolean][]).map(([label, href, active]) => (
          <a key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`px-3 py-2 rounded-xl text-sm ${active ? 'bg-[color:var(--gold-tint)] text-[color:var(--gold-ink)] font-semibold' : 'hover:bg-[color:var(--surface-2)]'}`}>
            {label}
          </a>
        ))}
        <div className="mt-auto px-3 py-2 text-xs text-[color:var(--ink-muted)]">
          {handle && <p className="tnum">{handle}@arus</p>}
          <p>{name}</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 max-w-3xl mx-auto p-6 w-full">
        <HomeTab />
      </div>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[color:var(--surface)] border-t border-[color:var(--line)] flex" aria-label="Mobile navigation">
        {([
          ['Home', '/dashboard'],
          ['Get paid', '/dashboard/requests'],
          ['Send', '/dashboard/send'],
          ['Activity', '/dashboard/activity'],
          ['Profile', '/dashboard/profile'],
        ] as [string, string][]).map(([label, href]) => (
          <a key={href} href={href} className="flex-1 text-center text-xs py-3 text-[color:var(--ink-muted)]">{label}</a>
        ))}
      </nav>
    </main>
  );
}
