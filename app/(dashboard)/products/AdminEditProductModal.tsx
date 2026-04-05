'use client'

/**
 * admin-panel/app/(dashboard)/products/AdminEditProductModal.tsx
 *
 * Full product edit modal for admin.
 * Reuses same category/subcategory/attribute fetch pattern as the seller modal.
 * Uses admin API (axios-based) instead of seller fetch-based API.
 * Does NOT change approval status — admin uses separate approve/reject buttons.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  X, Loader2, AlertCircle, Upload, Trash2, Star,
  ChevronDown, Plus, Minus,
} from 'lucide-react'
import api from '@/lib/axios'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttributeOption {
  id: number
  value: string
  color_hex?: string | null
  order: number
}

interface Attribute {
  id: number
  slug: string
  name: string
  type: string
  is_variant: boolean
  is_required: boolean
  options: AttributeOption[]
}

interface VariantRow {
  id?: number
  option_ids: number[]
  stock: number
  price_override: string
  sku: string
  is_active: boolean
}

interface Category { id: number; name: string; slug: string }
interface Subcategory { id: number; name: string; slug: string; category_id: number }

interface AdminProduct {
  id: number
  name: string
  slug?: string
  sku?: string | null
  description?: string | null
  short_description?: string | null
  price: number | string
  stock: number
  category_id?: number | null
  subcategory_id?: number | null
  is_active?: boolean
  is_approved?: boolean
  featured?: boolean
  existing_attributes?: Record<string, any>
  variant_rows?: VariantRow[]
  images?: Array<{ id: number; url?: string; image_path: string; is_primary: boolean; order: number }>
}

interface Props {
  productId: number
  onClose: () => void
  onSaved: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/api\/?$/, '')

function resolveUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  const clean = path.replace(/^\/storage\//, '').replace(/^\//, '')
  return `${BASE_URL}/storage/${clean}`
}

const inputCls = (err?: boolean) =>
  `w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition
   bg-bg-primary text-text-primary placeholder:text-text-muted
   focus:border-accent-red focus:ring-1 focus:ring-accent-red/20
   ${err ? 'border-accent-red bg-accent-red/5' : 'border-border'}`

function Field({ label, error, hint, required, children }: {
  label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
        {label} {required && <span className="text-accent-red">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-text-muted mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-accent-red mt-1">{error}</p>}
    </div>
  )
}

// ─── Variant Builder (inline, simplified) ─────────────────────────────────────

function VariantTable({ axes, rows, onChange, basePrice }: {
  axes: Attribute[]
  rows: VariantRow[]
  onChange: (rows: VariantRow[]) => void
  basePrice: string
}) {
  const addRow = () => {
    onChange([...rows, {
      option_ids: new Array(axes.length).fill(0),
      stock: 0,
      price_override: '',
      sku: '',
      is_active: true,
    }])
  }

  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  const setRowField = (i: number, field: keyof VariantRow, value: any) => {
    const next = [...rows]
    next[i] = { ...next[i], [field]: value }
    onChange(next)
  }

  const setOptionId = (rowIdx: number, axisIdx: number, optId: number) => {
    const next = [...rows]
    const ids = [...(next[rowIdx].option_ids)]
    ids[axisIdx] = optId
    next[rowIdx] = { ...next[rowIdx], option_ids: ids }
    onChange(next)
  }

  if (axes.length === 0) return (
    <div className="text-xs text-text-muted bg-bg-primary border border-border rounded-xl p-3">
      This subcategory has no variant axes configured.
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-bg-primary border-b border-border">
              {axes.map(a => (
                <th key={a.slug} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted">
                  {a.name}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted">Stock</th>
              <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted">Price Override</th>
              <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted">SKU</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-bg-hover/40 transition-colors">
                {axes.map((axis, axisIdx) => (
                  <td key={axis.slug} className="px-3 py-2">
                    <select
                      value={row.option_ids[axisIdx] ?? 0}
                      onChange={e => setOptionId(rowIdx, axisIdx, Number(e.target.value))}
                      className="bg-bg-primary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-red transition-colors w-full"
                    >
                      <option value={0}>— select —</option>
                      {axis.options.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {axis.type === 'color' && opt.color_hex ? `● ${opt.value}` : opt.value}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
                <td className="px-3 py-2">
                  <input
                    type="number" min={0}
                    value={row.stock}
                    onChange={e => setRowField(rowIdx, 'stock', Number(e.target.value))}
                    className="w-16 bg-bg-primary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-red transition-colors"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="relative">
                    <input
                      type="number" min={0} step="0.001"
                      value={row.price_override}
                      onChange={e => setRowField(rowIdx, 'price_override', e.target.value)}
                      placeholder={`${basePrice || '0.000'}`}
                      className="w-24 bg-bg-primary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-red transition-colors"
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.sku}
                    onChange={e => setRowField(rowIdx, 'sku', e.target.value)}
                    placeholder="optional"
                    className="w-24 bg-bg-primary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-red transition-colors"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIdx)}
                    className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-bold text-accent-red hover:opacity-80 transition-opacity"
      >
        <Plus size={12} /> Add variant row
      </button>
    </div>
  )
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

export default function AdminEditProductModal({ productId, onClose, onSaved }: Props) {

  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [apiError,  setApiError]  = useState('')
  const [errors,    setErrors]    = useState<Record<string, string>>({})

  // Form state
  const [form, setForm] = useState({
    name:              '',
    sku:               '',
    description:       '',
    short_description: '',
    price:             '',
    stock:             '0',
    category_id:       '',
    subcategory_id:    '',
    is_active:         true,
    featured:          false,
  })

  // Category / Subcategory
  const [categories,    setCategories]    = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [catLoading,    setCatLoading]    = useState(false)
  const [subLoading,    setSubLoading]    = useState(false)

  // Attributes
  const [variantAxes, setVariantAxes] = useState<Attribute[]>([])
  const [infoAxes,    setInfoAxes]    = useState<Attribute[]>([])
  const [attrLoading, setAttrLoading] = useState(false)
  const [attrValues,  setAttrValues]  = useState<Record<string, any>>({})

  // Variants
  const [variantRows, setVariantRows] = useState<VariantRow[]>([])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // ── Load product ──────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    api.get(`/admin/products/${productId}`)
      .then(res => {
        const p: AdminProduct = res.data.data
        setForm({
          name:              p.name              ?? '',
          sku:               p.sku               ?? '',
          description:       p.description       ?? '',
          short_description: p.short_description ?? '',
          price:             String(p.price       ?? ''),
          stock:             String(p.stock       ?? 0),
          category_id:       p.category_id       != null ? String(p.category_id) : '',
          subcategory_id:    p.subcategory_id     != null ? String(p.subcategory_id) : '',
          is_active:         p.is_active          ?? true,
          featured:          p.featured           ?? false,
        })
        setAttrValues(p.existing_attributes ?? {})
        setVariantRows((p.variant_rows ?? []).map(r => ({
          id:             r.id,
          option_ids:     r.option_ids ?? [],
          stock:          r.stock      ?? 0,
          price_override: r.price_override ?? '',
          sku:            r.sku        ?? '',
          is_active:      r.is_active  ?? true,
        })))
      })
      .catch(() => setApiError('Failed to load product.'))
      .finally(() => setLoading(false))
  }, [productId])

  // ── Load categories ───────────────────────────────────────────────────────

  useEffect(() => {
    setCatLoading(true)
    // Use PUBLIC endpoint — no admin auth needed for category list
    fetch(`${BASE_URL}/api/categories`, { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(j => setCategories(j.data ?? []))
      .catch(() => {})
      .finally(() => setCatLoading(false))
  }, [])

  // ── Load subcategories when category changes ──────────────────────────────

  useEffect(() => {
    if (!form.category_id) { setSubcategories([]); return }
    const cat = categories.find(c => c.id === Number(form.category_id))
    if (!cat?.slug) return
    setSubLoading(true)
    fetch(`${BASE_URL}/api/categories/${cat.slug}/subcategories`, { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(j => setSubcategories(j.data ?? []))
      .catch(() => setSubcategories([]))
      .finally(() => setSubLoading(false))
  }, [form.category_id, categories])

  // ── Load attributes when subcategory changes ──────────────────────────────

  useEffect(() => {
    if (!form.subcategory_id) { setVariantAxes([]); setInfoAxes([]); return }
    const subId = Number(form.subcategory_id)
    if (!subId) return
    setAttrLoading(true)
    fetch(`${BASE_URL}/api/subcategories/${subId}/attributes`, { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(j => {
        const data = j.data ?? {}
        setVariantAxes((data.variant_attributes ?? []).filter((a: Attribute) => a.options?.length > 0))
        setInfoAxes(data.info_attributes ?? [])
      })
      .catch(() => { setVariantAxes([]); setInfoAxes([]) })
      .finally(() => setAttrLoading(false))
  }, [form.subcategory_id])

  // ── Variant total stock ───────────────────────────────────────────────────

  const variantTotalStock = useMemo(
    () => variantRows.reduce((s, r) => s + Number(r.stock || 0), 0),
    [variantRows]
  )

  const hasVariants = variantRows.length > 0

  // Keep stock in sync with variant total
  useEffect(() => {
    if (hasVariants) {
      set('stock', String(variantTotalStock))
    }
  }, [variantTotalStock, hasVariants])

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setApiError('')

    // Validate
    const errs: Record<string, string> = {}
    if (!form.name.trim())    errs.name  = 'Required.'
    if (!form.category_id)    errs.category_id = 'Required.'
    if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0)
                              errs.price = 'Enter a valid price.'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const payload: Record<string, any> = {
        name:              form.name.trim(),
        sku:               form.sku.trim()               || undefined,
        description:       form.description.trim()       || undefined,
        short_description: form.short_description.trim() || undefined,
        price:             parseFloat(form.price),
        stock:             hasVariants ? variantTotalStock : parseInt(form.stock, 10),
        category_id:       parseInt(form.category_id, 10),
        subcategory_id:    form.subcategory_id ? parseInt(form.subcategory_id, 10) : null,
        is_active:         form.is_active,
        featured:          form.featured,
      }

      // Attributes
      if (Object.keys(attrValues).length > 0) {
        const serialized: Record<string, string> = {}
        for (const [slug, val] of Object.entries(attrValues)) {
          if (val === null || val === undefined || val === '') continue
          if (Array.isArray(val)) {
            if (val.length === 0) continue
            serialized[slug] = JSON.stringify(val)
          } else if (typeof val === 'boolean') {
            serialized[slug] = val ? '1' : '0'
          } else {
            serialized[slug] = String(val)
          }
        }
        if (Object.keys(serialized).length > 0) {
          payload.attributes = serialized
        }
      }

      // Variants
      if (hasVariants && variantAxes.length > 0) {
        const validVariants = variantRows
          .filter(row => row.option_ids.filter(id => id > 0).length === variantAxes.length)
          .map(row => ({
            ...(row.id ? { id: row.id } : {}),
            option_ids:     row.option_ids.filter(id => id > 0),
            stock:          row.stock,
            price_override: row.price_override !== '' ? row.price_override : null,
            sku:            row.sku || undefined,
            is_active:      row.is_active,
          }))
        if (validVariants.length > 0) payload.variants = validVariants
      }

      await api.put(`/admin/products/${productId}`, payload)
      onSaved()
      onClose()
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

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-primary">Edit Product</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Approval status will not change unless you explicitly modify it.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-accent-red" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {apiError && (
                <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/25 rounded-xl px-4 py-3 text-sm text-accent-red">
                  <AlertCircle size={14} className="flex-shrink-0" /> {apiError}
                </div>
              )}

              {/* ── Basic Info ── */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted pb-2 border-b border-border mb-4">Basic Information</p>
                <div className="space-y-3">
                  <Field label="Product Name" required error={errors.name}>
                    <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Product name" className={inputCls(!!errors.name)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="SKU">
                      <input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Leave blank to keep" className={inputCls()} />
                    </Field>
                    <Field label="Short Description">
                      <input value={form.short_description} onChange={e => set('short_description', e.target.value)} placeholder="One-liner…" className={inputCls()} />
                    </Field>
                  </div>
                  <Field label="Full Description">
                    <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detailed description…" className={`${inputCls()} resize-none`} />
                  </Field>
                </div>
              </section>

              {/* ── Pricing & Inventory ── */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted pb-2 border-b border-border mb-4">Pricing & Inventory</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Base Price (TND)" required error={errors.price}>
                    <div className="relative">
                      <input
                        type="number" min={0} step="0.001"
                        value={form.price} onChange={e => set('price', e.target.value)}
                        placeholder="0.000"
                        className={inputCls(!!errors.price)}
                        style={{ paddingRight: 44 }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-semibold">TND</span>
                    </div>
                  </Field>
                 {!hasVariants && (
                    <Field label="Stock">
                      <input
                        type="number" min={0}
                        value={form.stock}
                        onChange={e => set('stock', e.target.value)}
                        className={inputCls()}
                      />
                    </Field>
                  )}
                  <Field label="Status">
                    <select value={form.is_active ? 'active' : 'inactive'} onChange={e => set('is_active', e.target.value === 'active')} className={inputCls()}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </Field>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input type="checkbox" id="featured_chk" checked={form.featured} onChange={e => set('featured', e.target.checked)} className="w-4 h-4 rounded accent-red-600 cursor-pointer" />
                  <label htmlFor="featured_chk" className="text-sm text-text-primary cursor-pointer">Mark as Featured</label>
                </div>
              </section>

              {/* ── Category ── */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted pb-2 border-b border-border mb-4">Category</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Category" required error={errors.category_id}>
                    <select
                      value={form.category_id}
                      onChange={e => {
                        set('category_id', e.target.value)
                        set('subcategory_id', '')
                        setVariantAxes([])
                        setInfoAxes([])
                        setAttrValues({})
                        setVariantRows([])
                      }}
                      disabled={catLoading}
                      className={inputCls(!!errors.category_id)}
                    >
                      <option value="">{catLoading ? 'Loading…' : '— Select category —'}</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Subcategory" hint="Select to unlock attributes">
                    <select
                      value={form.subcategory_id}
                      onChange={e => {
                        set('subcategory_id', e.target.value)
                        setAttrValues({})
                        setVariantRows([])
                      }}
                      disabled={!form.category_id || subLoading}
                      className={inputCls()}
                    >
                      <option value="">{subLoading ? 'Loading…' : !form.category_id ? '— Select category first —' : '— None —'}</option>
                      {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                </div>
              </section>

              {/* ── Info Attributes ── */}
              {form.subcategory_id && !attrLoading && infoAxes.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted pb-2 border-b border-border mb-4">
                    Product Details <span className="ml-1 text-purple-400 normal-case font-normal">(informational)</span>
                  </p>
                  <div className="space-y-3">
                    {infoAxes.map(attr => (
                      <Field key={attr.slug} label={attr.name}>
                        {attr.type === 'boolean' ? (
                          <div className="flex gap-2">
                            {[true, false].map(v => (
                              <button key={String(v)} type="button"
                                onClick={() => setAttrValues(a => ({ ...a, [attr.slug]: v }))}
                                className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${attrValues[attr.slug] === v ? 'border-accent-green bg-accent-green/10 text-accent-green' : 'border-border text-text-muted hover:bg-bg-hover'}`}>
                                {v ? 'Yes' : 'No'}
                              </button>
                            ))}
                          </div>
                        ) : attr.type === 'text' || attr.type === 'number' ? (
                          <input
                            type={attr.type === 'number' ? 'number' : 'text'}
                            value={attrValues[attr.slug] ?? ''}
                            onChange={e => setAttrValues(a => ({ ...a, [attr.slug]: e.target.value }))}
                            className={inputCls()}
                          />
                        ) : (
                          // select / multiselect / color
                          <div className="flex flex-wrap gap-2">
                            {attr.options.map(opt => {
                              const selected = Array.isArray(attrValues[attr.slug])
                                ? attrValues[attr.slug].includes(opt.id)
                                : attrValues[attr.slug] === opt.id
                              const toggle = () => {
                                if (attr.type === 'multiselect') {
                                  const cur: number[] = attrValues[attr.slug] ?? []
                                  setAttrValues(a => ({ ...a, [attr.slug]: selected ? cur.filter(x => x !== opt.id) : [...cur, opt.id] }))
                                } else {
                                  setAttrValues(a => ({ ...a, [attr.slug]: selected ? null : opt.id }))
                                }
                              }
                              return attr.type === 'color' ? (
                                <button key={opt.id} type="button" onClick={toggle} title={opt.value}
                                  style={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    background: opt.color_hex ?? '#e5e7eb',
                                    border: selected ? '3px solid #db142e' : '2px solid #1e2128',
                                    outline: selected ? '2px solid rgba(255,255,255,0.2)' : 'none',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                  }} />
                              ) : (
                                <button key={opt.id} type="button" onClick={toggle}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${selected ? 'border-accent-red bg-accent-red/10 text-accent-red' : 'border-border text-text-muted hover:bg-bg-hover'}`}>
                                  {opt.value}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </Field>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Variants ── */}
              {form.subcategory_id && (
                <section>
                  <div className="flex items-center gap-2 pb-2 border-b border-border mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Variants</p>
                    {attrLoading && <Loader2 size={10} className="animate-spin text-text-muted" />}
                    {!attrLoading && variantAxes.length > 0 && (
                      <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                        axes: {variantAxes.map(a => a.name).join(', ')}
                      </span>
                    )}
                  </div>
                  {!attrLoading && (
                    <VariantTable
                      axes={variantAxes}
                      rows={variantRows}
                      onChange={setVariantRows}
                      basePrice={form.price}
                    />
                  )}{hasVariants && variantRows.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div className="inline-flex items-center gap-2.5 bg-accent-red/5 border border-accent-red/20 rounded-xl px-4 py-2.5">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Stock</span>
                        <span className="text-xl font-black text-accent-red">{variantTotalStock}</span>
                        <span className="text-xs text-text-muted">units (auto-calculated)</span>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* ── Actions ── */}
              <div className="flex gap-3 pt-2 sticky bottom-0 bg-bg-card pb-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-accent-red hover:bg-accent-red/90 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Save Changes
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  )
}