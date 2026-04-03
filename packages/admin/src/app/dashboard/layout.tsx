'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Content', href: '/dashboard/content' },
  { label: 'Schema', href: '/dashboard/schema' },
  { label: 'Blocks', href: '/dashboard/blocks' },
  { label: 'Patterns', href: '/dashboard/patterns' },
  { label: 'Media', href: '/dashboard/media' },
  { label: 'Webhooks', href: '/dashboard/webhooks' },
  { label: 'Extensions', href: '/dashboard/extensions' },
  { label: 'API Tokens', href: '/dashboard/tokens' },
  { label: 'Settings', href: '/dashboard/settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('htmless_token');
    if (!token) {
      router.replace('/login');
    } else {
      setAuthed(true);
    }
  }, [router]);

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading...</p>
      </div>
    );
  }

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  function handleLogout() {
    localStorage.removeItem('htmless_token');
    localStorage.removeItem('htmless_user');
    router.replace('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: '240px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        padding: '1.5rem 0',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '0 1.25rem', marginBottom: '2rem' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
              HTML<span style={{ color: 'var(--accent)' }}>ess</span>
            </h1>
          </Link>
        </div>
        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'block',
                padding: '0.6rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--text-muted)',
                background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                textDecoration: 'none',
              }}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '0 1.25rem' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
