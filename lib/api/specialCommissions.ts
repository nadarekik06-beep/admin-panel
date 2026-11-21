import api from '../axios'

/**
 * Admin "Special Commissions". Every number comes from the backend (CommissionService):
 * the admin panel never calculates a commission.
 */

export type OverrideType = 'fixed_rate' | 'reduction_points'
export type OverrideStatus = 'active' | 'scheduled' | 'expired' | 'ended'
export type RateSource = 'override' | 'plan' | 'default' | 'product_override'

export interface SpecialCommission {
  id: number
  product_id: number
  product_name: string | null
  product_price: number | null
  /** Cover image path/URL (same cover as the storefront card) */
  product_image?: string | null
  seller_id: number | null
  seller_name: string | null
  type: OverrideType
  value: number
  label: string
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  status: OverrideStatus
  /** Internal, admin only: never shown to the seller */
  note: string | null
  created_by: string | null
  created_at: string | null
}

export interface SpecialCommissionList {
  data: SpecialCommission[]
  meta: { current_page: number; last_page: number; total: number }
  counts: { active: number; scheduled: number; expired: number }
}

export interface SellerProductRow {
  id: number
  name: string
  price: number
  is_active: boolean
  is_approved: boolean
  /** Cover image path/URL (same cover as the storefront card) */
  image: string | null
  /** Special commission already live or scheduled on it */
  offer: SpecialCommission | null
}

export type PreviewWarning = 'below_floor' | 'zero_commission' | 'clamped_to_zero'

export interface CommissionPreviewRow {
  product: { id: number; name: string; seller_id: number | null; image: string | null }
  price: { unit: number; original: number; platform_funded: number }
  floor: number
  /** What would apply WITHOUT a product special commission: a reduction applies to this rate */
  normal: { rate: number; source: 'override' | 'plan' | 'default'; plan: string; plan_name: string; commission: number; seller_amount: number }
  /** What applies right now (a live special commission included) */
  current: { rate: number; source: RateSource; commission: number; seller_amount: number; override_id: number | null }
  proposed: { type: OverrideType; value: number; rate: number; commission: number; seller_amount: number; seller_gain: number } | null
  warnings: PreviewWarning[]
}

/** Form-style preview: what a seller earns at a price (add-on-behalf and review screens). */
export interface PricePreview {
  commission_percentage: number
  commission_amount: number
  seller_amount: number
  unit_price: number
  normal_rate: number
  commission_source: RateSource
  commission_override_id: number | null
  special_offer: { type: OverrideType; value: number; rate: number; normal_rate: number; ends_at: string | null } | null
}

export interface AuditEntry {
  id: number
  override_id: number | null
  product_id: number
  product_name: string | null
  seller_id: number | null
  action: 'created' | 'updated' | 'ended' | 'deleted' | 'expired'
  actor_role: 'admin' | 'system'
  actor_name: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
}

export interface OfferInput {
  type: OverrideType
  value: number
  starts_at?: string | null
  ends_at?: string | null
  note?: string | null
}

export interface ListFilters {
  status?: 'active' | 'scheduled' | 'expired'
  seller_id?: number
  q?: string
  page?: number
}

const base = '/admin/special-commissions'

export const specialCommissionsApi = {
  async list(params: ListFilters = {}): Promise<SpecialCommissionList> {
    const res = await api.get(base, { params })
    return res.data
  },
  async sellerProducts(sellerId: number, q = ''): Promise<SellerProductRow[]> {
    const res = await api.get(`${base}/sellers/${sellerId}/products`, { params: { q: q || undefined } })
    return res.data.data
  },
  async preview(productIds: number[], offer?: { type: OverrideType; value: number }): Promise<CommissionPreviewRow[]> {
    const res = await api.post(`${base}/preview`, { product_ids: productIds, ...(offer ?? {}) })
    return res.data.data
  },
  async previewPrice(body: { seller_id: number; product_id?: number | null; price: number; tier_price?: number | null }): Promise<PricePreview> {
    const res = await api.post(`${base}/preview-price`, body)
    return res.data.data
  },
  async create(productIds: number[], offer: OfferInput) {
    const res = await api.post(base, { product_ids: productIds, ...offer })
    return res.data as { message: string; data: SpecialCommission[]; failed: { product_id: number; errors: Record<string, string[]> }[] }
  },
  async update(id: number, body: Partial<OfferInput>) {
    return (await api.put(`${base}/${id}`, body)).data as { message: string; data: SpecialCommission }
  },
  async end(id: number) {
    return (await api.post(`${base}/${id}/end`)).data as { message: string; data: SpecialCommission }
  },
  async remove(id: number) {
    return (await api.delete(`${base}/${id}`)).data as { message: string }
  },
  async forProduct(productId: number): Promise<{ active: SpecialCommission | null; scheduled: SpecialCommission | null; history: SpecialCommission[] }> {
    const res = await api.get(`${base}/product/${productId}`)
    return res.data.data
  },
  async logs(params: { product_id?: number; override_id?: number; seller_id?: number } = {}): Promise<AuditEntry[]> {
    const res = await api.get(`${base}/logs`, { params })
    return res.data.data
  },
}

/** "Current rate: 8% (seller override)" */
export const SOURCE_LABEL: Record<RateSource, string> = {
  override: 'seller override',
  plan: 'plan rate',
  default: 'platform default',
  product_override: 'special commission',
}
