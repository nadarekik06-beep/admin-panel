// lib/api/orders.ts  (admin panel)

import api from '../axios'
import type { Order, PaginatedResponse } from '@/types'

interface OrdersParams {
  status?:          string
  search?:          string
  payment_method?:  string
  seller_type?:     'all' | 'platform' | 'sellers'  // ← NEW
  date_from?:       string
  date_to?:         string
  page?:            number
  per_page?:        number
}

export const ordersApi = {
  confirmPayment: (id: number, d17Reference?: string) =>
    api.patch(`/admin/orders/${id}/confirm-payment`, {
      ...(d17Reference ? { d17_reference: d17Reference } : {}),
    }),

  async list(params: OrdersParams = {}): Promise<PaginatedResponse<Order>> {
    const res = await api.get('/admin/orders', { params })
    return res.data.data
  },

  async get(id: number): Promise<Order> {
    const res = await api.get(`/admin/orders/${id}`)
    return res.data.data
  },

  async updateStatus(id: number, status: string, scope?: 'all' | 'platform' | 'sellers') {
    try {
      const res = await api.patch(`/admin/orders/${id}/status`, {
        status,
        ...(scope ? { scope } : {}),
      })
      return res.data
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.debug ??
        `Failed to update status to "${status}".`
      throw new Error(msg)
    }
  },

  async stats() {
    const res = await api.get('/admin/orders/stats')
    return res.data.data
  },
  async updatePaymentStatus(id: number, paymentStatus: 'unpaid' | 'paid' | 'refunded') {
  try {
    const res = await api.patch(`/admin/orders/${id}/payment-status`, {
      payment_status: paymentStatus,
    })
    return res.data
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ??
      `Failed to update payment status to "${paymentStatus}".`
    throw new Error(msg)
  }
},
}