// ─────────────────────────────────────────────────────────────────────────────
// lib/api/products.ts  — replace your existing file entirely
// ─────────────────────────────────────────────────────────────────────────────
import api from '../axios'

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
  async disable(id: number) {
    await api.patch(`/admin/products/${id}/disable`)
  },
  async delete(id: number) {
    await api.delete(`/admin/products/${id}`)
  },
}