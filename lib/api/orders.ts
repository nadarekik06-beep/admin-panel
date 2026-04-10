// lib/api/orders.ts  (admin panel)
// CORRECT PATH: lib/api/orders.ts  — not lib/orders.ts

import api from '../axios'
import type { Order, PaginatedResponse } from '@/types'

interface OrdersParams {
  status?:         string
  search?:         string
  payment_method?: string   // ← ADDED
  date_from?:      string
  date_to?:        string
  page?:           number
  per_page?:       number
}

export const ordersApi = {
  /**
   * Manually confirm payment for COD and D17 orders.
   * PATCH /api/admin/orders/{id}/confirm-payment
   */
  confirmPayment: (id: number, d17Reference?: string) =>
    api.patch(`/admin/orders/${id}/confirm-payment`, {
      ...(d17Reference ? { d17_reference: d17Reference } : {}),
    }),

  /**
   * List orders (paginated).
   * Backend returns { success, data: { data: [...], total, ... } }
   * This unwraps to the inner paginated object.
   */
  async list(params: OrdersParams = {}): Promise<PaginatedResponse<Order>> {
    const res = await api.get('/admin/orders', { params })
    return res.data.data
  },

  /**
   * Get full order by ID.
   * Response includes items[] each with:
   *   - resolved_image_url (variant image → product primary image fallback)
   *   - variant_options { color: { value, color_hex }, size: { value } ... }
   *   - variant_label (snapshot string e.g. "Red / M")
   */
  async get(id: number): Promise<Order> {
    const res = await api.get(`/admin/orders/${id}`)
    return res.data.data
  },

  /**
   * Update order status.
   * Throws with a human-readable message on failure so the UI can display it.
   */
  async updateStatus(id: number, status: string) {
    try {
      const res = await api.patch(`/admin/orders/${id}/status`, { status })
      return res.data
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.debug ??
        `Failed to update status to "${status}".`
      throw new Error(msg)
    }
  },
}