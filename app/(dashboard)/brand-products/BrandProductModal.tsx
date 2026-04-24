'use client'

/**
 * BrandProductModal.tsx — Admin Brand Products
 *
 * Create / Edit modal for CHOOSE'Tounsi brand products.
 * Uses the EXACT SAME seller components:
 *   - VariantBuilder  (color groups, multi-select, Step 1 + Step 2)
 *   - ColorGroupImageUploader  (one zone per color group)
 *   - VariantImageManager  (edit mode: existing images + upload)
 *   - DynamicAttributeSection  (informational attributes)
 *
 * KEY DIFFERENCES from seller modal:
 *   - No is_approved lock / "Request Update" button
 *   - "featured" checkbox
 *   - Dark admin theme throughout
 *   - Uses brandProductsApi (admin token) not sellerApi
 *   - Category/subcategory/attribute fetched via direct fetch (public endpoints)
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { X, Upload, Trash2, Star, Loader2, AlertCircle } from 'lucide-react'
import { brandProductsApi, buildFormData, type BrandProduct } from '@/lib/api/brandProducts'
import VariantBuilder, {
  type VariantRow, normalizeVariantRow, calculateTotalStock, validateVariantStocks,
} from '@/components/VariantBuilder'
import ColorGroupImageUploader from '@/components/ColorGroupImageUploader'
import VariantImageManager, { type VariantForImageManager } from '@/components/VariantImageManager'
import DynamicAttributeSection from '@/components/attributes/DynamicAttributeSection'
import type { Attribute, AttributeValues } from '@/components/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category    { id: number; name: string; slug: string }
interface Subcategory { id: number; name: string; slug: string; category_id: number }

interface ExistingImage {
  id: number; url: string; image_path: string; is_primary: boolean; order: number
  variant_id?: number | null; color_option_id?: number | null
}
interface PreviewImage { file: File; preview: string; id: string }

interface Props {
  product: BrandProduct | null
  onClose: () => void
  onSaved: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/api\/?$/, '')

function resolveUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${BASE}/storage/${path.replace(/^\/storage\//, '').replace(/^\//, '')}`
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const border   = 'rgba(255,255,255,0.08)'
const inputBg  = '#0d1117'
const cardBg   = '#111318'
const textMain = '#ffffff'
const textMuted= 'rgba(255,255,255,0.4)'

const iStyle = (err?: boolean): React.CSSProperties => ({
  width: '100%', border: `1px solid ${err ? '#ef4444' : border}`,
  borderRadius: 10, padding: '9px 13px', fontSize: 13,
  background: err ? 'rgba(239,68,68,0.08)' : inputBg,
  color: textMain, outline: 'none', fontFamily: 'inherit',
})

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted, marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
      {hint  && !error && <p style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>{hint}</p>}
      {error &&           <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{error}</p>}
    </div>
  )
}

function SectionLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, paddingBottom: 8, borderBottom: `1px solid ${border}`, marginBottom: 16, margin: 0, paddingTop: 0 }}>
      {children}
      {sub && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 500, color: '#a78bfa', textTransform: 'none', letterSpacing: 0 }}>{sub}</span>}
    </p>
  )
}

function ImageThumb({ src, isPrimary, onRemove, onSetPrimary, saving }: {
  src: string; isPrimary: boolean; onRemove: () => void; onSetPrimary: () => void; saving: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: `2px solid ${isPrimary ? '#db142e' : border}`, background: '#0d1117' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {isPrimary && (
        <div style={{ position: 'absolute', top: 4, left: 4, background: '#db142e', color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 999 }}>Primary</div>
      )}
      {hover && !saving && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {!isPrimary && (
            <button type="button" onClick={onSetPrimary} style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#f59e0b' }}>
              <Star size={13} />
            </button>
          )}
          <button type="button" onClick={onRemove} style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function BrandProductModal({ product, onClose, onSaved }: Props) {
  const isEdit = !!product
  const p      = product

  // Form
  const [form, setForm] = useState({
    name:              p?.name              ?? '',
    slug:              p?.slug              ?? '',
    sku:               p?.sku               ?? '',
    description:       p?.description       ?? '',
    short_description: p?.short_description ?? '',
    price:             p?.price?.toString() ?? '',
    stock:             p?.stock?.toString() ?? '0',
    category_id:       p?.category?.id?.toString() ?? '',
    subcategory_id:    (p as any)?.subcategory?.id != null ? String((p as any).subcategory.id) : '',
    is_active:         p?.is_active ?? true,
    featured:          p?.featured  ?? false,
  })
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [saving,   setSaving]   = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Variants
  const [variantRows,       setVariantRows]       = useState<VariantRow[]>(
    ((p as any)?.variant_rows ?? []).map(normalizeVariantRow)
  )
  const [colorGroupImages,  setColorGroupImages]  = useState<Record<string, File[]>>({})
  const [variantStockErrors,setVariantStockErrors]= useState<Record<number, string>>({})
  const [variantImageChanges, setVariantImageChanges] = useState<{
    newImagesByVariantId: Record<number, File[]>; deleteImageIds: number[]
  }>({ newImagesByVariantId: {}, deleteImageIds: [] })

  const hasVariantRows    = variantRows.length > 0
  const variantTotalStock = useMemo(() => calculateTotalStock(variantRows), [variantRows])

  useEffect(() => {
    if (hasVariantRows) setForm(f => ({ ...f, stock: String(variantTotalStock) }))
  }, [variantTotalStock, hasVariantRows])

  // Build VariantForImageManager for edit mode
  const variantsForImageManager = useMemo((): VariantForImageManager[] => {
    if (!isEdit) return []
    const serverVariants = ((p as any)?.variant_rows ?? []) as any[]
    if (serverVariants.length === 0) return []
    const imagesByVariantId: Record<number, Array<{ id: number; url: string; is_primary?: boolean }>> = {}
    if ((p as any)?.images) {
      for (const img of (p as any).images) {
        if (img.variant_id != null) {
          const url = resolveUrl(img.url ?? img.image_path)
          if (!url) continue
          if (!imagesByVariantId[img.variant_id]) imagesByVariantId[img.variant_id] = []
          imagesByVariantId[img.variant_id].push({ id: img.id, url, is_primary: img.is_primary })
        }
      }
    }
    return serverVariants.filter((v: any) => v.id != null).map((v: any) => ({
      id:              v.id,
      label:           v.label ?? '',
      option_map:      v.option_map,
      image_urls:      v.image_urls ?? [],
      existing_images: imagesByVariantId[v.id] ?? [],
    }))
  }, [isEdit, p])

  const showVariantImageManager = isEdit && variantsForImageManager.length > 0

  // Categories / subcategories / attributes
  const [categories,    setCategories]    = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [variantAxes,   setVariantAxes]   = useState<Attribute[]>([])
  const [infoAxes,      setInfoAxes]      = useState<Attribute[]>([])
  const [attrValues,    setAttrValues]    = useState<AttributeValues>((p as any)?.existing_attributes ?? {})
  const [catLoading,    setCatLoading]    = useState(true)
  const [subLoading,    setSubLoading]    = useState(false)
  const [attrLoading,   setAttrLoading]   = useState(false)

  useEffect(() => {
    fetch(`${BASE}/api/categories`, { headers: { Accept: 'application/json' } })
      .then(r => r.json()).then(j => setCategories(j.data ?? []))
      .catch(() => {}).finally(() => setCatLoading(false))
  }, [])

  useEffect(() => {
    if (!form.category_id) { setSubcategories([]); return }
    const cat = categories.find(c => c.id === Number(form.category_id))
    if (!cat?.slug) return
    setSubLoading(true)
    fetch(`${BASE}/api/categories/${cat.slug}/subcategories`, { headers: { Accept: 'application/json' } })
      .then(r => r.json()).then(j => setSubcategories(j.data ?? []))
      .catch(() => setSubcategories([])).finally(() => setSubLoading(false))
  }, [form.category_id, categories])

  useEffect(() => {
    if (!form.subcategory_id) { setVariantAxes([]); setInfoAxes([]); return }
    const subId = Number(form.subcategory_id)
    if (!subId) return
    setAttrLoading(true)
    fetch(`${BASE}/api/subcategories/${subId}/attributes`, { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(j => {
        const d = j.data ?? {}
        setVariantAxes((d.variant_attributes ?? []).filter((a: Attribute) => a.options?.length > 0))
        setInfoAxes(d.info_attributes ?? [])
      })
      .catch(() => { setVariantAxes([]); setInfoAxes([]) })
      .finally(() => setAttrLoading(false))
  }, [form.subcategory_id])

  // Auto-slug
  const slugTouched = useRef(!!(p?.slug))
  useEffect(() => {
    if (!slugTouched.current && form.name) {
      set('slug', form.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'))
    }
  }, [form.name])

  // Existing color group images (for edit mode)
  const existingByColorGroup = useMemo(() => {
    const map: Record<string, string[]> = {}
    if ((p as any)?.images) {
      for (const img of (p as any).images as any[]) {
        if (img.color_option_id != null) {
          const url = resolveUrl(img.url ?? img.image_path)
          if (url) {
            const key = String(img.color_option_id)
            map[key] = [...(map[key] ?? []), url]
          }
        }
      }
    }
    return map
  }, [p])

  // Product-level images (not attached to variants)
  const [existingImages,  setExistingImages]  = useState<ExistingImage[]>(() => {
    if (!(p as any)?.images) return []
    return ((p as any).images as any[])
      .filter((img: any) => img.variant_id == null && img.color_option_id == null)
      .map((img: any) => ({ ...img, url: resolveUrl(img.url ?? img.image_path) ?? img.image_path }))
  })
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([])
  const [primaryImageId,  setPrimaryImageId]  = useState<number | null>(
    (p as any)?.images?.find((i: any) => i.is_primary)?.id ?? null
  )
  const [previews,  setPreviews]  = useState<PreviewImage[]>([])
  const fileRef                   = useRef<HTMLInputElement>(null)

  useEffect(() => () => previews.forEach(prev => URL.revokeObjectURL(prev.preview)), [])

  const totalImages = existingImages.length + previews.length
  const addFiles = (files: File[]) => {
    const toAdd = files.filter(f => f.type.startsWith('image/')).slice(0, 8 - totalImages)
      .map(file => ({ file, preview: URL.createObjectURL(file), id: Math.random().toString(36).slice(2) }))
    setPreviews(prev => [...prev, ...toAdd])
  }
  const removeExisting = (id: number) => {
    setExistingImages(prev => prev.filter(img => img.id !== id))
    setDeletedImageIds(prev => [...prev, id])
    if (primaryImageId === id) setPrimaryImageId(existingImages.find(img => img.id !== id)?.id ?? null)
  }
  const removePreview = (cid: string) => {
    setPreviews(prev => { const f = prev.find(p => p.id === cid); if (f) URL.revokeObjectURL(f.preview); return prev.filter(p => p.id !== cid) })
  }
  const setExistingPrimary = (id: number) => {
    setPrimaryImageId(id)
    setExistingImages(prev => prev.map(img => ({ ...img, is_primary: img.id === id })))
  }

  // Validate
  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required.'
    if (!form.category_id) e.category_id = 'Select a category.'
    if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0) e.price = 'Enter a valid price.'
    if (!hasVariantRows) {
      if (form.stock === '' || isNaN(Number(form.stock)) || Number(form.stock) < 0) e.stock = 'Enter a valid stock.'
    } else {
      const varStockErrs = validateVariantStocks(variantRows)
      if (Object.keys(varStockErrs).length > 0) {
        setVariantStockErrors(varStockErrs)
        e.variants = 'Fix variant stock errors.'
      } else {
        setVariantStockErrors({})
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true); setApiError('')
    try {
      // Serialize attributes
      const serializedAttrs: Record<string, string> = {}
      for (const [slug, val] of Object.entries(attrValues)) {
        if (val === null || val === undefined || val === '') continue
        if (Array.isArray(val)) { if (val.length > 0) serializedAttrs[slug] = JSON.stringify(val) }
        else if (typeof val === 'boolean') serializedAttrs[slug] = val ? '1' : '0'
        else serializedAttrs[slug] = String(val)
      }

      const validVariants = hasVariantRows
        ? variantRows.filter(r => r.option_ids.filter(id => id > 0).length > 0).map(r => ({
            ...(r.id ? { id: r.id } : {}),
            option_ids:     r.option_ids.filter(id => id > 0),
            stock:          r.stock,
            price_override: r.price_override !== '' ? r.price_override : null,
            sku:            r.sku || undefined,
            is_active:      r.is_active,
          }))
        : undefined

      const allDeletedIds = [...deletedImageIds, ...variantImageChanges.deleteImageIds]

      const payload = {
        name:              form.name.trim(),
        slug:              form.slug.trim()             || undefined,
        sku:               form.sku.trim()              || undefined,
        description:       form.description.trim()      || undefined,
        short_description: form.short_description.trim()|| undefined,
        price:             parseFloat(form.price),
        stock:             hasVariantRows ? variantTotalStock : parseInt(form.stock, 10),
        category_id:       parseInt(form.category_id, 10),
        subcategory_id:    form.subcategory_id ? parseInt(form.subcategory_id, 10) : null,
        is_active:         form.is_active,
        featured:          form.featured,
        images:            previews.map(p => p.file),
        delete_image_ids:  allDeletedIds.length ? allDeletedIds : undefined,
        variants:          validVariants,
        attributes:        Object.keys(serializedAttrs).length ? serializedAttrs : undefined,
        color_images:      Object.keys(colorGroupImages).length ? colorGroupImages : undefined,
        variant_images:    Object.keys(variantImageChanges.newImagesByVariantId).length
                             ? variantImageChanges.newImagesByVariantId : undefined,
      }

      if (isEdit) {
        await brandProductsApi.update(p!.id, payload as any)
        if (primaryImageId !== null) {
          const origPrimary = (p as any)?.images?.find((i: any) => i.is_primary)
          if (!origPrimary || origPrimary.id !== primaryImageId) {
            await brandProductsApi.setPrimaryImage(p!.id, primaryImageId)
          }
        }
      } else {
        await brandProductsApi.create(payload as any)
      }

      onSaved(); onClose()
    } catch (err: any) {
      const data = err?.response?.data
      if (data?.errors) {
        const mapped: Record<string, string> = {}
        Object.entries(data.errors).forEach(([k, msgs]) => { mapped[k] = (msgs as string[])[0] })
        setErrors(mapped)
      } else {
        setApiError(data?.message ?? 'Failed to save. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', width: '100%', maxWidth: 820, maxHeight: '94vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, background: cardBg, zIndex: 10, borderRadius: '20px 20px 0 0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: textMain, margin: 0 }}>
                {isEdit ? 'Edit Brand Product' : 'Add Brand Product'}
              </h2>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#db142e', background: 'rgba(219,20,46,0.12)', border: '1px solid rgba(219,20,46,0.25)', padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Platform
              </span>
            </div>
            <p style={{ fontSize: 11, color: textMuted, margin: '3px 0 0' }}>
              Published immediately — no approval needed
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ padding: 6, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: textMuted }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {apiError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#ef4444' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {apiError}
            </div>
          )}

          {/* ── Basic Information ── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionLabel>Basic Information</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Product Name" required error={errors.name}>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Classic Tounsi Tote" style={iStyle(!!errors.name)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="URL Slug" hint="Auto-generated from name">
                  <input value={form.slug} onChange={e => { slugTouched.current = true; set('slug', e.target.value) }} placeholder="classic-tounsi-tote" style={iStyle()} />
                </Field>
                <Field label="SKU" hint="Optional">
                  <input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Leave blank" style={iStyle()} />
                </Field>
              </div>
              <Field label="Short Description" hint="Max 500 chars">
                <input value={form.short_description} onChange={e => set('short_description', e.target.value)} maxLength={500} placeholder="One-line summary…" style={iStyle()} />
              </Field>
              <Field label="Full Description">
                <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the product…" style={{ ...iStyle(), resize: 'none' } as any} />
              </Field>
            </div>
          </section>

          {/* ── Pricing & Inventory ── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionLabel>Pricing & Inventory</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: hasVariantRows ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Price (TND)" required error={errors.price}>
                <div style={{ position: 'relative' }}>
                  <input type="number" min={0} step="0.001" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.000" style={{ ...iStyle(!!errors.price), paddingRight: 44 }} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: textMuted, fontWeight: 600 }}>TND</span>
                </div>
              </Field>
              {!hasVariantRows && (
                <Field label="Stock" required error={errors.stock}>
                  <input type="number" min={0} value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" style={iStyle(!!errors.stock)} />
                </Field>
              )}
              <Field label="Status">
                <select value={form.is_active ? 'active' : 'inactive'} onChange={e => set('is_active', e.target.value === 'active')} style={iStyle()}>
                  <option value="active">Active (live on /brand)</option>
                  <option value="inactive">Inactive (hidden)</option>
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="featured_cb" checked={form.featured} onChange={e => set('featured', e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#db142e' }} />
              <label htmlFor="featured_cb" style={{ fontSize: 13, color: textMain, cursor: 'pointer' }}>
                Mark as Featured <span style={{ fontSize: 11, color: textMuted, marginLeft: 4 }}>(highlighted on brand page)</span>
              </label>
            </div>
          </section>

          {/* ── Category ── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionLabel>Category</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Category" required error={errors.category_id}>
                <select value={form.category_id} onChange={e => { set('category_id', e.target.value); set('subcategory_id', ''); setVariantAxes([]); setInfoAxes([]); setAttrValues({}); setVariantRows([]) }} disabled={catLoading} style={iStyle(!!errors.category_id)}>
                  <option value="">{catLoading ? 'Loading…' : '— Select category —'}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Subcategory" hint="Select to unlock attributes & variants">
                <select value={form.subcategory_id} onChange={e => { set('subcategory_id', e.target.value); setAttrValues({}); setVariantRows([]) }} disabled={!form.category_id || subLoading} style={iStyle()}>
                  <option value="">{subLoading ? 'Loading…' : !form.category_id ? '— Select category first —' : '— None (optional) —'}</option>
                  {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
          </section>

          {/* ── Informational Attributes ── */}
          {form.subcategory_id && !attrLoading && infoAxes.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionLabel sub="informational only">Product Details</SectionLabel>
              <DynamicAttributeSection
                subcategoryId={Number(form.subcategory_id)}
                values={attrValues}
                onChange={setAttrValues}
                disabled={saving}
                overrideAttributes={infoAxes}
              />
            </section>
          )}

          {/* ── Variants ── */}
          {form.subcategory_id && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: `1px solid ${border}` }}>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, margin: 0 }}>Variants</p>
                {attrLoading && <Loader2 size={10} style={{ animation: 'spin 0.8s linear infinite', color: textMuted }} />}
                {!attrLoading && variantAxes.length > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '1px 7px', borderRadius: 4 }}>
                    axes: {variantAxes.map(a => a.name).join(', ')}
                  </span>
                )}
              </div>

              {!attrLoading && variantAxes.length === 0 && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px', fontSize: 12, color: textMuted }}>
                  This subcategory has no variant attributes configured.
                </div>
              )}

              {!attrLoading && variantAxes.length > 0 && (
                <>
                  <VariantBuilder
                    axes={variantAxes}
                    existingVariants={variantRows}
                    onChange={rows => { setVariantRows(rows); setVariantStockErrors({}) }}
                    basePrice={form.price}
                    disabled={saving}
                    externalStockErrors={variantStockErrors}
                  />

                  {variantRows.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <ColorGroupImageUploader
                        variantRows={variantRows}
                        colorAxis={variantAxes.find(a => a.type === 'color') ?? null}
                        onChange={setColorGroupImages}
                        existingByColorGroup={existingByColorGroup}
                        disabled={saving}
                      />
                    </div>
                  )}

                  {variantRows.length > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(219,20,46,0.06)', border: '1.5px solid rgba(219,20,46,0.2)', borderRadius: 12, padding: '10px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Stock</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#db142e', lineHeight: 1 }}>{variantTotalStock}</span>
                      <span style={{ fontSize: 11, color: textMuted, fontWeight: 500 }}>units (auto-calculated)</span>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ── Variant Image Manager (edit mode) ── */}
          {showVariantImageManager && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <VariantImageManager
                variants={variantsForImageManager}
                onChange={setVariantImageChanges}
                disabled={saving}
              />
            </section>
          )}

          {/* ── Product-level Images ──
              Show when: no variant rows (simple product), or edit with existing product-level images
          ── */}
          {(!hasVariantRows || (isEdit && existingImages.length > 0)) && !showVariantImageManager && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: `1px solid ${border}` }}>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, margin: 0 }}>Images</p>
                <span style={{ fontSize: 11, color: textMuted }}>{totalImages}/8</span>
              </div>

              {existingImages.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: textMuted, fontWeight: 600, marginBottom: 8 }}>Current Images</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {existingImages.map(img => (
                      <ImageThumb key={img.id} src={img.url} isPrimary={img.id === primaryImageId} saving={saving}
                        onRemove={() => removeExisting(img.id)} onSetPrimary={() => setExistingPrimary(img.id)} />
                    ))}
                  </div>
                </div>
              )}

              {previews.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: textMuted, fontWeight: 600, marginBottom: 8 }}>New Images</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {previews.map(prev => (
                      <ImageThumb key={prev.id} src={prev.preview} isPrimary={existingImages.length === 0 && previews[0]?.id === prev.id}
                        saving={saving} onRemove={() => removePreview(prev.id)} onSetPrimary={() => {}} />
                    ))}
                  </div>
                </div>
              )}

              {totalImages < 8 && (
                <div onClick={() => !saving && fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)) }}
                  style={{ border: `2px dashed ${border}`, borderRadius: 14, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <Upload size={20} color={textMuted} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: textMuted, margin: 0 }}>
                    Drop images or <span style={{ color: '#db142e' }}>browse</span>
                  </p>
                  <p style={{ fontSize: 11, color: textMuted, margin: 0, opacity: 0.7 }}>JPG, PNG, WebP · max 5 MB each</p>
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={saving}
                    onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                </div>
              )}
            </section>
          )}

          {/* ── Actions ── */}
          <div style={{ display: 'flex', gap: 12, paddingTop: 4, position: 'sticky', bottom: 0, background: cardBg, paddingBottom: 2 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '11px 0', border: `1px solid ${border}`, background: 'transparent', color: textMuted, fontWeight: 700, fontSize: 13, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || catLoading}
              style={{ flex: 1, padding: '11px 0', background: 'linear-gradient(135deg,#db142e,#a00f22)', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 20px rgba(219,20,46,0.3)', opacity: (saving || catLoading) ? 0.6 : 1, fontFamily: 'inherit' }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}