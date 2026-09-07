'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { SaveAlertBanner, SaveIndicator } from './save-indicator';

const NAV = [
  { href: '/', label: 'วันนี้', icon: '☀️' },
  { href: '/inbox', label: 'รับข้อมูล', icon: '📥' },
  { href: '/tasks', label: 'ติดตาม', icon: '🗓️' },
  { href: '/projects', label: 'โปรเจกต์', icon: '📁' },
  { href: '/brief', label: 'เตรียมคุย', icon: '🎤' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { storageMode, loadError, ready } = useStore();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* PWA install is a nicety; the app works without it. */
    });
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
              W
            </span>
            <span className="text-sm font-semibold text-ink sm:text-base">
              Workier
              <span className="ml-1 hidden font-normal text-ink-muted sm:inline">
                · Putter Workspace
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <SaveIndicator />
            <Link
              href="/settings"
              aria-label="ตั้งค่า"
              className={`rounded-lg px-2 py-1.5 text-lg hover:bg-gray-100 ${
                pathname.startsWith('/settings') ? 'bg-gray-100' : ''
              }`}
            >
              ⚙️
            </Link>
          </div>
        </div>

        <nav className="hidden gap-1 px-3 pb-2 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-soft hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <SaveAlertBanner />

      {(loadError || storageMode === 'local') && ready && (
        <div className="px-4 pt-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {loadError ??
              'ยังไม่ได้ตั้งค่า Firebase — ข้อมูลถูกเก็บในเบราว์เซอร์นี้เท่านั้น จะไม่ตามไปยังอุปกรณ์อื่น'}{' '}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              ดูวิธีตั้งค่า
            </Link>
          </div>
        </div>
      )}

      <main className="flex-1 px-4 pb-28 pt-4 sm:pb-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                isActive(item.href) ? 'text-brand-600' : 'text-ink-muted'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
