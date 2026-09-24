import api from '../axios'
import type { ProductReview } from '@/types/productReview'

interface ProductsParams {
  status?: string
  search?: string
  category_id?: number
  page?: number
  per_page?: number
}

export interface ProductUpdatePayload {
  name?: string
  description?: string
  short_description?: string
  price?: number
  stock?: number
  category_id?: number
  is_active?: boolean
  is_approved?: boolean
  featured?: boolean
}

export const productsApi = {
  async list(params: ProductsParams = {}) {
    const res = await api.get('/admin/products', { params })
    return res.data.data
  },

  async get(id: number) {
    const res = await api.get(`/admin/products/${id}`)
    return res.data.data
  },

  async update(id: number, payload: ProductUpdatePayload) {
    const res = await api.put(`/admin/products/${id}`, payload)
    return res.data.data
  },

  async approve(id: number) {
    await api.patch(`/admin/products/${id}/approve`)
  },

  /** Full moderation payload for the review page. */
  async review(id: number): Promise<ProductReview> {
    const res = await api.get(`/admin/products/${id}/review`)
    return res.data.data
  },

  /** Reject with predefined reason codes (required) and an optional comment. */
  async reject(id: number, reasons: string[], note?: string) {
    await api.patch(`/admin/products/${id}/reject`, { reasons, note: note || null })
  },

  /** Send back to the seller with notes; returns to pending when they edit it. */
  async requestChanges(id: number, reasons: string[], note: string) {
    await api.patch(`/admin/products/${id}/request-changes`, { reasons, note })
  },

  async setFeatured(id: number, featured: boolean) {
    await api.patch(`/admin/products/${id}/featured`, { featured })
  },

  async disable(id: number) {
    await api.patch(`/admin/products/${id}/disable`)
  },

  async delete(id: number) {
    await api.delete(`/admin/products/${id}`)
  },

  async restore(id: number) {
    await api.post(`/admin/products/${id}/restore`)
  },

  async forceDelete(id: number) {
    await api.delete(`/admin/products/${id}/force`)
  },
}