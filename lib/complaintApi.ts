/**
 * lib/complaintApi.ts
 * All complaint-related API calls for the ChooseTounsi frontend.
 */

import type {
  Complaint,
  ComplaintFormPayload,
  EligibleOrder,
} from '../types/complaint'

const RAW_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
const API_URL = RAW_URL.endsWith('/api') ? RAW_URL : `${RAW_URL}/api`

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('ct_auth_token')
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─── Generic JSON request ────────────────────────────────────────────────────

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

// ─── Multipart form request (for file upload) ─────────────────────────────────

async function formRequest<T>(path: string, data: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
      // Do NOT set Content-Type — let browser set multipart boundary
    },
    body: data,
  })
  const json = await res.json()
  if (!res.ok) {
    const err: any = new Error(json.message ?? 'Request failed')
    err.response = { data: json, status: res.status }
    throw err
  }
  return json
}

// ─── Client API ───────────────────────────────────────────────────────────────

export const complaintApi = {
  /**
   * GET /api/client/complaints/eligible-orders
   * Returns orders the user can file a complaint on.
   */
  getEligibleOrders: () =>
    jsonRequest<{ success: boolean; window_days: number; data: EligibleOrder[] }>(
      'GET',
      '/client/complaints/eligible-orders'
    ),

  /**
   * GET /api/client/complaints
   * All complaints filed by the current user (paginated).
   */
  getAll: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return jsonRequest<{ success: boolean; data: any }>(
      'GET',
      `/client/complaints${qs ? `?${qs}` : ''}`
    )
  },

  /**
   * GET /api/client/complaints/{id}
   */
  getOne: (id: number) =>
    jsonRequest<{ success: boolean; data: Complaint }>(
      'GET',
      `/client/complaints/${id}`
    ),

  /**
   * POST /api/client/complaints
   * Submits a new complaint. Uses FormData for image upload.
   */
  submit: (payload: ComplaintFormPayload) => {
    const fd = new FormData()
    fd.append('order_id',        String(payload.order_id))
    fd.append('complaint_type',  payload.complaint_type)
    fd.append('description',     payload.description)
    if (payload.other_reason) {
      fd.append('other_reason', payload.other_reason)
    }
    if (payload.image) {
      fd.append('image', payload.image)
    }
    return formRequest<{ success: boolean; message: string; data: Complaint }>(
      '/client/complaints',
      fd
    )
  },
}

// ─── Seller API ───────────────────────────────────────────────────────────────

export const sellerComplaintApi = {
  stats: () =>
    jsonRequest<{ success: boolean; data: any }>('GET', '/seller/complaints/stats'),

  getAll: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return jsonRequest<{ success: boolean; data: any }>(
      'GET',
      `/seller/complaints${qs ? `?${qs}` : ''}`
    )
  },

  getOne: (id: number) =>
    jsonRequest<{ success: boolean; data: Complaint }>(
      'GET',
      `/seller/complaints/${id}`
    ),

  addNote: (id: number, seller_note: string) =>
    jsonRequest<{ success: boolean; message: string; data: Complaint }>(
      'PATCH',
      `/seller/complaints/${id}/note`,
      { seller_note }
    ),
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminComplaintApi = {
  stats: () =>
    jsonRequest<{ success: boolean; data: any }>('GET', '/admin/complaints/stats'),

  getAll: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return jsonRequest<{ success: boolean; data: any }>(
      'GET',
      `/admin/complaints${qs ? `?${qs}` : ''}`
    )
  },

  getOne: (id: number) =>
    jsonRequest<{ success: boolean; data: Complaint }>(
      'GET',
      `/admin/complaints/${id}`
    ),

  approve: (id: number) =>
    jsonRequest<{ success: boolean; message: string; data: Complaint }>(
      'PATCH',
      `/admin/complaints/${id}/approve`
    ),

  reject: (id: number, rejection_reason: string) =>
    jsonRequest<{ success: boolean; message: string; data: Complaint }>(
      'PATCH',
      `/admin/complaints/${id}/reject`,
      { rejection_reason }
    ),
}