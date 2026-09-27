import api from '../axios'
import type { ModerationStatus } from '@/types/productReview'

// ── Payload from GET /admin/products/{id}/editor ─────────────────────────────

export interface EditorImage { id: number; url: string; path: string }

export interface EditorColorGroup {
  key: string
  color_option_ids: number[]
  images: EditorImage[]
}

export interface EditorVariant {
  id: number
  option_ids: number[]
  label: string
  stock: number
  price_override: string
  sku: string
  is_active: boolean
  has_orders: boolean
}

export interface EditLogEntry {
  id: number
  admin: { id: number; name: string } | null
  summary: string | null
  changes: Record<string, any> | null
  created_at: string
}

export interface ModerationEntry {
  id: number
  action: string
  admin: { id: number; name: string } | null
  reasons: string[]
  note: string | null
  created_at: string
}

export interface EditorPayload {
  product: {
    id: number
    name: string
    slug: string
    sku: string | null
    description: string | null
    short_description: string | null
    price: string
    stock: number
    category_id: number | null
    subcategory_id: number | null
    is_active: boolean
    is_approved: boolean
    is_pack: boolean
    featured: boolean
    seasons: string[]
    free_delivery: boolean
    admin_note: string | null
    admin_edited_at: string | null
    admin_edited_by: { id: number; name: string } | null
    status: ModerationStatus
    rejection_reason: string | null
    seller: { id: number; name: string; email: string } | null
    category: { id: number; name: string; slug: string } | null
    subcategory: { id: number; name: string; slug: string } | null
    created_at: string
    updated_at: string
    storefront_url: string
  }
  attributes: Record<string, any>
  variants: EditorVariant[]
  images: {
    gallery: EditorImage[]
    color_groups: EditorColorGroup[]
    cover_id: number | null
  }
  history: EditLogEntry[]
  moderation: ModerationEntry[]
  limits: { gallery_max: number; set_max: number; max_colors_per_group: number; max_file_kb: number }
  seasons: Record<string, string>
}

// ── Save document (POST /admin/products/{id}/editor) ─────────────────────────

export type ManifestItem = { id: number } | { upload: string; replaces?: number }

export interface EditorDocument {
  loaded_updated_at: string
  force?: boolean
  approve?: boolean
  name: string
  slug: string | null
  sku: string | null
  description: string | null
  short_description: string | null
  price: string
  stock: number
  category_id: number | null
  subcategory_id: number | null
  is_active: boolean
  is_pack: boolean
  free_delivery: boolean
  seasons: string[]
  admin_note: string | null
  attributes: Record<string, any>
  variants: {
    id: number | null
    key: string
    option_ids: number[]
    stock: number
    price_override: string | null
    sku: string | null
    is_active: boolean
  }[]
  images: {
    gallery: ManifestItem[]
    color_groups: { color_option_ids: number[]; items: ManifestItem[] }[]
  }
}

export const productEditorApi = {
  async load(id: number): Promise<EditorPayload> {
    const res = await api.get(`/admin/products/${id}/editor`)
    return res.data.data
  },

  /** Saves the whole document; `uploads` are the files the manifest references by key. */
  async save(
    id: number,
    doc: EditorDocument,
    uploads: Record<string, File>,
    onProgress?: (percent: number) => void,
  ): Promise<{ message: string; data: EditorPayload }> {
    const form = new FormData()
    form.append('data', JSON.stringify(doc))
    Object.entries(uploads).forEach(([key, file]) => form.append(`uploads[${key}]`, file, file.name))

    const res = await api.post(`/admin/products/${id}/editor`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0, // large uploads outlive the default 15s
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
    return { message: res.data.message, data: res.data.data }
  },
}
