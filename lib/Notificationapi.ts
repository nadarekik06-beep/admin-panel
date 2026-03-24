// lib/Notificationapi.ts — FIXED
// Changes from original:
//   1. Added `as const` → object is a stable singleton, never recreated between renders
//      This is critical: passing a new object reference each render breaks useCallback
//      deps in useNotifications and causes an infinite poll loop.
//   2. File name kept as Notificationapi.ts to match your existing imports exactly.

import api from './axios';

export interface AppNotification {
  id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  data: {
    type: string;
    action: string;
    title: string;
    body: string;
    icon: string;
    link: string;
    [key: string]: unknown;
  };
}

export interface NotificationListResponse {
  data: AppNotification[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stable module-level singleton.
// Import and pass directly as the `api` prop — do NOT wrap in useMemo/useState.
// ─────────────────────────────────────────────────────────────────────────────
export const adminNotificationApi = {
  async getAll(page = 1): Promise<NotificationListResponse> {
    const res = await api.get('/admin/notifications', {
      params: { page, per_page: 20 },
    });
    return { data: res.data.data, meta: res.data.meta };
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get('/admin/notifications/unread-count');
    return res.data.count as number;
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/admin/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.patch('/admin/notifications/read-all');
  },
} as const;