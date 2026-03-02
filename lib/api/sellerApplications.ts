import api from '../axios'

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
  user?: {
    id: number
    name: string
    email: string
    role: string
  }
}

export interface ApplicationsParams {
  status?: 'pending' | 'approved' | 'rejected' | ''
  search?: string
  page?: number
  per_page?: number
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'

export function storageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${BASE.replace(/\/api$/, '')}/storage/${path.replace(/^\//, '')}`
}

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
    await api.post(`/admin/seller-applications/${id}/approve`)
  },

  async reject(id: number, rejection_reason?: string) {
    await api.post(`/admin/seller-applications/${id}/reject`, { rejection_reason })
  },
}