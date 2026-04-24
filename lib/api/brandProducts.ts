/**
 * lib/api/brandProducts.ts
 *
 * Admin-side API for CHOOSE'Tounsi brand products.
 * Uses the admin panel's axios instance (with admin token via authStorage).
 *
 * buildFormData mirrors sellerApi.ts exactly, adding:
 *   - featured field
 *   - variant_images (keyed by variant DB id, for edit mode)
 *   - color_images   (keyed by groupKey with | replaced by _ for PHP multipart)
 */

import api from '../axios'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandProduct {
  id: number
  name: string
  slug?: string | null
  sku?: string | null
  description?: string | null
  short_description?: string | null
  price: number | string
  stock: number
  category?: { id: number; name: string; slug: string } | null
  subcategory?: { id: number; name: string; slug: string } | null
  category_id?: number | null
  subcategory_id?: number | null
  is_active: boolean
  featured: boolean
  views?: number
  primary_image_url?: string | null
  images?: Array<{
    id: number
    url?: string | null
    image_path: string
    is_primary: boolean
    order: number
    variant_id?: number | null
    color_option_id?: number | null
  }>
  // Populated by show() endpoint (mirrors seller show)
  variant_rows?: Array<{
    id: number
    option_ids: number[]
    stock: number
    price_override: string
    sku: string
    is_active: boolean
    label: string
    option_map?: Record<string, any>
    image_urls?: string[]
  }>
  existing_attributes?: Record<string, any>
  [key: string]: any
}

export interface VariantPayload {
  id?: number
  option_ids: number[]
  stock: number
  price_override?: number | string | null
  sku?: string
  is_active?: boolean
}

export interface BrandProductPayload {
  name: string
  slug?: string
  sku?: string
  description?: string
  short_description?: string
  price: number | string
  stock: number | string
  category_id: number | string
  subcategory_id?: number | string | null
  is_active?: boolean
  featured?: boolean
  images?: File[]
  delete_image_ids?: number[]
  attributes?: Record<string, string>
  variants?: VariantPayload[]
  /** color_images[groupKey][j] — groupKey is sorted color option IDs joined by "|" */
  color_images?: Record<string, File[]>
  /** variant_images[variantId][j] — new images for existing variants in edit mode */
  variant_images?: Record<number, File[]>
  [key: string]: any
}

// ─── FormData builder ─────────────────────────────────────────────────────────
// Mirrors sellerApi.ts buildFormData exactly.
// Extra fields: featured, variant_images.

export function buildFormData(payload: BrandProductPayload, isUpdate = false): FormData {
  const fd = new FormData()

  if (isUpdate) fd.append('_method', 'PUT')

  // Scalar fields
  const scalars = [
    'name', 'slug', 'sku', 'description', 'short_description',
    'price', 'stock', 'category_id', 'subcategory_id',
  ]
  scalars.forEach(key => {
    const val = (payload as any)[key]
    if (val !== undefined && val !== null && val !== '') {
      fd.append(key, String(val))
    }
  })

  fd.append('is_active', payload.is_active === false ? '0' : '1')
  fd.append('featured',  payload.featured  === true  ? '1' : '0')

  // Product-level images
  if (payload.images?.length) {
    payload.images.forEach((file, i) => fd.append(`images[${i}]`, file))
  }

  // Image deletions (product-level + variant-level merged in modal)
  if (payload.delete_image_ids?.length) {
    payload.delete_image_ids.forEach((id, i) => fd.append(`delete_image_ids[${i}]`, String(id)))
  }

  // Informational attributes
  if (payload.attributes) {
    Object.entries(payload.attributes).forEach(([slug, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        fd.append(`attributes[${slug}]`, String(val))
      }
    })
  }

  // Variants (same encoding as seller)
  if (payload.variants?.length) {
    payload.variants.forEach((variant, i) => {
      if (variant.id != null) fd.append(`variants[${i}][id]`, String(variant.id))
      variant.option_ids.forEach((optId, j) =>
        fd.append(`variants[${i}][option_ids][${j}]`, String(optId))
      )
      fd.append(`variants[${i}][stock]`,     String(variant.stock ?? 0))
      fd.append(`variants[${i}][is_active]`, variant.is_active === false ? '0' : '1')
      if (variant.price_override != null && variant.price_override !== '') {
        fd.append(`variants[${i}][price_override]`, String(variant.price_override))
      }
      if (variant.sku) fd.append(`variants[${i}][sku]`, variant.sku)
    })
  }

  // Color-group images: groupKey uses | separator which PHP multipart drops silently.
  // Replace | with _ so PHP sees e.g. color_images[101_102][0].
  // Backend saveColorImages() uses explode('_', $groupKey) to parse back.
  if (payload.color_images) {
    Object.entries(payload.color_images).forEach(([groupKey, files]) => {
      if (!Array.isArray(files)) return
      const safeKey = groupKey.replace(/\|/g, '_')
      files.forEach((file, j) => fd.append(`color_images[${safeKey}][${j}]`, file))
    })
  }

  // Variant-level images (edit mode only): variant_images[variantId][j]
  // Backend saveVariantImages() reads this key to attach images to specific variants.
  if (payload.variant_images) {
    Object.entries(payload.variant_images).forEach(([variantId, files]) => {
      if (!Array.isArray(files)) return
      files.forEach((file, j) =>
        fd.append(`variant_images[${variantId}][${j}]`, file)
      )
    })
  }

  return fd
}

// ─── Params helper ────────────────────────────────────────────────────────────

function buildQs(params: Record<string, any>): string {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString()
  return qs ? `?${qs}` : ''
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const brandProductsApi = {
  // ── Stats ────────────────────────────────────────────────────────────────
  async stats() {
    const res = await api.get('/admin/brand-products/stats')
    return res.data
  },

  // ── List ─────────────────────────────────────────────────────────────────
  async list(params: Record<string, any> = {}) {
    const res = await api.get(`/admin/brand-products${buildQs(params)}`)
    return res.data
  },

  // ── Get single (full data: variant_rows, images, attributes) ─────────────
  async get(id: number) {
    const res = await api.get(`/admin/brand-products/${id}`)
    return res.data
  },

  // ── Create ───────────────────────────────────────────────────────────────
  async create(payload: BrandProductPayload) {
    const fd = buildFormData(payload, false)
    const res = await api.post('/admin/brand-products', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  // ── Update ───────────────────────────────────────────────────────────────
  async update(id: number, payload: BrandProductPayload) {
    const fd = buildFormData(payload, true)
    const res = await api.post(`/admin/brand-products/${id}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  // ── Delete ───────────────────────────────────────────────────────────────
  async delete(id: number) {
    const res = await api.delete(`/admin/brand-products/${id}`)
    return res.data
  },

  // ── Delete single image ───────────────────────────────────────────────────
  async deleteImage(productId: number, imageId: number) {
    const res = await api.delete(`/admin/brand-products/${productId}/images/${imageId}`)
    return res.data
  },

  // ── Set primary image ─────────────────────────────────────────────────────
  async setPrimaryImage(productId: number, imageId: number) {
    const res = await api.patch(`/admin/brand-products/${productId}/images/${imageId}/primary`)
    return res.data
  },
}