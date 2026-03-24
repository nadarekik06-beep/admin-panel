'use client';
// components/layout/Header.tsx — FIXED
// Changes from original:
//   1. `new Date().toLocaleDateString(...)` moved into a useEffect → state.
//      The original called new Date() directly in JSX during render, which ran
//      on the server (SSR) and then again on the client. Because the server and
//      client clocks differ by milliseconds the rendered string never matched,
//      causing the React hydration crash you saw in the console.
//      Fix: render an empty string on the server; set the real date only after
//      the component mounts on the client.

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { authStorage } from '@/lib/auth';
import { Admin } from '@/types';
import NotificationBell from '@/components/Notificationbell';
import { adminNotificationApi } from '@/lib/Notificationapi';

const pageTitles: Record<string, string> = {
  '/':                    'Dashboard',
  '/users':               'User Management',
  '/sellers':             'Seller Management',
  '/seller-applications': 'Seller Applications',
  '/products':            'Product Management',
  '/orders':              'Orders',
  '/statistics':          'Statistics & Analytics',
};

export default function Header() {
  const pathname = usePathname();
  const router   = useRouter();

  const [admin,      setAdmin]      = useState<Admin | null>(null);
  const [dateString, setDateString] = useState(''); // FIX: empty on server, set on client

  useEffect(() => {
    setAdmin(authStorage.getAdmin());

    // Set date only after mount so SSR and client output are identical (both empty)
    setDateString(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year:    'numeric',
        month:   'long',
        day:     'numeric',
      }),
    );
  }, []);

  const title = pageTitles[pathname] ?? 'Admin Panel';

  return (
    <header
      className="h-16 flex items-center justify-between px-6 sticky top-0 z-30"
      style={{
        background:   '#111318',
        borderBottom: '1px solid #1e2128',
        boxShadow:    '0 2px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── left: page title ── */}
      <div className="flex items-center gap-3">
        <div
          className="w-1 h-7 rounded-full flex-shrink-0"
          style={{
            background: 'linear-gradient(180deg, #db142e 0%, #9b0d1f 100%)',
            boxShadow:  '0 0 8px rgba(219,20,46,0.5)',
          }}
        />
        <div>
          <h1 className="text-base font-bold tracking-tight" style={{ color: '#fcfdfd' }}>
            {title}
          </h1>
          {/* Only rendered after mount — never during SSR */}
          {dateString && (
            <p className="text-[11px] hidden sm:block" style={{ color: '#6b7280' }}>
              {dateString}
            </p>
          )}
        </div>
      </div>

      {/* ── right: bell + admin info ── */}
      <div className="flex items-center gap-3">

        {/* NOTIFICATION BELL */}
        <NotificationBell
          api={adminNotificationApi}
          dark={true}
          onNavigate={router.push}
          pollInterval={30_000}
        />

        {/* divider */}
        <div
          className="h-8 w-px"
          style={{ background: 'linear-gradient(180deg, transparent, #198f41, transparent)' }}
        />

        {/* admin info — also only rendered after mount (authStorage reads localStorage) */}
        {admin && (
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #db142e 0%, #9b0d1f 100%)',
                boxShadow:  '0 0 12px rgba(219,20,46,0.35)',
              }}
            >
              {admin.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold leading-none" style={{ color: '#fcfdfd' }}>
                {admin.name}
              </p>
              <p className="text-[11px] capitalize mt-0.5 font-medium" style={{ color: '#198f41' }}>
                {admin.role.replace('_', ' ')}
              </p>
            </div>
            <span
              className="w-2 h-2 rounded-full hidden md:block"
              style={{ backgroundColor: '#198f41', boxShadow: '0 0 6px #198f41' }}
            />
          </div>
        )}
      </div>
    </header>
  );
}