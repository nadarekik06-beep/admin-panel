/**
 * FILE: lib/vipRequestApi.ts  (Admin Panel — port 3001)
 *
 * Exact same pattern as complaintApi.ts:
 *   - getToken() reads 'admin_token' cookie via js-cookie
 *   - jsonRequest() is the internal fetch helper
 *   - All endpoints are under /admin/vip-requests
 */

import Cookies from 'js-cookie'

const RAW_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
const API_URL = RAW_URL.endsWith('/api') ? RAW_URL : `${RAW_URL}/api`

function getToken(): string | null {
  return Cookies.get('admin_token') ?? null
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function jsonRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
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

// ── Types ─────────────────────────────────────────────────────────────────────

export type VipRequestType   = 'reel' | 'promotion' | 'support'
export type VipRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'

export interface VipRequestSeller {
  id:     number
  name:   string
  email:  string
  avatar: string | null
}

export interface VipRequestHandler {
  id:   number
  name: string
}

export interface VipRequest {
  id:           number
  type:         VipRequestType
  type_label:   string
  status:       VipRequestStatus
  status_label: string
  message:      string
  admin_note:   string | null
  created_at:   string
  handled_at:   string | null
  seller:       VipRequestSeller | null
  handler:      VipRequestHandler | null
}

export interface VipRequestStats {
  total:       number
  pending:     number
  in_progress: number
  completed:   number
  rejected:    number
  by_type: {
    reel:      number
    promotion: number
    support:   number
  }
}

export interface VipRequestListParams {
  status?:   VipRequestStatus | ''
  type?:     VipRequestType | ''
  search?:   string
  page?:     number
  per_page?: number
}

// ── API ───────────────────────────────────────────────────────────────────────

export const adminVipRequestApi = {
  stats: () =>
    jsonRequest<{ success: boolean; data: VipRequestStats }>('GET', '/admin/vip-requests/stats'),

  getAll: (params: VipRequestListParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return jsonRequest<{ success: boolean; data: VipRequest[]; meta: any }>(
      'GET',
      `/admin/vip-requests${qs ? `?${qs}` : ''}`
    )
  },

  getOne: (id: number) =>
    jsonRequest<{ success: boolean; data: VipRequest }>('GET', `/admin/vip-requests/${id}`),

  approve: (id: number, admin_note?: string) =>
    jsonRequest<{ success: boolean; message: string; data: VipRequest }>(
      'PATCH', `/admin/vip-requests/${id}/approve`, admin_note ? { admin_note } : undefined
    ),

  complete: (id: number, admin_note?: string) =>
    jsonRequest<{ success: boolean; message: string; data: VipRequest }>(
      'PATCH', `/admin/vip-requests/${id}/complete`, admin_note ? { admin_note } : undefined
    ),

  reject: (id: number, admin_note: string) =>
    jsonRequest<{ success: boolean; message: string; data: VipRequest }>(
      'PATCH', `/admin/vip-requests/${id}/reject`, { admin_note }
    ),

  addNote: (id: number, admin_note: string) =>
    jsonRequest<{ success: boolean; message: string; data: VipRequest }>(
      'PATCH', `/admin/vip-requests/${id}/note`, { admin_note }
    ),
}