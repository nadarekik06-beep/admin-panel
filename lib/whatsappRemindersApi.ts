/**
 * Seller WhatsApp notices (manual wa.me links) — /api/admin/whatsapp-reminders,
 * /api/admin/seller-orders/{id}/whatsapp-sent. Same fetch pattern as paymentRequestsApi.ts.
 *
 * Attempt 0 = initial notice after the admin confirms, 1 = reminder, 2 = last reminder.
 * The backend decides when each one is due (Tunis working hours).
 */

import Cookies from 'js-cookie'

const RAW_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
const API_URL = RAW_URL.endsWith('/api') ? RAW_URL : `${RAW_URL}/api`

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = Cookies.get('admin_token')
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': 'en',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(json.message ?? 'Request failed')
    err.status = res.status
    throw err
  }
  return json as T
}

export type ReminderStatus = 'pending' | 'due' | 'sent' | 'cancelled'

/** Per parcel, in the order drawer (seller_orders[].whatsapp). null for CHOOSE'Tounsi's own parcels. */
export interface ParcelWhatsApp {
  needs_action: boolean
  prepared_at: string | null
  overdue: boolean
  overdue_at: string | null
  phone: string | null
  phone_source: 'whatsapp' | 'phone' | null
  language: 'fr' | 'ar'
  current: { attempt: number; status: ReminderStatus; due_at: string | null; url: string | null } | null
  history: { attempt: number; status: ReminderStatus; due_at: string | null; sent_at: string | null; sent_by: { id: number; name: string } | null }[]
}

export interface ReminderRow {
  seller_order_id: number
  order: { id: number; order_number: string; confirmed_at: string | null }
  seller: { id: number; name: string; store: string; call_phone: string | null }
  phone: string | null
  phone_source: 'whatsapp' | 'phone' | null
  item_count: number
  reminder: { attempt: number; status: ReminderStatus; due_at: string | null; url: string | null } | null
  overdue_at: string | null
  last_sent: { attempt: number; sent_at: string | null; sent_by: string | null } | null
}

export interface RemindersList {
  overdue: ReminderRow[]
  due: ReminderRow[]
  counts: { overdue: number; due: number }
  warnings: string[]
  business_number: string
}

export const whatsappRemindersApi = {
  list: () => request<{ data: RemindersList }>('GET', '/admin/whatsapp-reminders').then(r => r.data),
  count: () => request<{ data: { due: number; overdue: number; total: number } }>('GET', '/admin/whatsapp-reminders/count').then(r => r.data),
  markSent: (sellerOrderId: number, attempt: number) =>
    request<{ data: ParcelWhatsApp; message: string }>('POST', `/admin/seller-orders/${sellerOrderId}/whatsapp-sent`, { attempt }),
}

export const ATTEMPT_LABEL: Record<number, string> = { 0: 'Initial notice', 1: 'Reminder 1', 2: 'Last reminder' }

/** Tell the sidebar badge to refresh after a notice was sent. */
export const REMINDERS_EVENT = 'whatsapp-reminders:changed'
export const notifyRemindersChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(REMINDERS_EVENT)) }

/** "+216 22 345 678" from "21622345678". */
export const formatPhone = (n: string | null) =>
  n && /^216\d{8}$/.test(n) ? `+216 ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}` : (n ?? '—')
