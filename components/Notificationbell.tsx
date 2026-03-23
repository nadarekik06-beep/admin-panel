'use client';
// components/NotificationBell.tsx
// Drop-in bell component for BOTH seller dashboard and admin panel.
// Usage (seller):  <NotificationBell api={sellerNotificationApi} dark={dark} onNavigate={router.push} />
// Usage (admin):   <NotificationBell api={adminNotificationApi} dark={true} onNavigate={router.push} />

import { useRef, useEffect, useCallback } from 'react';
import {
  Bell, CheckCheck, RefreshCw,
  PackagePlus, PackageCheck, PackageX,
  CheckCircle, XCircle, Store, Package,
} from 'lucide-react';
import { useNotifications } from '@/hooks/Usenotifications';
import type { AppNotification } from '@/lib/Notificationapi';

// ─── sound (Web Audio API — no file needed) ───────────────────────
function playSound() {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

// ─── icon map ─────────────────────────────────────────────────────
function NotifIcon({ icon }: { icon: string }) {
  const cls = 'w-4 h-4 flex-shrink-0';
  const map: Record<string, React.ReactNode> = {
    'package-plus':  <PackagePlus  className={cls} />,
    'package-check': <PackageCheck className={cls} />,
    'package-x':     <PackageX     className={cls} />,
    'check-circle':  <CheckCircle  className={cls} />,
    'x-circle':      <XCircle      className={cls} />,
    'store':         <Store        className={cls} />,
  };
  return <>{map[icon] ?? <Package className={cls} />}</>;
}

// ─── accent colour per action ─────────────────────────────────────
function accent(action: string): string {
  if (action === 'approved')  return '#10b981';
  if (action === 'rejected')  return '#ef4444';
  if (action === 'deleted')   return '#ef4444';
  if (action === 'submitted') return '#f59e0b';
  if (action === 'created')   return '#3b82f6';
  if (action === 'updated')   return '#a855f7';
  return '#db142e';
}

// ─── relative time ────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── single notification row ──────────────────────────────────────
function NotifRow({
  n,
  dark,
  onRead,
}: {
  n: AppNotification;
  dark: boolean;
  onRead: (n: AppNotification) => void;
}) {
  const a         = accent(n.data.action);
  const textMain  = dark ? '#ffffff' : '#111827';
  const textMuted = dark ? 'rgba(255,255,255,0.45)' : '#6b7280';
  const border    = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const hoverBg   = dark ? 'rgba(255,255,255,0.04)' : '#f3f4f6';
  const unreadBg  = `${a}0d`;

  return (
    <button
      onClick={() => onRead(n)}
      style={{
        width: '100%', textAlign: 'left',
        padding: '11px 14px',
        background: n.is_read ? 'transparent' : unreadBg,
        borderBottom: `1px solid ${border}`,
        border: 'none', cursor: 'pointer',
        display: 'flex', gap: 11, alignItems: 'flex-start',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : unreadBg)}
    >
      {/* icon bubble */}
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: `${a}18`, border: `1px solid ${a}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: a,
      }}>
        <NotifIcon icon={n.data.icon} />
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{
            fontSize: 12, fontWeight: n.is_read ? 500 : 800,
            color: n.is_read ? textMuted : textMain,
            overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', maxWidth: 200,
          }}>
            {n.data.title}
          </span>
          <span style={{ fontSize: 10, color: textMuted, flexShrink: 0, marginLeft: 6 }}>
            {timeAgo(n.created_at)}
          </span>
        </div>
        <p style={{
          fontSize: 11, color: textMuted, margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden', lineHeight: 1.45,
        }}>
          {n.data.body}
        </p>
      </div>

      {/* unread dot */}
      {!n.is_read && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: a, flexShrink: 0, marginTop: 4,
        }} />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

interface NotificationBellProps {
  api: {
    getAll(page?: number): Promise<{ data: AppNotification[]; meta: any }>;
    getUnreadCount(): Promise<number>;
    markRead(id: string): Promise<void>;
    markAllRead(): Promise<void>;
  };
  dark?: boolean;
  /** router.push — to navigate when a notification is clicked */
  onNavigate?: (path: string) => void;
  /** polling interval ms — default 30 000 */
  pollInterval?: number;
}

export default function NotificationBell({
  api,
  dark = true,
  onNavigate,
  pollInterval = 30_000,
}: NotificationBellProps) {

  const onNew = useCallback(() => playSound(), []);

  const {
    items, unreadCount, loading,
    open, setOpen,
    fetchAll, markRead, markAllRead,
  } = useNotifications({ api, pollInterval, onNewNotifications: onNew });

  // close on outside click
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setOpen]);

  // colours
  const bg        = dark ? '#161b27' : '#ffffff';
  const border    = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textMain  = dark ? '#ffffff' : '#111827';
  const textMuted = dark ? 'rgba(255,255,255,0.45)' : '#6b7280';
  const btnBg     = dark ? 'rgba(255,255,255,0.07)' : '#f0f2f5';

  const handleRead = async (n: AppNotification) => {
    if (!n.is_read) await markRead(n.id);
    if (n.data.link && onNavigate) {
      setOpen(false);
      onNavigate(n.data.link);
    }
  };

  return (
    <>
      <style>{`
        @keyframes notif-pop {
          0%   { transform: scale(0.85) translateY(-4px); opacity: 0; }
          100% { transform: scale(1)    translateY(0);    opacity: 1; }
        }
        @keyframes badge-bounce {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.3); }
        }
      `}</style>

      <div ref={ref} style={{ position: 'relative' }}>

        {/* ── Bell button ── */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: open ? 'rgba(219,20,46,0.12)' : btnBg,
            border: `1px solid ${open ? 'rgba(219,20,46,0.3)' : border}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: open ? '#db142e' : textMuted,
            position: 'relative', transition: 'all 0.2s ease',
          }}
          title="Notifications"
        >
          <Bell size={16} />

          {/* badge */}
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -5,
              minWidth: 18, height: 18, borderRadius: 999,
              background: '#db142e',
              border: `2px solid ${dark ? '#0d1117' : '#f0f2f5'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 900, color: '#fff',
              padding: '0 3px',
              animation: 'badge-bounce 0.4s ease',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* ── Dropdown ── */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            width: 360, maxHeight: 500,
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 16,
            boxShadow: dark
              ? '0 24px 64px rgba(0,0,0,0.7)'
              : '0 24px 64px rgba(0,0,0,0.18)',
            zIndex: 9999, overflow: 'hidden',
            animation: 'notif-pop 0.2s ease',
          }}>

            {/* header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 14px 12px',
              borderBottom: `1px solid ${border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={14} style={{ color: '#db142e' }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: textMain }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 7px',
                    borderRadius: 999,
                    background: 'rgba(219,20,46,0.14)',
                    color: '#db142e',
                    border: '1px solid rgba(219,20,46,0.25)',
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, color: textMuted,
                      background: 'transparent', border: 'none',
                      cursor: 'pointer', padding: '3px 7px', borderRadius: 7,
                    }}
                    title="Mark all read"
                  >
                    <CheckCheck size={12} />
                    All read
                  </button>
                )}
                <button
                  onClick={fetchAll}
                  style={{
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', color: textMuted,
                    display: 'flex', alignItems: 'center',
                    padding: 4, borderRadius: 6,
                  }}
                  title="Refresh"
                >
                  <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              </div>
            </div>

            {/* list */}
            <div style={{ overflowY: 'auto', maxHeight: 420 }}>
              {loading && items.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: textMuted, fontSize: 13 }}>
                  Loading…
                </div>
              ) : items.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                  <Bell size={32} style={{ color: textMuted, opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: textMuted, margin: 0 }}>
                    No notifications yet
                  </p>
                  <p style={{ fontSize: 11, color: textMuted, opacity: 0.6, margin: '4px 0 0' }}>
                    You'll see activity here when things happen.
                  </p>
                </div>
              ) : (
                items.map(n => (
                  <NotifRow key={n.id} n={n} dark={dark} onRead={handleRead} />
                ))
              )}
            </div>

          </div>
        )}
      </div>
    </>
  );
}