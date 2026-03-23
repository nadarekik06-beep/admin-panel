// lib/notificationApi.ts
// Works for BOTH seller dashboard and admin panel.
// Import the pre-built instances at the bottom.

import axios from 'axios';
import Cookies from 'js-cookie';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

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

export interface NotificationMeta {
  current_page: number;
  last_page: number;
  total: number;
}

export interface NotificationListResponse {
  data: AppNotification[];
  meta: NotificationMeta;
}

// ─── token resolvers ──────────────────────────────────────────────

function sellerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ct_auth_token');
}

function adminToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Admin panel stores token in a cookie called 'admin_token'
  return Cookies.get('admin_token') ?? null;
}

// ─── factory ──────────────────────────────────────────────────────

function makeHeaders(token: string | null) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function createNotificationApi(
  prefix: string,               // '/notifications' or '/admin/notifications'
  getToken: () => string | null,
) {
  const url = (path = '') => `${BASE}${prefix}${path}`;

  return {
    async getAll(page = 1): Promise<NotificationListResponse> {
      const res = await axios.get(url(), {
        params: { page, per_page: 20 },
        headers: makeHeaders(getToken()),
      });
      return { data: res.data.data, meta: res.data.meta };
    },

    async getUnreadCount(): Promise<number> {
      const res = await axios.get(url('/unread-count'), {
        headers: makeHeaders(getToken()),
      });
      return res.data.count as number;
    },

    async markRead(id: string): Promise<void> {
      await axios.patch(url(`/${id}/read`), {}, {
        headers: makeHeaders(getToken()),
      });
    },

    async markAllRead(): Promise<void> {
      await axios.patch(url('/read-all'), {}, {
        headers: makeHeaders(getToken()),
      });
    },
  };
}

// ─── pre-built instances ──────────────────────────────────────────

/** Use in the seller dashboard */
export const sellerNotificationApi = createNotificationApi(
  '/notifications',
  sellerToken,
);

/** Use in the admin panel */
export const adminNotificationApi = createNotificationApi(
  '/admin/notifications',
  adminToken,
);