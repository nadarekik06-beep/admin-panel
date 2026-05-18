// lib/api/reviews.ts  (admin panel)
import api from '../axios'

export interface AdminReview {
  id: number
  rating: number
  body: string | null
  status: 'pending' | 'approved' | 'rejected' | 'flagged'
  is_verified: boolean
  helpful_count: number
  reports_count: number
  rejection_reason: string | null
  created_at: string
  user: { id: number; name: string; email: string } | null
  product: { id: number; name: string; slug?: string } | null
  media_count: number
}

export interface AdminReviewDetail extends AdminReview {
  media: { id: number; url: string; is_approved: boolean }[]
  tags: { id: number; label: string; sentiment: string; icon: string }[]
  reply: { id: number; body: string; created_at: string } | null
  seller: { id: number; name: string; email: string } | null
}

export interface ReviewStats {
  total: number
  approved: number
  pending: number
  flagged: number
  rejected: number
  pending_reports: number
}

export interface AdminReport {
  id: number
  reason: string
  note: string | null
  status: 'pending' | 'reviewed' | 'dismissed'
  created_at: string
  review: {
    id: number
    rating: number
    body: string | null
    status: string
    product_id: number
    product?: { id: number; name: string } | null
  } | null
  reporter: { id: number; name: string; email: string } | null
}

export interface ReviewsParams {
  status?: string
  rating?: number | string
  has_reports?: '0' | '1'
  search?: string
  page?: number
  per_page?: number
}

export const adminReviewsApi = {
  // ── Stats ──────────────────────────────────────────────────────────────────
  async stats(): Promise<ReviewStats> {
    const res = await api.get('/admin/reviews/stats')
    return res.data.data
  },

  // ── List ───────────────────────────────────────────────────────────────────
  async list(params: ReviewsParams = {}) {
    const res = await api.get('/admin/reviews', { params })
    return res.data
  },

  // ── Approve ────────────────────────────────────────────────────────────────
  async approve(id: number) {
    const res = await api.patch(`/admin/reviews/${id}/approve`)
    return res.data
  },

  // ── Reject ─────────────────────────────────────────────────────────────────
  async reject(id: number, reason?: string) {
    const res = await api.patch(`/admin/reviews/${id}/reject`, { reason })
    return res.data
  },

  // ── Flag ───────────────────────────────────────────────────────────────────
  async flag(id: number) {
    const res = await api.patch(`/admin/reviews/${id}/flag`)
    return res.data
  },

  // ── Delete ─────────────────────────────────────────────────────────────────
  async delete(id: number) {
    const res = await api.delete(`/admin/reviews/${id}`)
    return res.data
  },

  // ── Media: delete ──────────────────────────────────────────────────────────
  async deleteMedia(mediaId: number) {
    const res = await api.delete(`/admin/review-media/${mediaId}`)
    return res.data
  },

  // ── Media: hide ────────────────────────────────────────────────────────────
  async hideMedia(mediaId: number) {
    const res = await api.patch(`/admin/review-media/${mediaId}/hide`)
    return res.data
  },

  // ── Reports list ───────────────────────────────────────────────────────────
  async reports(params: { status?: string; page?: number } = {}) {
    const res = await api.get('/admin/review-reports', { params })
    return res.data
  },

  // ── Resolve report ─────────────────────────────────────────────────────────
  async resolveReport(reportId: number, action: 'dismiss' | 'flag_review' | 'reject_review') {
    const res = await api.patch(`/admin/review-reports/${reportId}/resolve`, { action })
    return res.data
  },

  // ── Delete reply ───────────────────────────────────────────────────────────
  async deleteReply(replyId: number) {
    const res = await api.delete(`/admin/review-replies/${replyId}`)
    return res.data
  },
}