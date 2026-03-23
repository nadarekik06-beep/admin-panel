// hooks/usePusherNotifications.ts
// OPTION B — Pusher / Laravel Echo real-time version.
// Install:  npm install laravel-echo pusher-js
// This hook REPLACES useNotifications when using Pusher.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AppNotification, NotificationListResponse } from '@/lib/Notificationapi';

declare global {
  interface Window {
    Echo: any;
    Pusher: any;
  }
}

interface UsePusherNotificationsOptions {
  api: {
    getAll(page?: number): Promise<NotificationListResponse>;
    getUnreadCount(): Promise<number>;
    markRead(id: string): Promise<void>;
    markAllRead(): Promise<void>;
  };
  /** 'user' | 'admin' — determines the private channel name */
  userType: 'user' | 'admin';
  /** The authenticated user/admin ID */
  userId: number;
  /** Called when new notifications arrive */
  onNewNotifications?: (count: number) => void;
}

export function usePusherNotifications({
  api,
  userType,
  userId,
  onNewNotifications,
}: UsePusherNotificationsOptions) {
  const [items,       setItems]       = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const echoRef = useRef<any>(null);

  // ── initial count ─────────────────────────────────────────────────
  useEffect(() => {
    api.getUnreadCount().then(setUnreadCount).catch(() => {});
  }, [api]);

  // ── Pusher / Echo setup ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;

    // Dynamic import so Next.js SSR doesn't break
    import('pusher-js').then(({ default: Pusher }) => {
      import('laravel-echo').then(({ default: Echo }) => {
        const token =
          userType === 'admin'
            ? (document.cookie.match(/admin_token=([^;]+)/) ?? [])[1]
            : localStorage.getItem('ct_auth_token');

        const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';
        const authEndpoint =
          userType === 'admin'
            ? `${BASE}/admin/broadcasting/auth`
            : `${BASE}/broadcasting/auth`;

        echoRef.current = new Echo({
          broadcaster:  'pusher',
          key:          process.env.NEXT_PUBLIC_PUSHER_KEY!,
          cluster:      process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'mt1',
          forceTLS:     true,
          authEndpoint,
          auth: {
            headers: { Authorization: `Bearer ${token}` },
          },
        });

        const channelName = `${userType}.${userId}`;

        echoRef.current
          .private(channelName)
          .notification((notification: AppNotification) => {
            setItems(prev => [notification, ...prev]);
            setUnreadCount(c => {
              onNewNotifications?.(1);
              return c + 1;
            });
          });
      });
    });

    return () => {
      echoRef.current?.disconnect();
    };
  }, [userId, userType, onNewNotifications]);

  // ── full list fetch ───────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAll();
      setItems(res.data);
    } catch {}
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  // ── actions ───────────────────────────────────────────────────────
  const markRead = async (id: string) => {
    await api.markRead(id);
    setItems(prev =>
      prev.map(n =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
      ),
    );
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await api.markAllRead();
    setItems(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
    setUnreadCount(0);
  };

  return { items, unreadCount, loading, open, setOpen, fetchAll, markRead, markAllRead };
}