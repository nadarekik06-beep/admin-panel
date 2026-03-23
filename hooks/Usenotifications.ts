// hooks/useNotifications.ts
// Polling hook — works for BOTH seller and admin.
// Pass the appropriate API instance.

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
  const prevCount = useRef(0);

  // ── lightweight count poll ────────────────────────────────────────
  const pollCount = useCallback(async () => {
    try {
      const count = await api.getUnreadCount();
      if (count > prevCount.current && prevCount.current >= 0) {
        onNewNotifications?.(count - prevCount.current);
      }
      prevCount.current = count;
      setUnreadCount(count);
    } catch {
      // silently ignore network errors
    }
  }, [api, onNewNotifications]);

  useEffect(() => {
    pollCount();
    const id = setInterval(pollCount, pollInterval);
    return () => clearInterval(id);
  }, [pollCount, pollInterval]);

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
    prevCount.current = Math.max(0, prevCount.current - 1);
  };

  const markAllRead = async () => {
    await api.markAllRead();
    setItems(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
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