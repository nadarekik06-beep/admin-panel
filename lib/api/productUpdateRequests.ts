// lib/api/productUpdateRequests.ts  (admin panel)

import api from '../axios'

export interface UpdateRequest {
  id: number
  product_id: number
  seller_id: number
  proposed_data: Record<string, any>
  status: 'pending' | 'approved' | 'rejected'
  admin_comment: string | null
  created_at: string
  updated_at: string
  product?: {
    id: number
    name: string
    slug: string
    price: number
    stock: number
    primary_image_url: string | null
    category?: { id: number; name: string }
  }
  seller?: {
    id: number
    name: string
    email: string
  }
  current_data?: Record<string, any>
}

export interface UpdateRequestsParams {
  status?: string
  search?: string
  page?: number
  per_page?: number
}

export const productUpdateRequestsApi = {
  async stats() {
    const res = await api.get('/admin/product-update-requests/stats')
    return res.data.data as { pending: number; approved: number; rejected: number; total: number }
  },

  async list(params: UpdateRequestsParams = {}) {
    const res = await api.get('/admin/product-update-requests', { params })
    return res.data.data
  },

  async get(id: number) {
    const res = await api.get(`/admin/product-update-requests/${id}`)
    return res.data.data as UpdateRequest
  },

  async approve(id: number) {
    await api.post(`/admin/product-update-requests/${id}/approve`)
  },

  async reject(id: number, admin_comment?: string) {
    await api.post(`/admin/product-update-requests/${id}/reject`, { admin_comment })
  },
}