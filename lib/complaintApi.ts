/**
 * Admin returns API (role:admin). Every step validates its transition server
 * side; a refused step answers 422 with a message.
 */

import Cookies from 'js-cookie'
import api from './axios'
import { downloadPdf } from './api/orders'
import type { Complaint, ItemCondition, RefundMethod } from '@/types/complaint'

const RAW_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
const API_URL = RAW_URL.endsWith('/api') ? RAW_URL : `${RAW_URL}/api`

function authHeaders(): Record<string, string> {
  const token = Cookies.get('admin_token') ?? null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function jsonRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) {
    const err: any = new Error(json.message ?? 'Request failed')
    err.response = { data: json, status: res.status }
    throw err
  }
  return json
}

export interface ReturnsPolicySettings { v2_enabled: boolean; receive_timeout_days: number; inspection_days: number }

async function formRequest<T>(path: string, data: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { Accept: 'application/json', ...authHeaders() }, body: data })
  const json = await res.json()
  if (!res.ok) {
    const err: any = new Error(json.message ?? 'Request failed')
    err.response = { data: json, status: res.status }
    throw err
  }
  return json
}

type One = { success: boolean; message: string; data: Complaint }
const patch = (id: number, step: string, body?: unknown) =>
  jsonRequest<One>('PATCH', `/admin/complaints/${id}/${step}`, body)

export const adminComplaintApi = {
  stats: () => jsonRequest<{ success: boolean; data: any }>('GET', '/admin/complaints/stats'),

  getAll: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return jsonRequest<{ success: boolean; data: any }>('GET', `/admin/complaints${qs ? `?${qs}` : ''}`)
  },

  getOne: (id: number) => jsonRequest<{ success: boolean; data: Complaint }>('GET', `/admin/complaints/${id}`),

  /** Approve (also overrides a seller refusal); optionally decide who pays the return shipping. */
  approve: (id: number, note?: string, shipping_payer?: 'seller' | 'client') => patch(id, 'approve', { note, shipping_payer }),
  /** Reject (also overrides a seller acceptance). */
  reject: (id: number, rejection_reason: string) => patch(id, 'reject', { rejection_reason }),
  schedulePickup: (id: number, body: { carrier?: string; date?: string; tracking?: string; note?: string }) => patch(id, 'schedule-pickup', body),
  /** COD: also records that the courier paid the client back in cash. */
  pickedUp: (id: number, courier?: string, note?: string) => patch(id, 'picked-up', { courier, note }),
  receive: (id: number, conditions: Record<number, ItemCondition>, note?: string) => patch(id, 'receive', { conditions, note }),
  refund: (id: number, method: Exclude<RefundMethod, 'cash'>, reference?: string, note?: string) => patch(id, 'refund', { method, reference, note }),
  cancel: (id: number, reason: string) => patch(id, 'cancel', { reason }),
  close: (id: number, note?: string) => patch(id, 'close', { note }),
  /** Reference of the return booked by hand in the Intigo dashboard (after-sale returns aren't automated). */
  intigoReturnRef: (id: number, ref: string | null) => patch(id, 'intigo-return-ref', { intigo_return_ref: ref }),

  // ── Exchange ──
  /** Book the Intigo exchange parcel again (after fixing what blocked it). 422 with a message when it isn't sent. */
  exchangeBook: (id: number) => patch(id, 'exchange/book'),
  /** Booked by hand in the Intigo dashboard, or found there after a lost answer: its tracking number. */
  exchangeNid: (id: number, nid: string) => patch(id, 'exchange/nid', { nid }),
  exchangeDelivered: (id: number, note?: string) => patch(id, 'exchange/delivered', { note }),
  exchangeFailed: (id: number, note?: string) => patch(id, 'exchange/failed', { note }),
  /** Failed exchange: book a new parcel, switch to a return, or cancel. */
  exchangeDecide: (id: number, action: 'retry' | 'return' | 'cancel', note?: string) => patch(id, 'exchange/decide', { action, note }),

  // ── Returns policy v2 (exchange-first) ──
  /** The shop never clicked « Colis retour reçu »: the admin starts the inspection. */
  startInspection: (id: number, note?: string) => patch(id, 'start-inspection', { note }),
  /** Inspection on the shop's behalf (Non conforme needs a comment and a photo). */
  inspect: (id: number, result: 'conform' | 'nonconform', comment?: string, photos: File[] = []) => {
    const fd = new FormData()
    fd.append('result', result)
    if (comment) fd.append('comment', comment)
    photos.forEach(f => fd.append('photos[]', f))
    return formRequest<One>(`/admin/complaints/${id}/inspect`, fd)
  },
  /** Decision on a non-conforming item whose client was already refunded in cash. */
  dispute: (id: number, body: { decision: 'charge_seller' | 'absorb' | 'contact_client' | 'send_back' | 'treat_as_conform'; amount?: number; note?: string; nid?: string; cod_amount?: number }) =>
    patch(id, 'dispute', body),
  /** The client refused the parcel sent back: the item returns to the seller, decide again. */
  sentBackRefused: (id: number, note?: string) => patch(id, 'sent-back-refused', { note }),
  policy: () => jsonRequest<{ success: boolean; data: ReturnsPolicySettings }>('GET', '/admin/returns-policy'),
  updatePolicy: (body: Partial<ReturnsPolicySettings>) => jsonRequest<{ success: boolean; data: ReturnsPolicySettings }>('PUT', '/admin/returns-policy', body),
  /** Finance: each return with refund, payer, seller charges, dispute decision. */
  financeReturns: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString()
    return jsonRequest<{ success: boolean; data: any }>('GET', `/admin/finance/returns${qs ? `?${qs}` : ''}`)
  },

  /** Return or exchange slip PDF for the delivery company. Resolves with the file name. */
  returnSlip: (id: number, exchange = false) =>
    downloadPdf(() => api.get(`/admin/complaints/${id}/return-slip`, { responseType: 'blob', timeout: 120_000 }), `${exchange ? 'exchange' : 'return'}-${id}-slip.pdf`),
}
