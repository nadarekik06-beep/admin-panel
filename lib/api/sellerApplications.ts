import api from '../axios'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PreferredPlan = 'green' | 'red' | 'black'
export type ActivePlan    = 'free'  | 'red' | 'black'

export interface SellerApplication {
  id: number
  user_id: number
  full_name: string
  phone_number: string
  business_name: string
  business_category: string
  business_description: string
  wilaya: string
  city: string
  profile_picture: string | null
  sample_images: string[] | null
  facebook_url: string | null
  instagram_url: string | null
  website_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  reviewed_at: string | null
  reviewed_by: number | null
  created_at: string
  updated_at: string

  // ── Plan fields (separate concerns) ──────────────────────────────────────
  /**
   * What the seller expressed interest in on the pricing page.
   * Set at application time. Never changes after submission.
   * Used to show "Preferred Plan" in admin panel and upgrade prompts in dashboard.
   */
  preferred_plan: PreferredPlan

  /**
   * The ACTIVE subscription plan.
   * Always 'free' when the application is created or approved.
   * Only changes to 'red' or 'black' after the seller pays for an upgrade.
   */
  plan: ActivePlan

  user?: {
    id: number
    name: string
    email: string
    role: string
  }
}

export interface Seller {
  id: number
  name: string
  email: string
  is_active: boolean
  is_approved: boolean
  products_count: number
  created_at: string
  full_name: string | null
  phone_number: string | null
  business_name: string | null
  business_category: string | null
  business_description: string | null
  wilaya: string | null
  city: string | null
  profile_picture: string | null
  facebook_url: string | null
  instagram_url: string | null
  website_url: string | null
  app_status: 'pending' | 'approved' | 'rejected' | null
}

export interface SellersParams {
  status?: 'approved' | 'pending' | 'suspended' | ''
  search?: string
  page?: number
  per_page?: number
}

export interface ApplicationsParams {
  status?: 'pending' | 'approved' | 'rejected' | ''
  search?: string
  page?: number
  per_page?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'

export function storageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${BASE.replace(/\/api$/, '')}/storage/${path.replace(/^\//, '')}`
}

/**
 * Returns a human-readable label + color for a preferred_plan value.
 * Used in admin table badges and detail modal.
 */
export function preferredPlanMeta(plan: PreferredPlan): {
  label: string
  color: string
  bg: string
  border: string
} {
  switch (plan) {
    case 'red':
      return {
        label:  'Red Pepper (49 DT/mo)',
        color:  '#db142e',
        bg:     'rgba(219,20,46,0.10)',
        border: 'rgba(219,20,46,0.25)',
      }
    case 'black':
      return {
        label:  'Black Pepper (129 DT/mo)',
        color:  '#f59e0b',
        bg:     'rgba(245,158,11,0.10)',
        border: 'rgba(245,158,11,0.25)',
      }
    case 'green':
    default:
      return {
        label:  'Green Pepper (Free)',
        color:  '#198f41',
        bg:     'rgba(25,143,65,0.10)',
        border: 'rgba(25,143,65,0.25)',
      }
  }
}

// ─── Seller Applications ──────────────────────────────────────────────────────

export const sellerApplicationsApi = {
  async list(params: ApplicationsParams = {}) {
    const res = await api.get('/admin/seller-applications', { params })
    return res.data.data
  },

  async get(id: number) {
    const res = await api.get(`/admin/seller-applications/${id}`)
    return res.data.data as SellerApplication
  },

  async approve(id: number) {
    const res = await api.post(`/admin/seller-applications/${id}/approve`)
    return res.data
  },

  async reject(id: number, rejection_reason?: string) {
    const res = await api.post(`/admin/seller-applications/${id}/reject`, {
      rejection_reason,
    })
    return res.data
  },
}

// ─── Sellers ──────────────────────────────────────────────────────────────────

export const sellersApi = {
  async list(params: SellersParams = {}) {
    const res = await api.get('/admin/sellers', { params })
    return res.data.data
  },

  async get(id: number) {
    const res = await api.get(`/admin/sellers/${id}`)
    return res.data.data as Seller
  },

  async update(id: number, payload: Partial<Seller>) {
    const res = await api.put(`/admin/sellers/${id}`, payload)
    return res.data
  },

  async destroy(id: number) {
    const res = await api.delete(`/admin/sellers/${id}`)
    return res.data
  },

  async approve(id: number) {
    const res = await api.patch(`/admin/sellers/${id}/approve`)
    return res.data
  },

  async reject(id: number, reason?: string) {
    const res = await api.patch(`/admin/sellers/${id}/reject`, { reason })
    return res.data
  },

  async suspend(id: number) {
    const res = await api.patch(`/admin/sellers/${id}/suspend`)
    return res.data
  },

  async changeRole(id: number, role: 'client' | 'seller') {
    const res = await api.patch(`/admin/sellers/${id}/role`, { role })
    return res.data
  },

  // Alias for destroy — used in SellerApplicationsPage
  async delete(id: number) {
    return this.destroy(id)
  },
}

// ─── Admin Products ───────────────────────────────────────────────────────────

export const adminProductsApi = {
  async approve(id: number) {
    const res = await api.patch(`/admin/products/${id}/approve`)
    return res.data
  },

  async reject(id: number, reason?: string) {
    const res = await api.patch(`/admin/products/${id}/reject`, { reason })
    return res.data
  },

  async update(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/admin/products/${id}`, payload)
    return res.data
  },
}