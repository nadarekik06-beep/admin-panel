'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { format } from 'date-fns'
import {
  AlertCircle, AlertTriangle, ArrowLeft, CheckCircle, ExternalLink, Eye, History, Image as ImageIcon,
  Layers, RotateCcw, Save, Search, Tag, Wand2, XCircle, DollarSign, UserCog,
} from 'lucide-react'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import type { Attribute } from '@/components/types'
import AttributeField from '../../../brand-products/AttributeField'
import ModerationActionModal from '../../ModerationActionModal'
import { STATUS_META, apiErrorMessage } from '../../reviewUtils'
import { productEditorApi, type EditorPayload } from '@/lib/api/productEditor'
import ImageSetManager from './_components/ImageSetManager'
import VariantsEditor from './_components/VariantsEditor'
import HistoryPanel from './_components/HistoryPanel'
import { Card, Field, Toasts, Toggle, inputCls, type ToastMsg } from './_components/ui'
import {
  type EditorState, type Errors, type ImgItem, type TabId,
  activeColorGroups, fingerprint, fromPayload, isColorAxis, mapServerErrors, tabOf, toDocument, validate,
} from './_components/editorModel'

import BrandLoader from '@/components/brand/BrandLoader'
import { usePageLoading } from '@/components/brand/NavigationLoader'
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/api\/?$/, '')
const LEAVE_MSG = 'You have unsaved changes. Leave without saving?'

interface Category { id: number; name: string; slug: string }
interface Subcategory { id: number; name: string; slug: string; category_id: number }

const TABS: { id: TabId; label: string; icon: typeof Tag }[] = [
  { id: 'general',  label: 'General',         icon: Tag },
  { id: 'pricing',  label: 'Pricing & Stock', icon: DollarSign },
  { id: 'images',   label: 'Images',          icon: ImageIcon },
  { id: 'variants', label: 'Variants',        icon: Layers },
  { id: 'seo',      label: 'SEO & Notes',     icon: Search },
  { id: 'history',  label: 'History',         icon: History },
]

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').replace(/^-|-$/g, '')

