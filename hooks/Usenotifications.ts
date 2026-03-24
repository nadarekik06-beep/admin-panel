'use client';
// hooks/Usenotifications.ts — FIXED
// Changes from original:
//   1. Added `mounted` state — polling only starts AFTER the component mounts on the
//      client. This prevents the hook from firing during Next.js SSR, which was the
//      root cause of the hydration error AND the flood of 500s on page load.
//   2. Added failure backoff — after 3 consecutive failed polls the interval is
//      cleared and restarted after 2 minutes. Prevents the endless 500 spam you saw.
//   3. intervalRef tracks the setInterval handle so it can be safely cleared on
//      backoff without a stale-closure bug.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AppNotification, NotificationListResponse } from '@/lib/Notificationapi';

interface UseNotificationsOptions {
  api: {
    getAll(page?: number): Promise<NotificationListResponse>;
    getUnreadCount(): Promise<number>;
    markRead(id: string): Promise<void>;
    markAllRead(): Promise<void>;
  };
  /** Poll interval in ms — default 30 000 (30 s) */
  pollInterval?: number;
  /** Called when new notifications arrive (use to play sound) */
  onNewNotifications?: (count: number) => void;
}

export function useNotifications({
  api,
  pollInterval = 30_000,
  onNewNotifications,
}: UseNotificationsOptions) {
  const [items,       setItems]       = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);

  // FIX 1: mounted guard — prevents ANY api call during SSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const prevCount    = useRef(0);
  const failureCount = useRef(0);                                    // FIX 2: backoff counter
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── poll ──────────────────────────────────────────────────────────
  const pollCount = useCallback(async () => {
    try {
      const count = await api.getUnreadCount();
      failureCount.current = 0;                                      // reset on success
      if (count > prevCount.current && prevCount.current >= 0) {
        onNewNotifications?.(count - prevCount.current);
      }
      prevCount.current = count;
      setUnreadCount(count);
    } catch {
      failureCount.current += 1;
      // After 3 back-to-back failures, stop hammering the server
      if (failureCount.current >= 3 && intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        // Try again after 2 minutes
        setTimeout(() => {
          failureCount.current = 0;
          if (!intervalRef.current) {
            pollCount();
            intervalRef.current = setInterval(pollCount, pollInterval);
          }
        }, 120_000);
      }
    }
  }, [api, onNewNotifications, pollInterval]);

  // FIX 1 continued: only start polling after client mount
  useEffect(() => {
    if (!mounted) return;

    pollCount();
    intervalRef.current = setInterval(pollCount, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mounted, pollCount, pollInterval]);

  // ── full list fetch (when dropdown opens) ─────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAll();
      setItems(res.data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (open && mounted) fetchAll();
  }, [open, fetchAll, mounted]);

  // ── actions ───────────────────────────────────────────────────────
  const markRead = async (id: string) => {
    await api.markRead(id);
    setItems(prev =>
      prev.map(n =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
      ),
    );
    setUnreadCount(c => Math.max(0, c - 1));
    prevCount.current = Math.max(0, prevCount.current - 1);
  };

  const markAllRead = async () => {
    await api.markAllRead();
    setItems(prev =>
      prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })),
    );
    setUnreadCount(0);
    prevCount.current = 0;
  };

  return {
    items,
    unreadCount,
    loading,
    open,
    setOpen,
    fetchAll,
    markRead,
    markAllRead,
  };
}