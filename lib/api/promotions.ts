import api from '../axios'

/**
 * Admin promotions (GET/POST /api/admin/promotions…): every seller and admin
 * promotion, and admin promotions on any seller's products. Same tables and
 * pricing as seller promotions; the seller pays the discount.
 */

export type PromotionType = 'flash_sale' | 'discount'
export type DiscountType = 'percentage' | 'fixed'
export type PromotionSource = 'seller' | 'admin'
export type PromotionStatus = 'active' | 'scheduled' | 'paused' | 'expired'

export interface AdminPromotion {
  id: number
  name: string
  type: PromotionType
  source: PromotionSource
  created_by_admin: { id: number; name: string } | null
  funded_by: string
  seller: { id: number; name: string; email: string | null }
  discount_type: DiscountType
  discount_value: number
  discount_label: string
  starts_at: string
  ends_at: string
  status: string
  display_status: PromotionStatus
  flash_stock: number | null
  flash_stock_used: number
  flash_stock_remaining: number | null
  order_items_count: number
  products_count: number
  products: Array<{
    id: number
    name: string
    slug: string
    price: number
    final_price: number
    /** false: another promotion prices it right now (older overlap) */
    priced_by_this: boolean
    primary_image_url: string | null
  }>
  created_at: string
}

export interface PromotionStats {
  total: number
  active: number
  scheduled: number
  paused: number
  admin: number
  seller: number
}

export interface PromotionFilters {
  page?: number
  seller_id?: number | ''
  status?: PromotionStatus | ''
  source?: PromotionSource | ''
  type?: PromotionType | ''
  search?: string
}

export interface Paginated<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
  from: number | null
  to: number | null
}

export interface PromoProduct {
  id: number
  name: string
  slug: string
  sku: string | null
  price: number
  stock: number
  variants_count: number
  primary_image_url: string | null
  seller: { id: number; name: string }
  final_price: number
  discount_percent: number
  current_promotion: { id: number; name: string; source: PromotionSource; ends_at: string | null } | null
}

export interface PreviewRow {
  current_price: number
  original_price: number
  final_price: number
  discount_amount: number
  discount_percent: number
  /** false: the discount would bring the price to 0 */
  valid: boolean
}

export interface ProductPreview extends PreviewRow {
  product_id: number
  name: string
  variants: Array<PreviewRow & { variant_id: number; label: string }>
}

export interface PromotionPayload {
  name: string
  type: PromotionType
  discount_type: DiscountType
  discount_value: number
  starts_at: string
  ends_at: string
  flash_stock?: number | null
  product_ids: number[]
  replace_conflicts?: boolean
}

export interface PromotionConflict {
  id: number
  name: string
  type: PromotionType
  source: PromotionSource
  seller_id: number
  discount_type: DiscountType
  discount_value: number
  status: PromotionStatus
  starts_at: string
  ends_at: string
  products: Array<{ id: number; name: string }>
}

/** 409 promotion_conflict body, or null for any other error. */
export function conflictsOf(err: unknown): { message: string; conflicts: PromotionConflict[] } | null {
  const r = (err as { response?: { status?: number; data?: { code?: string; message?: string; conflicts?: PromotionConflict[] } } })?.response
  if (r?.status === 409 && r.data?.code === 'promotion_conflict') {
    return { message: r.data.message ?? '', conflicts: r.data.conflicts ?? [] }
  }
  return null
}

export const promotionsApi = {
  async stats(): Promise<PromotionStats> {
    return (await api.get('/admin/promotions/stats')).data.data
  },
  async list(filters: PromotionFilters): Promise<Paginated<AdminPromotion>> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined))
    return (await api.get('/admin/promotions', { params })).data.data
  },
  async products(search: string, sellerId?: number | ''): Promise<PromoProduct[]> {
    return (await api.get('/admin/promotions/products', { params: { search, ...(sellerId ? { seller_id: sellerId } : {}) } })).data.data
  },
  async preview(productIds: number[], discountType: DiscountType, value: number): Promise<ProductPreview[]> {
    return (await api.post('/admin/promotions/preview', { product_ids: productIds, discount_type: discountType, discount_value: value })).data.data
  },
  async create(payload: PromotionPayload): Promise<{ message: string; data: AdminPromotion[] }> {
    return (await api.post('/admin/promotions', payload)).data
  },
  async update(id: number, payload: Partial<PromotionPayload>): Promise<{ message: string; data: AdminPromotion }> {
    return (await api.put(`/admin/promotions/${id}`, payload)).data
  },
  async pause(id: number): Promise<{ message: string; data: AdminPromotion }> {
    return (await api.post(`/admin/promotions/${id}/pause`)).data
  },
  async resume(id: number, replace = false): Promise<{ message: string; data: AdminPromotion }> {
    return (await api.post(`/admin/promotions/${id}/resume`, { replace_conflicts: replace })).data
  },
  async remove(id: number): Promise<{ message: string }> {
    return (await api.delete(`/admin/promotions/${id}`)).data
  },
}