export default function ProductEditorPage() {
  const { id } = useParams<{ id: string }>()
  const productId = Number(id)
  const router = useRouter()

  const [payload, setPayload]   = useState<EditorPayload | null>(null)
  const [state, setStateRaw]    = useState<EditorState | null>(null)
  const [baseline, setBaseline] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  // holds the navigation loader until the first load is done
  usePageLoading(!payload && !loadError)
  const [tab, setTab]           = useState<TabId>('general')

  const [categories, setCategories]       = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [variantAxes, setVariantAxes]     = useState<Attribute[]>([])
  const [infoAxes, setInfoAxes]           = useState<Attribute[]>([])
  const [axesLoading, setAxesLoading]     = useState(false)

  const [showErrors, setShowErrors]     = useState(false)
  const [serverErrors, setServerErrors] = useState<Errors>({})
  const [saving, setSaving]     = useState<null | 'save' | 'approve'>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [toasts, setToasts]     = useState<ToastMsg[]>([])
  const [conflict, setConflict] = useState<{ approve: boolean } | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const leaving = useRef(false)

  // ── Toasts ────────────────────────────────────────────────────────────────
  const toast = useCallback((message: string, type: ToastMsg['type'] = 'success') => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), message, type }])
  }, [])
  const dismiss = useCallback((tid: number) => setToasts((t) => t.filter((x) => x.id !== tid)), [])

  // ── State helpers ─────────────────────────────────────────────────────────
  const setState = useCallback((fn: (s: EditorState) => EditorState) => {
    setStateRaw((s) => (s ? fn(s) : s))
    setServerErrors({})
  }, [])
  const set = useCallback(<K extends keyof EditorState>(k: K, v: EditorState[K]) => setState((s) => ({ ...s, [k]: v })), [setState])

  const init = useCallback((p: EditorPayload) => {
    const s = fromPayload(p)
    setPayload(p)
    setStateRaw(s)
    setBaseline(fingerprint(s, null))
    setServerErrors({})
    setShowErrors(false)
  }, [])

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoadError(null)
    try {
      init(await productEditorApi.load(productId))
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setLoadError(status === 404 ? 'This product does not exist or was deleted.' : apiErrorMessage(err, 'Failed to load the product.'))
    }
  }, [productId, init])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/categories`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json()).then((j) => setCategories(j.data ?? [])).catch(() => setCategories([]))
  }, [])

  const categoryId = state?.category_id ?? ''
  useEffect(() => {
    const cat = categories.find((c) => String(c.id) === categoryId)
    if (!cat) { setSubcategories([]); return }
    fetch(`${API_ORIGIN}/api/categories/${cat.slug}/subcategories`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json()).then((j) => setSubcategories(j.data ?? [])).catch(() => setSubcategories([]))
  }, [categoryId, categories])

  const subcategoryId = state?.subcategory_id ?? ''
  useEffect(() => {
    if (!subcategoryId) { setVariantAxes([]); setInfoAxes([]); return }
    setAxesLoading(true)
    fetch(`${API_ORIGIN}/api/subcategories/${subcategoryId}/attributes`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((j) => {
        const d = j.data ?? {}
        setVariantAxes((d.variant_attributes ?? []).filter((a: Attribute) => a.options?.length > 0))
        setInfoAxes(d.info_attributes ?? [])
      })
      .catch(() => { setVariantAxes([]); setInfoAxes([]) })
      .finally(() => setAxesLoading(false))
  }, [subcategoryId])

  const colorAxis = useMemo(() => variantAxes.find(isColorAxis) ?? null, [variantAxes])

  // ── Dirty / validation ────────────────────────────────────────────────────
  const dirty = !!state && fingerprint(state, null) !== baseline
  const limits = payload?.limits ?? { gallery_max: 8, set_max: 5, max_colors_per_group: 5, max_file_kb: 5120 }

  // Season / Occasion only applies to the categories the backend lists (App\Support\Occasions)
  const categorySlug   = categories.find((c) => String(c.id) === categoryId)?.slug
  const occasionsApply = !!categorySlug && !!payload?.occasions.category_slugs.includes(categorySlug)

  const validationCtx = useCallback((approve: boolean) => ({
    variantAxes, infoAxes, approve,
    galleryMax: limits.gallery_max, setMax: limits.set_max, maxColors: limits.max_colors_per_group,
    occasionsApply,
  }), [variantAxes, infoAxes, limits, occasionsApply])

  const clientErrors = useMemo(
    () => (state && showErrors ? validate(state, validationCtx(false)) : {}),
    [state, showErrors, validationCtx],
  )
  const errors: Errors = { ...clientErrors, ...serverErrors }
  const errorCount = (t: TabId) => Object.keys(errors).filter((k) => tabOf(k) === t).length

  // ── Leave guards ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (!leaving.current) { e.preventDefault(); e.returnValue = '' } }
    // In-app links (sidebar, breadcrumbs…) — capture phase runs before Next's router
    const onClick = (e: MouseEvent) => {
      if (leaving.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const a = (e.target as HTMLElement).closest('a')
      if (!a || a.target === '_blank' || !a.href || a.href.startsWith('javascript:')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin || url.pathname === location.pathname) return
      if (!window.confirm(LEAVE_MSG)) { e.preventDefault(); e.stopPropagation() }
      else leaving.current = true
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])

  const leaveTo = useCallback((href: string) => { leaving.current = true; router.push(href) }, [router])

  // ── Save ──────────────────────────────────────────────────────────────────
  const revokeNew = (s: EditorState) => {
    const all: ImgItem[] = [...s.gallery, ...Object.values(s.colorImages).flat()]
    all.forEach((i) => { if (i.kind === 'new') URL.revokeObjectURL(i.url) })
  }

  const focusFirstError = (errs: Errors) => {
    const first = Object.keys(errs)[0]
    if (!first) return
    setTab(tabOf(first))
    setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }

  const save = async (approve: boolean, force = false) => {
    if (!state || !payload || saving) return
    setShowErrors(true)
    const errs = validate(state, validationCtx(approve))
    if (Object.keys(errs).length) {
      setServerErrors(approve && errs['images.gallery'] ? { 'images.gallery': errs['images.gallery'] } : {})
      toast(`Please fix ${Object.keys(errs).length} field${Object.keys(errs).length > 1 ? 's' : ''} before saving.`, 'error')
      focusFirstError(errs)
      return
    }

    const { doc, uploads, groupOrder } = toDocument(state, payload.product.updated_at, colorAxis)
    if (approve) doc.approve = true
    if (force) doc.force = true
    const uploadCount = Object.keys(uploads).length

    setSaving(approve ? 'approve' : 'save')
    setProgress(uploadCount ? 0 : null)
    try {
      const res = await productEditorApi.save(productId, doc, uploads, uploadCount ? setProgress : undefined)
      revokeNew(state)
      if (approve) {
        toast(res.message)
        init(res.data)
        setTimeout(() => leaveTo('/products'), 900)
      } else {
        init(res.data)
        toast(res.message, res.message.startsWith('No changes') ? 'info' : 'success')
      }
    } catch (err) {
      const r = (err as { response?: { status?: number; data?: { errors?: Record<string, string[]>; message?: string } } })?.response
      if (r?.status === 409) {
        setConflict({ approve })
      } else if (r?.status === 422 && r.data?.errors) {
        const mapped = mapServerErrors(r.data.errors, groupOrder)
        setServerErrors(mapped)
        toast(Object.values(mapped)[0] ?? 'Some fields are invalid.', 'error')
        focusFirstError(mapped)
      } else if (r?.status === 413) {
        toast('The upload is too large for the server. Try fewer or smaller images.', 'error')
      } else {
        toast(apiErrorMessage(err, 'Saving failed. Please try again.'), 'error')
      }
    } finally {
      setSaving(null)
      setProgress(null)
    }
  }

  // Ctrl/Cmd + S
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const discard = () => {
    if (!payload || !state) return
    revokeNew(state)
    init(payload)
    setConfirmDiscard(false)
    toast('Changes discarded.', 'info')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center bg-bg-card border border-border rounded-xl p-8">
        <AlertCircle className="mx-auto text-[#db142e] mb-3" size={28} />
        <p className="text-text-primary font-semibold mb-1">Couldn&apos;t open the editor</p>
        <p className="text-sm text-text-muted mb-5">{loadError}</p>
        <div className="flex justify-center gap-2">
          <Link href="/products" className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-hover">Back to products</Link>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-[#db142e] text-white text-sm font-semibold">Retry</button>
        </div>
      </div>
    )
  }

  if (!state || !payload) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 bg-bg-card rounded-xl" />
        <div className="h-10 bg-bg-card rounded-xl w-2/3" />
        <div className="h-72 bg-bg-card rounded-xl" />
      </div>
    )
  }

  const p = payload.product
  const status = STATUS_META[p.status]
  const hasVariants = state.variants.length > 0
  const variantStock = state.variants.reduce((n, v) => n + (parseInt(v.stock, 10) || 0), 0)
  const canApprove = p.status !== 'approved' && p.status !== 'deleted_by_seller'
  const usedGroups = activeColorGroups(state.variants, colorAxis)
  const coverFallback = state.gallery.length === 0

  return (
    <div className="max-w-6xl mx-auto">
      <Toasts toasts={toasts} dismiss={dismiss} />

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="min-w-0">
          <Link href="/products" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary mb-2">
            <ArrowLeft size={13} /> Product requests
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-text-primary truncate max-w-full">{state.name || 'Untitled product'}</h1>
            <Badge variant={status?.badge ?? 'info'}>{status?.label ?? p.status}</Badge>
            {p.admin_edited_at && (
              <span
                title={`Last edited by ${p.admin_edited_by?.name ?? 'an admin'} on ${format(new Date(p.admin_edited_at), 'MMM d, yyyy HH:mm')}`}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#db142e]/10 text-[#f87171] border border-[#db142e]/30"
              >
                <UserCog size={11} /> Edited by admin
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1">
            #{p.id} · by <span className="text-text-secondary">{p.seller?.name ?? 'Platform'}</span>
            {p.seller?.email && <> ({p.seller.email})</>} · submitted {format(new Date(p.created_at), 'MMM d, yyyy')}
          </p>
          {p.rejection_reason && p.status === 'rejected' && (
            <p className="text-xs text-[#f87171] mt-1">Rejected: {p.rejection_reason}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href={`/products/${p.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover">
            <Eye size={13} /> Review page
          </Link>
          {p.status === 'approved' && (
            <a href={p.storefront_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover">
              <ExternalLink size={13} /> Storefront
            </a>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sticky -top-6 z-20 -mx-6 px-6 bg-bg-primary/95 backdrop-blur border-b border-border mb-5">
        <nav className="flex gap-1 overflow-x-auto" role="tablist">
          {TABS.map((t) => {
            const n = errorCount(t.id)
            const Icon = t.icon
            return (
              <button
                key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={clsx(
                  'relative flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors',
                  tab === t.id ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary',
                )}
              >
                <Icon size={14} /> {t.label}
                {t.id === 'variants' && hasVariants && <span className="text-[10px] text-text-muted">({state.variants.length})</span>}
                {n > 0 && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#db142e] text-white text-[10px] font-bold flex items-center justify-center">{n}</span>}
                {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#db142e]" />}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── General ── */}
      {tab === 'general' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card title="Basic information">
            <div className="space-y-4">
              <Field label="Product name" required error={errors.name} htmlFor="f-name" counter={{ value: state.name.length, max: 255 }}>
                <input id="f-name" value={state.name} onChange={(e) => set('name', e.target.value)} className={inputCls(!!errors.name)} maxLength={255} />
              </Field>
              <Field label="Short description" htmlFor="f-short" error={errors.short_description} hint="One line shown under the name on product cards." counter={{ value: state.short_description.length, max: 500 }}>
                <input id="f-short" value={state.short_description} onChange={(e) => set('short_description', e.target.value)} className={inputCls(!!errors.short_description)} />
              </Field>
              <Field label="Description" htmlFor="f-desc" error={errors.description} hint="Plain text, as in the seller form. Line breaks are kept." counter={{ value: state.description.length, max: 20000 }}>
                <textarea id="f-desc" rows={10} value={state.description} onChange={(e) => set('description', e.target.value)} className={clsx(inputCls(!!errors.description), 'resize-y min-h-[160px] leading-relaxed')} />
              </Field>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Category">
              <div className="space-y-4">
                <Field label="Category" required error={errors.category_id}>
                  <select
                    value={state.category_id}
                    onChange={(e) => setState((s) => ({ ...s, category_id: e.target.value, subcategory_id: '', attributes: {} }))}
                    className={inputCls(!!errors.category_id)}
                  >
                    <option value="">Select a category…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Subcategory" error={errors.subcategory_id} hint={hasVariants ? 'Changing it can invalidate the variants (their options come from the subcategory).' : 'Unlocks the product details and variant attributes.'}>
                  <select
                    value={state.subcategory_id}
                    onChange={(e) => setState((s) => ({ ...s, subcategory_id: e.target.value, attributes: {} }))}
                    disabled={!state.category_id}
                    className={inputCls(!!errors.subcategory_id)}
                  >
                    <option value="">{state.category_id ? '— None —' : 'Choose a category first'}</option>
                    {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              </div>
            </Card>

            {state.subcategory_id && (
              <Card title="Product details" description={axesLoading ? 'Loading attributes…' : infoAxes.length ? 'Attributes defined for this subcategory.' : 'This subcategory has no extra attributes.'}>
                <div className="space-y-4">
                  {infoAxes.map((attr) => (
                    <Field key={attr.id} label={attr.name} required={attr.is_required} error={errors[`attributes.${attr.slug}`]}>
                      <AttributeField attr={attr} values={state.attributes} onChange={(slug, v) => setState((s) => ({ ...s, attributes: { ...s.attributes, [slug]: v } }))} />
                    </Field>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Pricing & stock ── */}
      {tab === 'pricing' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Price & delivery">
            <div className="space-y-4">
              <Field label="Base price (TND)" required error={errors.price} hint={hasVariants ? 'Variants without their own price use this one.' : undefined}>
                <div className="relative">
                  <input type="number" min={0} step="0.001" inputMode="decimal" value={state.price} onChange={(e) => set('price', e.target.value)} className={clsx(inputCls(!!errors.price), 'pr-14')} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-text-muted">TND</span>
                </div>
              </Field>
              <Toggle checked={state.free_delivery} onChange={(v) => set('free_delivery', v)} label="Free delivery" description="The customer pays no delivery fee; the shipping cost comes off the seller's earnings." />
            </div>
          </Card>

          <Card title="Inventory & visibility">
            <div className="space-y-4">
              <Field label="SKU" error={errors.sku} hint="Optional internal reference.">
                <input value={state.sku} onChange={(e) => set('sku', e.target.value)} maxLength={100} className={inputCls(!!errors.sku)} />
              </Field>
              <Field label="Stock" required error={errors.stock} hint={hasVariants ? <>Sum of the variants’ stock — edit it in <button type="button" className="text-[#f87171] hover:underline" onClick={() => setTab('variants')}>Variants</button>.</> : undefined}>
                <input
                  type="number" min={0} step={1} inputMode="numeric"
                  value={hasVariants ? String(variantStock) : state.stock}
                  onChange={(e) => set('stock', e.target.value.replace(/[^\d]/g, ''))}
                  disabled={hasVariants} className={inputCls(!!errors.stock)}
                />
              </Field>
              <Toggle checked={state.is_active} onChange={(v) => set('is_active', v)} label="Active" description="Inactive products stay hidden even once approved." />
              <Toggle checked={state.is_pack} onChange={(v) => set('is_pack', v)} label="Multi-pack"
                description="Several units of the same product sold together. Not a bundle of different products." />
              {state.is_pack && (
                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <Field label="Units per pack" required error={errors.pack_quantity}>
                    <input
                      type="number" min={2} max={1000} step={1} inputMode="numeric"
                      value={state.pack_quantity}
                      onChange={(e) => set('pack_quantity', e.target.value.replace(/[^\d]/g, ''))}
                      className={inputCls(!!errors.pack_quantity)}
                    />
                  </Field>
                  <Field label="Pack contents" error={errors.pack_contents} hint="Optional, shown on the product page.">
                    <input value={state.pack_contents} onChange={(e) => set('pack_contents', e.target.value)} maxLength={500} className={inputCls(!!errors.pack_contents)} />
                  </Field>
                </div>
              )}
            </div>
          </Card>

          {occasionsApply && <Card title="Season / Occasion" description="When the product sells best: storefront filter and sales forecasts. At least one." className="lg:col-span-2">
            <div className="flex flex-wrap gap-2">
              {Object.entries(payload.occasions.values).map(([key, label]) => {
                const on = state.occasions.includes(key)
                // all_season is exclusive: picking it clears the others, picking another clears it
                const next = key === 'all_season'
                  ? (on ? [] : ['all_season'])
                  : on ? state.occasions.filter((x) => x !== key) : [...state.occasions.filter((x) => x !== 'all_season'), key]
                return (
                  <button
                    key={key} type="button"
                    onClick={() => set('occasions', next)}
                    className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                      on ? 'bg-[#198f41]/15 border-[#198f41]/60 text-[#34d399]' : 'border-border text-text-muted hover:bg-bg-hover')}
                    aria-pressed={on}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {errors.occasions && <p className="text-[11px] text-[#f87171] mt-2" data-field-error>{errors.occasions}</p>}
          </Card>}
        </div>
      )}

      {/* ── Images ── */}
      {tab === 'images' && (
        <div className="space-y-4">
          <Card
            title="Main gallery"
            description="Shown on the product page and in listings. Drag to reorder — the first image is the cover."
          >
            <ImageSetManager
              items={state.gallery} onChange={(items) => set('gallery', items)} coverLabel
              max={limits.gallery_max} maxFileKb={limits.max_file_kb} error={errors['images.gallery']}
              onNotify={(m) => toast(m, 'error')}
              emptyHint={usedGroups.length ? 'No gallery images — the first color group photo is used as the cover.' : 'Add at least one image.'}
            />
            {coverFallback && usedGroups.length > 0 && (
              <p className="text-[11px] text-[#fbbf24] mt-2 flex items-center gap-1"><AlertTriangle size={11} /> Without gallery images, the cover is the first photo of the first color group.</p>
            )}
          </Card>

          {colorAxis && usedGroups.length > 0 && (
            <Card title="Color group photos" description="Shown when the customer picks that color. Shared by every size of the color group.">
              <div className="space-y-4">
                {usedGroups.map((key) => {
                  const ids = key.split('|').map(Number)
                  return (
                    <div key={key} className="rounded-lg border border-border bg-bg-primary/50 p-3">
                      <p className="flex items-center gap-2 text-xs font-semibold text-text-secondary mb-2">
                        <span className="inline-flex -space-x-1">
                          {ids.map((cid) => {
                            const o = colorAxis.options.find((x) => x.id === cid)
                            return <span key={cid} className="w-4 h-4 rounded-full border-2 border-bg-card" style={{ background: o?.color_hex ?? '#888' }} />
                          })}
                        </span>
                        {ids.map((cid) => colorAxis.options.find((x) => x.id === cid)?.value ?? cid).join(' + ')}
                      </p>
                      <ImageSetManager
                        compact items={state.colorImages[key] ?? []} max={limits.set_max} maxFileKb={limits.max_file_kb}
                        onChange={(items) => setState((s) => ({ ...s, colorImages: { ...s.colorImages, [key]: items } }))}
                        onNotify={(m) => toast(m, 'error')} error={errors[`images.color.${key}`]}
                      />
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {Object.keys(errors).some((k) => k.startsWith('images.color') && !usedGroups.some((g) => k === `images.color.${g}`)) && (
            <div className="flex items-center gap-2 text-xs text-[#fbbf24] bg-[#f59e0b]/10 border border-[#f59e0b]/25 rounded-lg px-3 py-2">
              <AlertTriangle size={14} /> Some color photos belong to colors no variant uses anymore.
              <button type="button" className="underline font-semibold" onClick={() => setTab('variants')}>Fix in Variants</button>
            </div>
          )}
          <p className="text-[11px] text-text-muted">Images upload when you save. Accepted: JPG, PNG, WEBP, GIF — up to {Math.round(limits.max_file_kb / 1024)} MB each. There are no per-size photos: every size of a color shows that color's photos.</p>
        </div>
      )}

      {/* ── Variants ── */}
      {tab === 'variants' && (
        <VariantsEditor
          state={state} setState={setState} axes={variantAxes} axesLoading={axesLoading}
          hasSubcategory={!!state.subcategory_id} errors={errors} limits={limits}
          notify={(m) => toast(m, 'error')}
        />
      )}

      {/* ── SEO & notes ── */}
      {tab === 'seo' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="URL">
            <Field label="Slug" error={errors.slug} hint={<>Product URL: <span className="text-text-secondary break-all">/products/{state.slug || slugify(state.name) || '…'}</span>. Leave empty to generate it from the name; duplicates get a number.</>}>
              <div className="flex gap-2">
                <input value={state.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} className={inputCls(!!errors.slug)} placeholder={slugify(state.name)} />
                <button type="button" onClick={() => set('slug', slugify(state.name))} title="Generate from name" className="px-3 rounded-lg border border-border text-text-secondary hover:bg-bg-hover flex-shrink-0">
                  <Wand2 size={14} />
                </button>
              </div>
            </Field>
            <p className="text-[11px] text-text-muted mt-3">The product has no separate meta title/description: search engines use the name and short description.</p>
          </Card>

          <Card title="Internal admin note" description="Only visible to admins — never shown to the seller or customers.">
            <Field label="Note" htmlFor="f-note" error={errors.admin_note} counter={{ value: state.admin_note.length, max: 5000 }}>
              <textarea id="f-note" rows={6} value={state.admin_note} onChange={(e) => set('admin_note', e.target.value)} className={clsx(inputCls(!!errors.admin_note), 'resize-y')} placeholder="e.g. Replaced blurry cover, fixed Black/M stock after call with the seller." />
            </Field>
          </Card>
        </div>
      )}

      {tab === 'history' && <HistoryPanel history={payload.history} moderation={payload.moderation} />}

      {/* ── Sticky action bar ── */}
      <div className="sticky -bottom-6 z-30 -mx-6 mt-8 -mb-6 border-t border-border bg-bg-secondary/95 backdrop-blur shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        {progress !== null && (
          <div className="h-1 bg-border">
            <div className="h-full bg-[#198f41] transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 text-xs mr-auto min-w-0">
            {saving ? (
              <span className="flex items-center gap-1.5 text-text-secondary">
                <BrandLoader variant="inline" size={13} />
                {progress !== null && progress < 100 ? `Uploading images… ${progress}%` : 'Saving…'}
              </span>
            ) : dirty ? (
              <span className="flex items-center gap-1.5 text-[#fbbf24]"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Unsaved changes</span>
            ) : (
              <span className="flex items-center gap-1.5 text-text-muted"><CheckCircle size={13} className="text-[#34d399]" /> All changes saved</span>
            )}
          </div>

          <button
            type="button" onClick={() => setConfirmDiscard(true)} disabled={!dirty || !!saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-40"
          >
            <RotateCcw size={13} /> <span className="hidden sm:inline">Discard</span>
          </button>
          {(p.status === 'pending' || p.status === 'changes_requested' || p.status === 'disabled') && (
            <button
              type="button" onClick={() => setRejecting(true)} disabled={!!saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[#db142e]/50 text-[#f87171] hover:bg-[#db142e]/10 disabled:opacity-40"
            >
              <XCircle size={13} /> Reject
            </button>
          )}
          <button
            type="button" onClick={() => save(false)} disabled={!!saving}
            title="Save changes (Ctrl + S)" aria-keyshortcuts="Control+S"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-bg-hover border border-border-light text-text-primary hover:border-text-muted disabled:opacity-50"
          >
            {saving === 'save' ? <BrandLoader variant="inline" size={13} /> : <Save size={13} />} Save changes
          </button>
          {canApprove && (
            <button
              type="button" onClick={() => save(true)} disabled={!!saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#198f41] hover:bg-[#157a37] text-white disabled:opacity-50 shadow-lg shadow-[#198f41]/20"
            >
              {saving === 'approve' ? <BrandLoader variant="inline" size={13} /> : <CheckCircle size={13} />} Save &amp; Approve
            </button>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <Modal open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title="Discard changes?" size="sm">
        <p className="text-sm text-text-secondary mb-5">All unsaved edits, including images you added or replaced, will be lost.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmDiscard(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-hover">Keep editing</button>
          <button onClick={discard} className="px-4 py-2 rounded-lg bg-[#db142e] text-white text-sm font-semibold">Discard</button>
        </div>
      </Modal>

      <Modal open={!!conflict} onClose={() => setConflict(null)} title="Product changed meanwhile" size="sm">
        <p className="text-sm text-text-secondary mb-5">
          Someone (usually the seller) saved this product after you opened the editor. Reload to see their version — your edits will be lost — or overwrite it with yours.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => { setConflict(null); if (state) revokeNew(state); load() }} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-hover">Reload</button>
          <button onClick={() => { const a = conflict?.approve ?? false; setConflict(null); save(a, true) }} className="px-4 py-2 rounded-lg bg-[#db142e] text-white text-sm font-semibold">Overwrite</button>
        </div>
      </Modal>

      <ModerationActionModal
        open={rejecting}
        mode="reject"
        product={{ id: p.id, name: state.name || p.name }}
        onClose={() => setRejecting(false)}
        onDone={(message) => {
          setRejecting(false)
          toast(dirty ? `${message} Unsaved edits were discarded.` : message)
          setTimeout(() => leaveTo('/products'), 900)
        }}
      />
    </div>
  )
}
