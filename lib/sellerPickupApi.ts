/**
 * Seller pickup address (admin): /api/admin/sellers/{id}/pickup…, zone search.
 * Fields follow Intigo's "Nouvelle adresse" form. Same fetch pattern as intigoApi.ts.
 */

import Cookies from 'js-cookie'

const RAW_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
export const API_URL = RAW_URL.endsWith('/api') ? RAW_URL : `${RAW_URL}/api`

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
    const err = new Error(errors || json.message || 'Request failed') as Error & { status?: number; errors?: Record<string, string[]> }
    err.status = res.status
    err.errors = json?.errors
    throw err
  }
  return json as T
}

export type ZoneType = 'DELEGATION' | 'SECTEUR'
export type PickupStatus = 'needs_review' | 'changed' | 'unverified' | 'verified' | 'created'

export interface ZoneOption {
  id: number
  type: ZoneType
  intigo_id: number
  name: string
  name_ar: string | null
  delegation: string
  gouvernorat: string
  display_label: string
  latitude: number | null
  longitude: number | null
}

export interface PickupCard {
  exists: boolean
  adresse_complete?: string | null
  intigo_zone_id?: number | null
  zone?: ZoneOption | null
  gouvernorat?: string | null
  latitude?: number | null
  longitude?: number | null
  contact_name?: string | null
  phone?: string | null
  code_postal?: string | null
  indications?: string | null
  status: PickupStatus
  needs_review?: boolean
  change_pending?: boolean
  address_verified_by_admin?: boolean
  verified_at?: string | null
  verified_by?: string | null
  intigo_pickup_created?: boolean
  intigo_pickup_created_at?: string | null
  intigo_pickup_created_via?: 'api' | 'manual' | null
  intigo_pickup_index?: number | null
  intigo_pickup_label?: string | null
  intigo_street_address?: string | null
  last_address_change_at?: string | null
  intigo_ready?: boolean
  missing: string[]
  complete: boolean
  pin_check?: { distance_km: number; limit_km: number; far: boolean } | null
  google_maps_url?: string | null
  legacy_snapshot?: Record<string, string> | null
  pending_pickups?: number
}

export interface PickupChange {
  id: number
  at: string
  by: string | null
  by_role: 'seller' | 'admin'
  source: 'application' | 'settings' | 'admin'
  changed_fields: string[]
  old: Record<string, string | number | null> | null
  new: Record<string, string | number | null>
  pending_pickups: number
}

export interface PickupResponse {
  seller: { id: number; name: string; email: string; shop: string | null }
  pickup: PickupCard
  history: PickupChange[]
  intigo_mode?: 'fake' | 'live'
}

export interface PickupInput {
  adresse_complete: string
  intigo_zone_id: number | null
  latitude: number | null
  longitude: number | null
  contact_name: string
  phone: string
  code_postal: string
  indications: string | null
}

type Envelope = { success: boolean; message?: string; data: PickupResponse }

export const sellerPickupApi = {
  get: (sellerId: number) => request<Envelope>('GET', `/admin/sellers/${sellerId}/pickup`),
  update: (sellerId: number, body: PickupInput) => request<Envelope>('PUT', `/admin/sellers/${sellerId}/pickup`, body),
  verify: (sellerId: number, verified = true) => request<Envelope>('POST', `/admin/sellers/${sellerId}/pickup/verify`, { verified }),
  createInIntigo: (sellerId: number) => request<Envelope>('POST', `/admin/sellers/${sellerId}/pickup/intigo-create`),
  markCreated: (sellerId: number, index: number, label?: string) =>
    request<Envelope>('POST', `/admin/sellers/${sellerId}/pickup/intigo-manual`, { index, label: label || null }),
  searchZones: async (q: string, signal?: AbortSignal): Promise<ZoneOption[]> => {
    const res = await fetch(`${API_URL}/intigo-zones?q=${encodeURIComponent(q)}&limit=20`, { headers: { Accept: 'application/json' }, signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()).data ?? []
  },
  zoneCenter: async (zoneId: number): Promise<{ latitude: number; longitude: number; precision: string; warn_km: number } | null> => {
    try {
      const res = await fetch(`${API_URL}/intigo-zones/${zoneId}/center`, { headers: { Accept: 'application/json' } })
      return res.ok ? ((await res.json()).data ?? null) : null
    } catch { return null }
  },
}

export const PICKUP_STATUS: Record<PickupStatus, { label: string; color: string; bg: string }> = {
  needs_review: { label: 'Needs review',                     color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  changed:      { label: 'Adresse modifiée – à mettre à jour', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  unverified:   { label: 'Non vérifiée',                     color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  verified:     { label: 'Vérifiée, pas encore dans Intigo',  color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  created:      { label: 'Pickup Intigo créé',               color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
}
