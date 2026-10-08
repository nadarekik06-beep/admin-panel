// lib/api/orders.ts  (admin panel)

import api from '../axios'
import type { Order, PaginatedResponse } from '@/types'

export interface PickupAddressInput {
  full_name:          string
  phone_number:       string
  pickup_address:     string
  city:               string
  pickup_postal_code: string
  wilaya:             string
  pickup_notes?:      string
}

// ── PDF downloads ──────────────────────────────────────────────────────────
// The API answers a PDF on success, or JSON { message, issues } on error —
// with responseType 'blob' the error body must be decoded by hand.

async function errorMessage(err: any, fallback: string): Promise<string> {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text())
      return json.message ?? fallback
    } catch { return fallback }
  }
  return data?.message ?? fallback
}

function filenameFrom(disposition: string | undefined, fallback: string): string {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return match ? decodeURIComponent(match[1]) : fallback
}

export async function downloadPdf(request: () => Promise<any>, fallbackName: string): Promise<string> {
  try {
    const res  = await request()
    const name = filenameFrom(res.headers?.['content-disposition'], fallbackName)
    const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const a    = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return name
  } catch (err: any) {
    throw new Error(await errorMessage(err, 'Could not generate the PDF.'))
  }
}

const PDF = { responseType: 'blob' as const, timeout: 120_000 }

interface OrdersParams {
  status?:          string
  search?:          string
  payment_method?:  string
  seller_type?:     'all' | 'platform' | 'sellers'  // ← NEW
  date_from?:       string
  date_to?:         string
  needs_slips?:     1          // confirmed orders whose delivery slips were never exported
  page?:            number
  per_page?:        number
}

export const ordersApi = {
  confirmPayment: (id: number, d17Reference?: string) =>
    api.patch(`/admin/orders/${id}/confirm-payment`, {
      ...(d17Reference ? { d17_reference: d17Reference } : {}),
    }),

  // lib/api/orders.ts  — add these two methods to the ordersApi object

async confirmOrder(
  id: number,
  action: 'confirmed' | 'cancelled',
  adminNote?: string
) {
  try {
    const res = await api.patch(`/admin/orders/${id}/confirm-order`, {
      action,
      admin_note: adminNote ?? null,
    })
    return res.data
  } catch (err: any) {
    const msg = err?.response?.data?.message ?? `Failed to ${action} order.`
    throw new Error(msg)
  }
},

async saveNote(id: number, adminNote: string) {
  try {
    const res = await api.patch(`/admin/orders/${id}/note`, { admin_note: adminNote })
    return res.data
  } catch (err: any) {
    throw new Error(err?.response?.data?.message ?? 'Failed to save note.')
  }
},
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

  /** One seller sub-order's delivery slip. Resolves with the downloaded file name. */
  exportSlip: (orderId: number, sellerOrderId: number) =>
    downloadPdf(() => api.get(`/admin/orders/${orderId}/export/slips/${sellerOrderId}`, PDF), `order-${orderId}-slip.pdf`),

  /** Every slip of the order, one page per seller sub-order. */
  exportSlips: (orderId: number) =>
    downloadPdf(() => api.get(`/admin/orders/${orderId}/export/slips`, PDF), `order-${orderId}-slips.pdf`),

  /** INTERNAL summary with financials — admin records only. */
  exportSummary: (orderId: number) =>
    downloadPdf(() => api.get(`/admin/orders/${orderId}/export/summary`, PDF), `order-${orderId}-INTERNAL-summary.pdf`),

  /** Slips of several orders merged into one PDF. */
  exportBulkSlips: (orderIds: number[]) =>
    downloadPdf(() => api.post('/admin/orders/export/slips', { order_ids: orderIds }, PDF), 'delivery-slips.pdf'),

  async updateSellerPickup(sellerId: number, data: PickupAddressInput) {
    try {
      const res = await api.put(`/admin/sellers/${sellerId}/pickup-address`, data)
      return res.data.data
    } catch (err: any) {
      const errors = err?.response?.data?.errors as Record<string, string[]> | undefined
      throw new Error(errors ? Object.values(errors)[0][0] : (err?.response?.data?.message ?? 'Failed to save the pickup address.'))
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