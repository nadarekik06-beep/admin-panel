import api from '../axios'

export type ChangeGroup = 'text' | 'price' | 'stock' | 'category' | 'images' | 'variants' | 'attributes' | 'settings'
export type ChangeSource = 'seller_edit' | 'restock' | 'images' | 'admin_revert'
export type SensitiveReason = 'name_changed' | 'category_changed' | 'images_changed' | 'price_jump'

export interface ChangeItem {
  id: number
  field: string
  group: ChangeGroup
  label: string
  old_display: string | null
  new_display: string | null
  old_images: string[] | null
  new_images: string[] | null
  is_long_text: boolean
  is_sensitive: boolean
  revertible: boolean
  reverted_at: string | null
}

export interface ChangeSet {
  id: number
  source: ChangeSource
  summary: string | null
  groups: ChangeGroup[]
  is_sensitive: boolean
  sensitive_reasons: SensitiveReason[]
  stock_only: boolean
  notified: boolean
  created_at: string
  reverted_at: string | null
  reverted_by: { id: number; name: string } | null
  seller: { id: number; name: string; email: string } | null
  product: {
    id: number
    name: string
    slug: string
    is_active: boolean
    status: string
    primary_image_url: string | null
    storefront_url: string
  } | null
  items: ChangeItem[]
}

export interface ChangeStats {
  today: number
  last_7_days: number
  sensitive_7d: number
  price_7d: number
  reverted_7d: number
  sellers: { id: number; name: string }[]
}

export interface ChangeFilters {
  search?: string
  seller_id?: number | ''
  group?: ChangeGroup | ''
  sensitive?: boolean
  source?: ChangeSource | ''
  from?: string
  to?: string
  page?: number
}

export interface RevertResult {
  reverted: number[]
  conflicts: Record<string, string>
  skipped: number[]
  set: ChangeSet
}

export const productChangesApi = {
  async list(filters: ChangeFilters) {
    const params: Record<string, unknown> = {}
    Object.entries(filters).forEach(([k, v]) => {
      if (v === '' || v === undefined || v === false) return
      params[k] = typeof v === 'boolean' ? 1 : v
    })
    const res = await api.get('/admin/product-changes', { params })
    return res.data.data as { data: ChangeSet[]; current_page: number; last_page: number; total: number; from: number; to: number }
  },

  async get(id: number): Promise<ChangeSet> {
    const res = await api.get(`/admin/product-changes/${id}`)
    return res.data.data
  },

  async stats(): Promise<ChangeStats> {
    const res = await api.get('/admin/product-changes/stats')
    return res.data.data
  },

  /** Reverts the given items (all revertible ones when omitted). 409 = changed again since. */
  async revert(id: number, itemIds?: number[], force = false): Promise<{ message: string; data: RevertResult }> {
    const res = await api.post(`/admin/product-changes/${id}/revert`, { item_ids: itemIds, force })
    return { message: res.data.message, data: res.data.data }
  },
}
