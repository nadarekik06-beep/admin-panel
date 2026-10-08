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
  pickedUp: (id: number, note?: string) => patch(id, 'picked-up', { note }),
  receive: (id: number, conditions: Record<number, ItemCondition>, note?: string) => patch(id, 'receive', { conditions, note }),
  refund: (id: number, method: RefundMethod, reference?: string, note?: string) => patch(id, 'refund', { method, reference, note }),
  cancel: (id: number, reason: string) => patch(id, 'cancel', { reason }),
  close: (id: number, note?: string) => patch(id, 'close', { note }),

  /** Return slip PDF for the delivery company. Resolves with the file name. */
  returnSlip: (id: number) =>
    downloadPdf(() => api.get(`/admin/complaints/${id}/return-slip`, { responseType: 'blob', timeout: 120_000 }), `return-${id}-slip.pdf`),
}
