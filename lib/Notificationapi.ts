// lib/Notificationapi.ts  — ADMIN PANEL
// Uses the existing axios instance (lib/axios.ts) which handles auth token automatically.
// axios responses are already shaped as { data: <body> }, so res.data = Laravel response body.

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

// ─── Response parsers ─────────────────────────────────────────────────────────
// axios wraps the response as { data: <Laravel body> }
// Laravel body is: { success: true, data: [...], meta: {...} }
// So: res.data = Laravel body, res.data.data = array, res.data.meta = pagination

function parseList(res: { data: any }): NotificationListResponse {
  const body  = res.data                                    // Laravel response body
  const items = Array.isArray(body?.data) ? body.data : [] // the notifications array
  const meta  = body?.meta ?? {
    current_page: 1,
    last_page:    1,
    total:        items.length,
  }
  return { data: items, meta }
}

function parseCount(res: { data: any }): number {
  const body = res.data
  return body?.count ?? body?.data?.count ?? 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Stable module-level singleton.
// Pass directly as the `api` prop to <NotificationBell />.
// Do NOT wrap in useMemo/useState — that creates a new reference each render
// which breaks useCallback deps and causes an infinite poll loop.
// ─────────────────────────────────────────────────────────────────────────────

export const adminNotificationApi = {
  async getAll(page = 1): Promise<NotificationListResponse> {
    const res = await api.get('/admin/notifications', {
      params: { page, per_page: 20 },
    })
    return parseList(res)
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get('/admin/notifications/unread-count')
    return parseCount(res)
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/admin/notifications/${id}/read`)
  },

  async markAllRead(): Promise<void> {
    await api.patch('/admin/notifications/read-all')
  },
} as const