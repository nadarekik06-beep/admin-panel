/**
 * Intigo delivery integration (admin): /api/admin/intigo, /api/admin/seller-orders/{id}/intigo…,
 * /api/admin/sellers/{id}/intigo-pickup. Same fetch pattern as whatsappRemindersApi.ts.
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
    const errors = json?.errors ? Object.values(json.errors).flat().join(' ') : null
    const err: any = new Error(errors || json.message || 'Request failed')
    err.status = res.status
    err.data = json?.data
    throw err
  }
  return json as T
}

export type IntigoSyncStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | null
export type ParcelSize = 'S' | 'L' | 'XL'

/** seller_orders[].intigo in the order drawer (backend IntigoController::parcelPayload). */
export interface ParcelIntigo {
  seller_order_id: number
  parcel_size: ParcelSize
  parcel_size_computed: ParcelSize | null
  package_size: number
  can_change_size: boolean
  nid: string | null
  sync_status: IntigoSyncStatus
  error: string | null
  attention: string | null
  status_code: number | null
  status_label: string | null
  status_at: string | null
  sent_at: string | null
  district_fallback: boolean | null
  district_name: string | null
  attempts: number
  previous_nids: string[]
  pickup_index: number | null
  cod_amount: number
  can_retry: boolean
  can_cancel: boolean
  mode: 'fake' | 'live'
  /** The seller's pickup (our DB) and the index sent to Intigo */
  pickup?: {
    index: number | null
    intigo_label: string | null
    address: string | null
    phone: string | null
    status: string | null
    intigo_ready: boolean
    is_platform: boolean
  }
  /** The parcel body: as Intigo accepted it once sent, else as it would be sent now */
  payload?: IntigoParcelBody
  payload_is_sent?: boolean
  // Detail endpoint only
  history?: { id: number; nid: string; new_status: number; old_status: number | null; status_label: string | null; source: string; result: string | null; event_timestamp: string; created_at: string }[]
  logs?: IntigoLogRow[]
  payload_problems?: string[]
}

export interface IntigoParcelBody {
  recipient_name: string
  phone1: string | null
  phone2?: string
  destination_address: string
  city_name: string | null
  district_name: string | null
  price: number
  package_size: number
  description: string
  additional_info: string
  can_open: boolean
  pickup_index: number | null
  cid: string
}

export interface IntigoLogRow {
  id: number
  seller_order_id?: number | null
  mode: 'fake' | 'live'
  method: string
  endpoint: string
  http_status: number | null
  duration_ms: number | null
  error: string | null
  created_at: string
}

export interface IntigoParcelRow {
  seller_order_id: number
  order_id: number
  order_number: string | null
  seller: string
  status: string
  parcel_size: ParcelSize
  intigo_nid: string | null
  intigo_sync_status: IntigoSyncStatus
  intigo_error: string | null
  intigo_attention: string | null
  intigo_status_label: string | null
  attempts: number
  updated_at: string
}

export interface IntigoOverview {
  mode: 'fake' | 'live'
  setup: {
    api_key_set: boolean
    webhook_secret_set: boolean
    webhook_url: string
    regions_synced: boolean
    cities: number
    districts: number
    platform_pickup_index: string | number | null
    sellers_with_pickup: number
    active_sellers: number
    can_open: boolean
  }
  failed: IntigoParcelRow[]
  attention: IntigoParcelRow[]
  pending: IntigoParcelRow[]
  logs: IntigoLogRow[]
  events: { id: number; nid: string; new_status: number; old_status: number | null; status_label: string | null; source: string; seller_order_id: number | null; result: string | null; processed_at: string | null; created_at: string }[]
}

export interface PickupAddress { index: number; label: string; used_by: { id: number; name: string }[] }

type Wrapped<T> = { success: boolean; message?: string; result?: string; data: T }

export const intigoApi = {
  overview: (errorsOnly = false) => request<Wrapped<IntigoOverview>>('GET', `/admin/intigo${errorsOnly ? '?status=errors' : ''}`).then(r => r.data),
  log: (id: number) => request<Wrapped<IntigoLogRow & { request: unknown; response: unknown }>>('GET', `/admin/intigo/logs/${id}`).then(r => r.data),
  parcel: (sellerOrderId: number) => request<Wrapped<ParcelIntigo>>('GET', `/admin/seller-orders/${sellerOrderId}/intigo`).then(r => r.data),
  retry: (sellerOrderId: number) => request<Wrapped<ParcelIntigo>>('POST', `/admin/seller-orders/${sellerOrderId}/intigo/retry`),
  cancel: (sellerOrderId: number) => request<Wrapped<ParcelIntigo>>('POST', `/admin/seller-orders/${sellerOrderId}/intigo/cancel`),
  dismiss: (sellerOrderId: number) => request<{ success: boolean }>('POST', `/admin/seller-orders/${sellerOrderId}/intigo/dismiss`),
  setSize: (sellerOrderId: number, size: ParcelSize) => request<Wrapped<ParcelIntigo>>('PUT', `/admin/seller-orders/${sellerOrderId}/parcel-size`, { size }),
  pickupAddresses: () => request<{ success: boolean; mode: string; data: PickupAddress[] }>('GET', '/admin/intigo/pickup-addresses'),
  setSellerPickup: (sellerId: number, index: number | null, label?: string | null) =>
    request<Wrapped<{ intigo_pickup_index: number | null; intigo_pickup_label: string | null }>>('PUT', `/admin/sellers/${sellerId}/intigo-pickup`, { index, label: label ?? null }),
}

/** Intigo code → its phase, for colouring. */
export function intigoTone(code: number | null, sync: IntigoSyncStatus): string {
  if (sync === 'failed') return '#ef4444'
  if (sync === 'cancelled' || (code !== null && ((code >= 1100 && code <= 1102) || code >= 9000))) return '#f97316'
  if (code === 5000) return '#14b8a6'
  if (code !== null && (code === 3201 || code >= 6000)) return '#f97316'
  if (sync === 'pending') return '#f59e0b'
  return '#60a5fa'
}
