import type { Attribute } from '@/components/types'
import type { EditorDocument, EditorPayload, ManifestItem } from '@/lib/api/productEditor'

// ── State ─────────────────────────────────────────────────────────────────────

export type ImgItem =
  | { uid: string; kind: 'existing'; id: number; url: string }
  | { uid: string; kind: 'new'; file: File; url: string; replaces?: number }

export interface VariantRow {
  /** Stable client key: the variant id for saved variants, "new_x" for added ones. */
  key: string
  id: number | null
  option_ids: number[]
  stock: string
  price_override: string
  sku: string
  is_active: boolean
  has_orders: boolean
}

export interface EditorState {
  name: string
  slug: string
  sku: string
  description: string
  short_description: string
  price: string
  stock: string
  category_id: string
  subcategory_id: string
  is_active: boolean
  is_pack: boolean
  free_delivery: boolean
  seasons: string[]
  admin_note: string
  attributes: Record<string, any>
  variants: VariantRow[]
  gallery: ImgItem[]
  /** color group key ("5|7") → images */
  colorImages: Record<string, ImgItem[]>
}

export type Errors = Record<string, string>

export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif'
const ACCEPTED_EXT = /\.(jpe?g|png|webp|gif)$/i

let seq = 0
export const uid = (prefix = 'u') => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`

export function newImageItem(file: File, replaces?: number): ImgItem {
  return { uid: uid('up'), kind: 'new', file, url: URL.createObjectURL(file), replaces }
}

export function validateImageFile(file: File, maxKb: number): string | null {
  if (!ACCEPTED_EXT.test(file.name) && !ACCEPTED_TYPES.split(',').includes(file.type)) {
    return `${file.name}: only JPG, PNG, WEBP or GIF images are allowed.`
  }
  if (file.size > maxKb * 1024) return `${file.name} is larger than ${Math.round(maxKb / 1024)} MB.`
  return null
}

export function fromPayload(p: EditorPayload): EditorState {
  const existing = (i: { id: number; url: string }): ImgItem => ({ uid: `img${i.id}`, kind: 'existing', id: i.id, url: i.url })
  const pr = p.product
  return {
    name:              pr.name ?? '',
    slug:              pr.slug ?? '',
    sku:               pr.sku ?? '',
    description:       pr.description ?? '',
    short_description: pr.short_description ?? '',
    price:             pr.price != null ? String(Number(pr.price)) : '',
    stock:             String(pr.stock ?? 0),
    category_id:       pr.category_id ? String(pr.category_id) : '',
    subcategory_id:    pr.subcategory_id ? String(pr.subcategory_id) : '',
    is_active:         pr.is_active,
    is_pack:           pr.is_pack,
    free_delivery:     pr.free_delivery,
    seasons:           pr.seasons?.length ? pr.seasons : ['all_seasons'],
    admin_note:        pr.admin_note ?? '',
    attributes:        { ...(p.attributes ?? {}) },
    variants: p.variants.map((v) => ({
      key:            String(v.id),
      id:             v.id,
      option_ids:     v.option_ids,
      stock:          String(v.stock),
      price_override: v.price_override ? String(Number(v.price_override)) : '',
      sku:            v.sku ?? '',
      is_active:      v.is_active,
      has_orders:     v.has_orders,
    })),
    gallery:     p.images.gallery.map(existing),
    colorImages: Object.fromEntries(p.images.color_groups.map((g) => [g.key, g.images.map(existing)])),
  }
}

// ── Variants / color groups ─────────────────────────────────────────────────

export const isColorAxis = (a: Attribute) => a.slug === 'color' || a.type === 'color'

export function colorIdsOf(row: VariantRow, colorAxis: Attribute | null): number[] {
  if (!colorAxis) return []
  const ids = new Set(colorAxis.options.map((o) => o.id))
  return row.option_ids.filter((id) => ids.has(id)).sort((a, b) => a - b)
}

export const groupKey = (ids: number[]) => [...ids].sort((a, b) => a - b).join('|')

/** Color groups used by the current variants, in first-appearance order. */
export function activeColorGroups(rows: VariantRow[], colorAxis: Attribute | null): string[] {
  const keys: string[] = []
  for (const r of rows) {
    const ids = colorIdsOf(r, colorAxis)
    if (!ids.length) continue
    const k = groupKey(ids)
    if (!keys.includes(k)) keys.push(k)
  }
  return keys
}

export function variantLabel(row: VariantRow, axes: Attribute[]): string {
  const parts: string[] = []
  const color = axes.find(isColorAxis)
  if (color) {
    const names = colorIdsOf(row, color).map((id) => color.options.find((o) => o.id === id)?.value ?? '?')
    if (names.length) parts.push(names.join('+'))
  }
  for (const axis of axes) {
    if (isColorAxis(axis)) continue
    const opt = axis.options.find((o) => row.option_ids.includes(o.id))
    if (opt) parts.push(opt.value)
  }
  return parts.join(' / ') || 'New variant'
}

// ── Document ───────────────────────────────────────────────────────────────

const nullIfBlank = (s: string) => (s.trim() === '' ? null : s.trim())

export function toDocument(s: EditorState, loadedUpdatedAt: string, colorAxis: Attribute | null) {
  const uploads: Record<string, File> = {}
  const manifest = (items: ImgItem[]): ManifestItem[] => items.map((it) => {
    if (it.kind === 'existing') return { id: it.id }
    uploads[it.uid] = it.file
    return it.replaces ? { upload: it.uid, replaces: it.replaces } : { upload: it.uid }
  })

  const hasVariants = s.variants.length > 0
  const usedGroups = new Set(activeColorGroups(s.variants, colorAxis))

  // Groups still used by a variant come first so the server's indexes match the UI order
  const groupEntries = Object.entries(s.colorImages)
    .filter(([, items]) => items.length > 0)
    .sort(([a], [b]) => Number(!usedGroups.has(a)) - Number(!usedGroups.has(b)))

  const doc: EditorDocument = {
    loaded_updated_at: loadedUpdatedAt,
    name:              s.name.trim(),
    slug:              nullIfBlank(s.slug),
    sku:               nullIfBlank(s.sku),
    description:       nullIfBlank(s.description),
    short_description: nullIfBlank(s.short_description),
    price:             s.price.trim(),
    stock:             hasVariants ? s.variants.reduce((n, v) => n + (parseInt(v.stock, 10) || 0), 0) : parseInt(s.stock, 10) || 0,
    category_id:       s.category_id ? Number(s.category_id) : null,
    subcategory_id:    s.subcategory_id ? Number(s.subcategory_id) : null,
    is_active:         s.is_active,
    is_pack:           s.is_pack,
    free_delivery:     s.free_delivery,
    seasons:           s.seasons,
    admin_note:        nullIfBlank(s.admin_note),
    attributes:        Object.fromEntries(Object.entries(s.attributes).filter(([, v]) => !isEmptyValue(v))),
    variants: s.variants.map((v) => ({
      id:             v.id,
      key:            v.key,
      option_ids:     v.option_ids,
      stock:          parseInt(v.stock, 10) || 0,
      price_override: nullIfBlank(v.price_override),
      sku:            nullIfBlank(v.sku),
      is_active:      v.is_active,
    })),
    images: {
      gallery:      manifest(s.gallery),
      color_groups: groupEntries.map(([key, items]) => ({ color_option_ids: key.split('|').map(Number), items: manifest(items) })),
    },
  }
  return { doc, uploads, groupOrder: groupEntries.map(([k]) => k) }
}

/** Serialized form used to detect unsaved changes (new files count by their client id). */
export function fingerprint(s: EditorState, colorAxis: Attribute | null): string {
  const { doc } = toDocument(s, '', colorAxis)
  return JSON.stringify(doc)
}

export function isEmptyValue(v: unknown) {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

// ── Validation (mirrors AdminProductEditor::validate) ───────────────────────

export function validate(
  s: EditorState,
  ctx: { variantAxes: Attribute[]; infoAxes: Attribute[]; approve: boolean; galleryMax: number; setMax: number; maxColors: number },
): Errors {
  const e: Errors = {}
  const colorAxis = ctx.variantAxes.find(isColorAxis) ?? null

  if (!s.name.trim()) e.name = 'Product name is required.'
  else if (s.name.length > 255) e.name = 'At most 255 characters.'
  if (s.short_description.length > 500) e.short_description = 'At most 500 characters.'
  if (!s.category_id) e.category_id = 'Choose a category.'

  for (const attr of ctx.infoAxes) {
    if (attr.is_required && isEmptyValue(s.attributes[attr.slug])) e[`attributes.${attr.slug}`] = `${attr.name} is required.`
  }

  if (s.price.trim() === '' || isNaN(Number(s.price))) e.price = 'Enter a price.'
  else if (Number(s.price) <= 0) e.price = 'Price must be greater than 0.'
  if (s.variants.length === 0 && (!/^\d+$/.test(s.stock.trim()))) e.stock = 'Stock must be a whole number ≥ 0.'
  if (s.seasons.length === 0) e.seasons = 'Select at least one season.'
  if (s.sku.length > 100) e.sku = 'At most 100 characters.'

  if (s.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug.trim())) e.slug = 'Use lowercase letters, numbers and single hyphens only.'
  if (s.admin_note.length > 5000) e.admin_note = 'At most 5000 characters.'

  // Variants
  const seen = new Map<string, number>()
  s.variants.forEach((v, i) => {
    const missing: string[] = []
    for (const axis of ctx.variantAxes) {
      const picked = axis.options.filter((o) => v.option_ids.includes(o.id)).length
      if (picked === 0) missing.push(axis.name)
      else if (isColorAxis(axis) && picked > ctx.maxColors) e[`variants.${i}.option_ids`] = `At most ${ctx.maxColors} colors per variant.`
    }
    if (missing.length) e[`variants.${i}.option_ids`] = `Choose ${missing.join(' and ')}.`
    const combo = [...v.option_ids].sort((a, b) => a - b).join('-')
    if (combo && seen.has(combo)) e[`variants.${i}.option_ids`] = `Same options as variant #${(seen.get(combo) ?? 0) + 1}.`
    else seen.set(combo, i)
    if (!/^\d+$/.test(v.stock.trim())) e[`variants.${i}.stock`] = 'Whole number ≥ 0.'
    if (v.price_override.trim() !== '' && !(Number(v.price_override) > 0)) e[`variants.${i}.price_override`] = 'Must be greater than 0.'
    if (v.sku.length > 100) e[`variants.${i}.sku`] = 'At most 100 characters.'
  })

  // Images
  if (s.gallery.length > ctx.galleryMax) e['images.gallery'] = `At most ${ctx.galleryMax} gallery images.`
  const used = new Set(activeColorGroups(s.variants, colorAxis))
  for (const [key, items] of Object.entries(s.colorImages)) {
    if (!items.length) continue
    if (!used.has(key)) e[`images.color.${key}`] = 'No variant uses this color group anymore — move or remove these images.'
    else if (items.length > ctx.setMax) e[`images.color.${key}`] = `At most ${ctx.setMax} images per color group.`
  }
  if (ctx.approve) {
    const any = s.gallery.length > 0
      || Object.values(s.colorImages).some((l) => l.length > 0)
    if (!any) e['images.gallery'] = 'Add at least one image before approving.'
  }
  return e
}

