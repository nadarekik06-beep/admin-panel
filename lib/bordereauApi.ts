/**
 * Bordereau of a seller_order (admin): /api/admin/seller-orders/{id}/bordereau.
 * The admin attaches the PDF downloaded from the Intigo dashboard; the seller is
 * notified and prints it from the seller dashboard.
 */

import api from './axios'

/** seller_orders[].intigo.bordereau and parcels_summary[].bordereau (IntigoController::bordereauSummary). */
export interface BordereauSummary {
  /** The seller can print it (uploaded, or Intigo's while INTIGO_BORDEREAU_ENABLED is on) */
  available: boolean
  source: 'manual' | 'intigo' | null
  has_upload: boolean
  original_name: string | null
  uploaded_at: string | null
  uploaded_by: { id: number; name: string } | null
  versions: number
  notified_at: string | null
  notify_error: string | null
  first_printed_at: string | null
  last_printed_at: string | null
  print_count: number
  can_upload: boolean
  upload_block_reason: string | null
}

type Answer = { success: boolean; message: string; data: BordereauSummary }

/** Laravel's message (validation errors first) from an axios error. */
export function bordereauError(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
  const first = data?.errors ? Object.values(data.errors).flat()[0] : null
  return first || data?.message || 'Request failed'
}

export const bordereauApi = {
  upload: (sellerOrderId: number, file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Answer>(`/admin/seller-orders/${sellerOrderId}/bordereau`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      onUploadProgress: e => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)) },
    }).then(r => r.data)
  },
  remove: (sellerOrderId: number) =>
    api.delete<Answer>(`/admin/seller-orders/${sellerOrderId}/bordereau`).then(r => r.data),
  resendNotification: (sellerOrderId: number) =>
    api.post<Answer>(`/admin/seller-orders/${sellerOrderId}/bordereau/notify`).then(r => r.data),
  /** The PDF (logged as an admin view, never counted as the seller's print). */
  pdf: (sellerOrderId: number) =>
    api.get<Blob>(`/admin/seller-orders/${sellerOrderId}/bordereau`, { responseType: 'blob', timeout: 60_000 }).then(r => r.data),
}
