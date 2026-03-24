import api from '../axios'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Seller Applications ──────────────────────────────────────────────────────
//
// Matching routes in api.php (admin block, middleware: auth:sanctum):
//   GET  /admin/seller-applications
//   GET  /admin/seller-applications/{application}
//   POST /admin/seller-applications/{application}/approve
//   POST /admin/seller-applications/{application}/reject
//
// ⚠️  REQUIRED BACKEND FIX in routes/api.php:
//     The controller uses implicit model binding (SellerApplication $application),
//     so the route parameter MUST be named {application}, not {id}.
//     Change:
//       Route::post('/seller-applications/{id}/approve', ...)
//       Route::post('/seller-applications/{id}/reject',  ...)
//     To:
//       Route::post('/seller-applications/{application}/approve', ...)
//       Route::post('/seller-applications/{application}/reject',  ...)
//     The frontend URLs do NOT change — only the Laravel route parameter name.

export const sellerApplicationsApi = {
  async list(params: ApplicationsParams = {}) {
    const res = await api.get('/admin/seller-applications', { params })
    return res.data.data
  },

  async get(id: number) {
    const res = await api.get(`/admin/seller-applications/${id}`)
    return res.data.data as SellerApplication
  },

  // POST /admin/seller-applications/{application}/approve
  async approve(id: number) {
    const res = await api.post(`/admin/seller-applications/${id}/approve`)
    return res.data
  },

  // POST /admin/seller-applications/{application}/reject
  async reject(id: number, rejection_reason?: string) {
    const res = await api.post(`/admin/seller-applications/${id}/reject`, {
      rejection_reason,
    })
    return res.data
  },
}

// ─── Sellers ──────────────────────────────────────────────────────────────────
//
// Matching routes in api.php (admin block, middleware: auth:sanctum):
//   GET    /admin/sellers
//   GET    /admin/sellers/{id}
//   PUT    /admin/sellers/{id}
//   DELETE /admin/sellers/{id}
//   PATCH  /admin/sellers/{id}/approve
//   PATCH  /admin/sellers/{id}/reject
//   PATCH  /admin/sellers/{id}/suspend
//   PATCH  /admin/sellers/{id}/role

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
}

// ─── Admin Products ───────────────────────────────────────────────────────────
//
// Matching routes in api.php:
//   PUT   /admin/products/{id}         → update  (middleware: auth:sanctum)
//   PATCH /admin/products/{id}/approve → approveProduct
//   PATCH /admin/products/{id}/reject  → rejectProduct
//
// ⚠️  REQUIRED BACKEND FIX:
//     approve/reject are currently under middleware('auth:admin') — a separate
//     guard that your frontend token (Bearer/sanctum) cannot satisfy.
//     Move them into the auth:sanctum admin block in routes/api.php:
//
//     Route::prefix('admin')->middleware(['auth:sanctum'])->group(function () {
//         Route::patch('products/{id}/approve', [SellerController::class, 'approveProduct']);
//         Route::patch('products/{id}/reject',  [SellerController::class, 'rejectProduct']);
//     });

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