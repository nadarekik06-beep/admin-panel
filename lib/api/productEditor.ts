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

/** Listing problem shown in the quality warnings box (ProductListingRules::warnings). */
export interface QualityWarning {
  code: string
  /** For the admin */
  message: string
  /** Seller-facing text (seller's language), prefilled into "Request changes" */
  seller_note: string
  /** ProductModerationLog reason code */
  reason: string
}

/** Seller picker row of the "Add product" page. */
export interface SellerOption {
  id: number
  name: string
  email: string
  phone: string | null
  shop_name: string | null
  plan: { slug: string; name: string }
  product_count: number
  /** null = unlimited */
  product_limit: number | null
}

export interface EditorPayload {
  product: {
    /** null on the blank "Add product" document */
    id: number | null
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
    pack_quantity: number | null
    pack_contents: string | null
    featured: boolean
    occasions: string[]
    free_delivery: boolean
    parcel_size?: 'S' | 'L' | 'XL'
    admin_note: string | null
    admin_edited_at: string | null
    admin_edited_by: { id: number; name: string } | null
    status: ModerationStatus | 'new'
    rejection_reason: string | null
    seller: { id: number; name: string; email: string; shop_name?: string | null } | null
    category: { id: number; name: string; slug: string } | null
    subcategory: { id: number; name: string; slug: string } | null
    created_at: string
    updated_at: string
    storefront_url: string
    /** Seller's description of the Multicolore color ("Noir / Blanc"), read-only */
    multicolor_label?: string | null
    /** Admin who created the product on behalf of the seller */
    created_by_admin?: { id: number; name: string } | null
  }
  quality_warnings: QualityWarning[]
  attributes: Record<string, any>
  variants: EditorVariant[]
  images: {
    gallery: EditorImage[]
    color_groups: EditorColorGroup[]
    cover_id?: number | null
  }
  history: EditLogEntry[]
  moderation: ModerationEntry[]
  limits: { gallery_max: number; set_max: number; max_colors_per_group: number; max_file_kb: number }
  /** Season / Occasion values (value → label) and the category slugs that use them */
  occasions: { values: Record<string, string>; category_slugs: string[] }
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
  pack_quantity: number | null
  pack_contents: string | null
  free_delivery: boolean
  parcel_size: 'S' | 'L' | 'XL'
  occasions: string[]
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

function toForm(doc: EditorDocument, uploads: Record<string, File>) {
  const form = new FormData()
  form.append('data', JSON.stringify(doc))
  Object.entries(uploads).forEach(([key, file]) => form.append(`uploads[${key}]`, file, file.name))
  return form
}

const uploadConfig = (onProgress?: (percent: number) => void) => ({
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 0, // large uploads outlive the default 15s
  onUploadProgress: (e: { loaded: number; total?: number }) => {
    if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
  },
})

export interface SplitGroup { name: string; stock: number; price?: number | null; image_ids: number[] }

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
    const res = await api.post(`/admin/products/${id}/editor`, toForm(doc, uploads), uploadConfig(onProgress))
    return { message: res.data.message, data: res.data.data }
  },

  // ── Add product on behalf of a seller ──────────────────────────────────────

  async sellerOptions(search: string): Promise<SellerOption[]> {
    const res = await api.get('/admin/products/seller-options', { params: { search } })
    return res.data.data
  },

  async blank(sellerId: number): Promise<EditorPayload> {
    const res = await api.get('/admin/products/blank-editor', { params: { seller_id: sellerId } })
    return res.data.data
  },

  /** Creates the product in the seller's shop: published (approved) or saved as a draft. */
  async create(
    sellerId: number,
    doc: EditorDocument,
    uploads: Record<string, File>,
    publish: boolean,
    onProgress?: (percent: number) => void,
  ): Promise<{ message: string; id: number; data: EditorPayload }> {
    const form = toForm(doc, uploads)
    form.append('seller_id', String(sellerId))
    form.append('publish', publish ? '1' : '0')
    const res = await api.post('/admin/products', form, uploadConfig(onProgress))
    return { message: res.data.message, id: res.data.data.id, data: res.data.data.editor }
  },

  /** "Split into separate products": one new product per group of gallery photos. */
  async split(id: number, groups: SplitGroup[], moveImages: boolean, publish: boolean): Promise<{ message: string; data: { id: number; name: string }[] }> {
    const res = await api.post(`/admin/products/${id}/split`, { groups, move_images: moveImages, publish })
    return { message: res.data.message, data: res.data.data }
  },
}