// ── Tabs ───────────────────────────────────────────────────────────────────

export type TabId = 'general' | 'pricing' | 'images' | 'variants' | 'seo' | 'history'

export function tabOf(errorKey: string): TabId {
  if (errorKey.startsWith('variants')) return 'variants'
  if (errorKey.startsWith('images.color')) return 'variants'
  if (errorKey.startsWith('images')) return 'images'
  if (['price', 'stock', 'seasons', 'sku', 'is_active', 'is_pack', 'free_delivery'].includes(errorKey)) return 'pricing'
  if (['slug', 'admin_note'].includes(errorKey)) return 'seo'
  return 'general'
}

/** Maps server keys that use array indexes onto the client keys the UI renders. */
export function mapServerErrors(raw: Record<string, string[]>, groupOrder: string[]): Errors {
  const out: Errors = {}
  for (const [k, msgs] of Object.entries(raw)) {
    const msg = msgs[0]
    let m = k.match(/^images\.color_groups\.(\d+)/)
    if (m) { out[`images.color.${groupOrder[Number(m[1])] ?? ''}`] ??= msg; continue }
    m = k.match(/^images\.gallery/)
    if (m) { out['images.gallery'] ??= msg; continue }
    m = k.match(/^variants\.(\d+)\.(\w+)/)
    if (m) { out[`variants.${m[1]}.${m[2] === 'option_ids' ? 'option_ids' : m[2]}`] ??= msg; continue }
    out[k.replace(/\.\d+$/, '')] ??= msg
  }
  return out
}
