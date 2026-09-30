/**
 * Admin "Demandes de paiement" API — /api/admin/payment-requests/* (manual WhatsApp payments
 * for ad-wallet top-ups and plan upgrades). Same fetch pattern as adsAdminApi.ts.
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
      'Accept-Language': 'en',   // same as the rest of the panel (the API stores the admin's locale from it)
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const first = json.errors ? Object.values(json.errors).map(v => (v as string[])[0]).join(' · ') : null
    const err: any = new Error(first ?? json.message ?? 'Request failed')
    err.status = res.status
    err.code = json.code
    throw err
  }
  return json as T
}

export type RequestType = 'wallet_topup' | 'plan_upgrade'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type PaymentMethod = 'd17' | 'bank_transfer' | 'cash' | 'other'

export interface AdminPaymentRequest {
  id: number
  reference: string
  type: RequestType
  source: 'seller' | 'admin'
  status: RequestStatus
  amount: number
  amount_received: number | null
  current_plan: { slug: string; name: string } | null
  requested_plan: { slug: string; name: string } | null
  billing_period: 'monthly' | 'yearly' | null
  payment_method: PaymentMethod | null
  transaction_reference: string | null
  admin_note: string | null
  rejection_reason: string | null
  message: string | null
  seller: { id: number; name: string | null; store_name: string | null; email: string | null; phone: string | null; wallet_balance: number | null }
  contact_url: string | null
  decided_by: { id: number; name: string } | null
  decided_at: string | null
  cancelled_at: string | null
  created_at: string
  ad_top_up_id: number | null
  subscription_payment_id: number | null
  logs?: { action: string; actor: { id: number; name: string } | null; actor_role: string; data: Record<string, unknown> | null; created_at: string }[]
}

export interface ManualPaymentSettings {
  whatsapp_enabled: boolean
  whatsapp_number: string
  template_wallet_topup: string
  template_plan_upgrade: string
  min_top_up: number
  max_top_up: number
}

type Paged<T> = { data: T[]; meta: { current_page: number; last_page: number; total: number }; counts: Record<string, number> }

export interface ListParams { type?: string; status?: string; date_from?: string; date_to?: string; search?: string; seller_id?: number; page?: number }

export const paymentRequestsApi = {
  list: (params: ListParams = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))
    return request<Paged<AdminPaymentRequest>>('GET', `/admin/payment-requests?${qs}`)
  },
  pendingCount: () => request<{ data: { count: number } }>('GET', '/admin/payment-requests/pending-count').then(r => r.data.count),
  get: (id: number) => request<{ data: AdminPaymentRequest }>('GET', `/admin/payment-requests/${id}`).then(r => r.data),
  approve: (id: number, body: { payment_method: PaymentMethod; amount_received?: number; transaction_reference?: string; note?: string }) =>
    request<{ data: AdminPaymentRequest }>('POST', `/admin/payment-requests/${id}/approve`, body).then(r => r.data),
  reject: (id: number, reason: string) =>
    request<{ data: AdminPaymentRequest }>('POST', `/admin/payment-requests/${id}/reject`, { reason }).then(r => r.data),

  directTopUp: (body: { seller_id: number; amount: number; payment_method: PaymentMethod; transaction_reference?: string; note?: string }) =>
    request<{ data: AdminPaymentRequest }>('POST', '/admin/payment-requests/direct/wallet-top-up', body).then(r => r.data),
  directPlanChange: (body: { seller_id: number; plan: string; billing_period: 'monthly' | 'yearly'; amount?: number; payment_method: PaymentMethod; transaction_reference?: string; note?: string }) =>
    request<{ data: AdminPaymentRequest }>('POST', '/admin/payment-requests/direct/plan-change', body).then(r => r.data),

  settings: () => request<{ data: { values: ManualPaymentSettings; defaults: Partial<ManualPaymentSettings> } }>('GET', '/admin/payment-requests/settings').then(r => r.data),
  saveSettings: (values: Partial<ManualPaymentSettings>) =>
    request<{ data: { values: ManualPaymentSettings; defaults: Partial<ManualPaymentSettings> } }>('PUT', '/admin/payment-requests/settings', values).then(r => r.data),
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  d17: 'D17', bank_transfer: 'Virement bancaire', cash: 'Espèces', other: 'Autre',
}
export const TYPE_LABELS: Record<RequestType, string> = { wallet_topup: 'Recharge portefeuille', plan_upgrade: 'Changement de plan' }
export const STATUS_LABELS: Record<RequestStatus, string> = { pending: 'En attente', approved: 'Approuvée', rejected: 'Refusée', cancelled: 'Annulée' }

/** Tell the sidebar badge to refresh after an approve / reject. */
export const PENDING_EVENT = 'payment-requests:changed'
export const notifyPendingChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(PENDING_EVENT)) }
