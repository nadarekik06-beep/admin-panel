/**
 * Seller store profile (admin): logo / description / activity categories the
 * seller edits from "Paramètres de la boutique", the change history (merged
 * with pickup address changes) and restore.
 *   GET  /api/admin/sellers/{id}/store-profile
 *   POST /api/admin/sellers/{id}/store-profile/restore/{changeId}
 */

import Cookies from 'js-cookie'
import { API_URL } from './sellerPickupApi'

async function request<T>(method: string, path: string): Promise<T> {
  const token = Cookies.get('admin_token')
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Accept: 'application/json', 'Accept-Language': 'en', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errors = json?.errors ? Object.values(json.errors).flat().join(' ') : null
    throw new Error(errors || json.message || 'Request failed')
  }
  return json as T
}

export type ProfileField = 'logo' | 'description' | 'categories' | 'pickup_address'

export interface ProfileChange {
  id: number
  kind: 'profile' | 'pickup'
  field: ProfileField
  at: string
  by: string | null
  by_role: 'seller' | 'admin' | string
  old: Record<string, unknown> | null
  new: Record<string, unknown> | null
  changed_fields?: string[]
  restored_from_id?: number | null
  restorable: boolean
}

export interface StoreProfileCard {
  business_name: string | null
  logo: string | null
  business_description: string | null
  business_categories: string[]
  categories: { name: string; name_fr: string | null; known: boolean }[]
  has_application: boolean
  history: ProfileChange[]
  /** stored category name → French label */
  category_labels: Record<string, string>
}

export const sellerStoreProfileApi = {
  get: (sellerId: number) =>
    request<{ success: boolean; data: StoreProfileCard }>('GET', `/admin/sellers/${sellerId}/store-profile`).then(r => r.data),
  restore: (sellerId: number, changeId: number) =>
    request<{ success: boolean; message: string; data: StoreProfileCard }>('POST', `/admin/sellers/${sellerId}/store-profile/restore/${changeId}`),
}
