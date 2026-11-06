'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { format } from 'date-fns'
import {
  BadgePercent, Plus, Search, X, Pause, Play, Pencil, Trash2, AlertTriangle, Zap, Tag, Store, RefreshCw,
} from 'lucide-react'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import BrandLoader from '@/components/brand/BrandLoader'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import { productEditorApi, type SellerOption } from '@/lib/api/productEditor'
import {
  promotionsApi, conflictsOf,
  type AdminPromotion, type PromotionFilters, type PromotionStats, type Paginated,
  type PromoProduct, type ProductPreview, type PromotionConflict, type PromotionPayload,
  type DiscountType, type PromotionType, type PromotionStatus,
} from '@/lib/api/promotions'
import { Toasts, type ToastMsg } from '../products/[id]/edit/_components/ui'
import { apiErrorMessage } from '../products/reviewUtils'

/**
 * Promotions: every promotion (sellers' and Choose'Tounsi's) with filters, and
 * admin promotions on any seller's products. Same pricing as the storefront,
 * cart and checkout (the live preview is computed by the server). The seller
 * pays the discount and is notified of every change.
 */

const inputCls = 'bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#db142e] transition-colors'
const RED = '#db142e'

const STATUS: Record<PromotionStatus, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30' },
  scheduled: { label: 'Scheduled', cls: 'bg-[#06b6d4]/15 text-[#67e8f9] border-[#06b6d4]/30' },
  paused:    { label: 'Paused',    cls: 'bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30' },
  expired:   { label: 'Ended',     cls: 'bg-white/5 text-text-muted border-border' },
}

const money = (n: number) => `${n.toFixed(3)} DT`
const fmtDate = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm')
/**
 * Dates are typed in Tunis time, whatever the admin's device timezone (AUDIT L-3).
 * ISO → value of a datetime-local input, as Tunis wall-clock time.
 */
const toLocalInput = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
/** datetime-local value (Tunis time) → ISO with Tunis's offset (UTC+1, no DST). */
const fromLocalInput = (v: string) => `${v.length === 16 ? `${v}:00` : v}+01:00`

export default function PromotionsPage() {
  const [filters, setFilters] = useState<PromotionFilters>({ page: 1 })
  const [search, setSearch]   = useState('')
  const [data, setData]       = useState<Paginated<AdminPromotion> | null>(null)
  const [stats, setStats]     = useState<PromotionStats | null>(null)
  const [sellers, setSellers] = useState<SellerOption[]>([])
  const [loading, setLoading] = useState(true)
  usePageLoading(loading && !data)
  const [error, setError]     = useState<string | null>(null)
  const [busy, setBusy]       = useState<string | null>(null)
  const [toasts, setToasts]   = useState<ToastMsg[]>([])
  const [form, setForm]       = useState<{ promo: AdminPromotion | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminPromotion | null>(null)
  const [resumeConflict, setResumeConflict] = useState<{ promo: AdminPromotion; conflicts: PromotionConflict[]; message: string } | null>(null)

  const toast = useCallback((message: string, type: ToastMsg['type'] = 'success') =>
    setToasts((t) => [...t, { id: Date.now() + Math.random(), message, type }]), [])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await promotionsApi.list(filters))
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load promotions.'))
    } finally {
      setLoading(false)
    }
  }, [filters])
  const loadStats = useCallback(() => { promotionsApi.stats().then(setStats).catch(() => {}) }, [])
  const reload = useCallback(() => { load(); loadStats() }, [load, loadStats])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { productEditorApi.sellerOptions('').then(setSellers).catch(() => {}) }, [])
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === (search || undefined) ? f : { ...f, search: search || undefined, page: 1 })), 350)
    return () => clearTimeout(t)
  }, [search])

  const setFilter = <K extends keyof PromotionFilters>(k: K, v: PromotionFilters[K]) => setFilters((f) => ({ ...f, [k]: v, page: 1 }))
  const activeFilters = !!(filters.seller_id || filters.status || filters.source || filters.type || filters.search)

  const run = async (key: string, fn: () => Promise<{ message: string }>) => {
    setBusy(key)
    try {
      toast((await fn()).message)
      reload()
    } catch (err) {
      toast(apiErrorMessage(err, 'Action failed.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const resume = async (p: AdminPromotion, replace = false) => {
    setBusy(`resume-${p.id}`)
    try {
      toast((await promotionsApi.resume(p.id, replace)).message)
      setResumeConflict(null)
      reload()
    } catch (err) {
      const c = conflictsOf(err)
      if (c) setResumeConflict({ promo: p, ...c })
      else toast(apiErrorMessage(err, 'Could not resume.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Toasts toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2"><BadgePercent size={18} /> Promotions</h1>
          <p className="text-xs text-text-muted max-w-2xl">
            Every promotion on the marketplace, from sellers and from Choose&apos;Tounsi. Admin promotions work exactly like seller ones:
            the seller is paid on the discounted price and is notified (bell + e-mail). One promotion per product at a time.
          </p>
        </div>
        <button type="button" onClick={() => setForm({ promo: null })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#db142e] hover:bg-[#b80f25] transition-colors">
          <Plus size={15} /> New promotion
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="Active now" value={stats?.active} tone="green" onClick={() => setFilter('status', 'active')} />
        <Kpi label="Scheduled" value={stats?.scheduled} onClick={() => setFilter('status', 'scheduled')} />
        <Kpi label="Paused" value={stats?.paused} onClick={() => setFilter('status', 'paused')} />
        <Kpi label="By Choose'Tounsi" value={stats?.admin} tone="red" onClick={() => setFilter('source', 'admin')} />
        <Kpi label="By sellers" value={stats?.seller} onClick={() => setFilter('source', 'seller')} />
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search promotion or product…" className={clsx(inputCls, 'w-full pl-8')} aria-label="Search" />
        </div>
        <select value={filters.seller_id ?? ''} onChange={(e) => setFilter('seller_id', e.target.value ? Number(e.target.value) : '')} className={inputCls} aria-label="Seller">
          <option value="">All sellers</option>
          {sellers.map((s) => <option key={s.id} value={s.id}>{s.shop_name || s.name}</option>)}
        </select>
        <select value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value as PromotionStatus | '')} className={inputCls} aria-label="Status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="paused">Paused</option>
          <option value="expired">Ended</option>
        </select>
        <select value={filters.source ?? ''} onChange={(e) => setFilter('source', e.target.value as PromotionFilters['source'])} className={inputCls} aria-label="Source">
          <option value="">All sources</option>
          <option value="admin">Choose&apos;Tounsi</option>
          <option value="seller">Seller</option>
        </select>
        <select value={filters.type ?? ''} onChange={(e) => setFilter('type', e.target.value as PromotionFilters['type'])} className={inputCls} aria-label="Type">
          <option value="">All types</option>
          <option value="discount">Discount</option>
          <option value="flash_sale">Flash sale</option>
        </select>
        {activeFilters && (
          <button type="button" onClick={() => { setSearch(''); setFilters({ page: 1 }) }} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-text-secondary hover:bg-bg-hover">
            <X size={13} /> Clear
          </button>
        )}
        <button type="button" onClick={reload} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-text-secondary hover:bg-bg-hover" aria-label="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* List */}
      {error && <p className="text-sm text-[#f87171] bg-[#db142e]/10 border border-[#db142e]/30 rounded-lg px-3 py-2">{error}</p>}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {loading && !data ? (
          <div className="py-16 flex justify-center"><BrandLoader variant="section" /></div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-16 text-center text-sm text-text-muted">No promotions match these filters.</div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {data.data.map((p) => (
                <PromotionRow key={p.id} promo={p} busy={busy}
                  onEdit={() => setForm({ promo: p })}
                  onPause={() => run(`pause-${p.id}`, () => promotionsApi.pause(p.id))}
                  onResume={() => resume(p)}
                  onDelete={() => setConfirmDelete(p)} />
              ))}
            </ul>
            <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total}
              from={data.from ?? 0} to={data.to ?? 0} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>

      {form && (
        <PromotionForm promo={form.promo} sellers={sellers}
          onClose={() => setForm(null)}
          onSaved={(msg) => { toast(msg); setForm(null); reload() }} />
      )}

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete promotion" size="sm">
        {confirmDelete && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Delete <b className="text-text-primary">{confirmDelete.name}</b> ({confirmDelete.discount_label}) on {confirmDelete.products_count} product(s) of {confirmDelete.seller.name}?
              Prices go back to normal immediately.{confirmDelete.order_items_count > 0 && ' Orders already use it: it will be ended (kept for their history), not deleted.'}
              {confirmDelete.display_status !== 'expired' && ' The seller is notified.'}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-bg-hover">Cancel</button>
              <button type="button" disabled={busy === `delete-${confirmDelete.id}`}
                onClick={async () => { const p = confirmDelete; await run(`delete-${p.id}`, () => promotionsApi.remove(p.id)); setConfirmDelete(null) }}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#db142e] hover:bg-[#b80f25] disabled:opacity-50">
                {busy === `delete-${confirmDelete.id}` ? <BrandLoader variant="inline" size={13} /> : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!resumeConflict} onClose={() => setResumeConflict(null)} title="Promotion conflict" size="md">
        {resumeConflict && (
          <ConflictPanel conflicts={resumeConflict.conflicts} message={resumeConflict.message} busy={busy === `resume-${resumeConflict.promo.id}`}
            onReplace={() => resume(resumeConflict.promo, true)} onCancel={() => setResumeConflict(null)} />
        )}
      </Modal>
    </div>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

function PromotionRow({ promo: p, busy, onEdit, onPause, onResume, onDelete }: {
  promo: AdminPromotion
  busy: string | null
  onEdit: () => void
  onPause: () => void
  onResume: () => void
  onDelete: () => void
}) {
  const st = STATUS[p.display_status] ?? STATUS.expired
  const ended = p.display_status === 'expired'
  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50'

  return (
    <li className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
      {/* Products */}
      <div className="flex -space-x-2 flex-shrink-0">
        {p.products.slice(0, 3).map((prod) => (
          <div key={prod.id} className="w-11 h-11 rounded-lg overflow-hidden border-2 border-bg-card bg-bg-primary" title={prod.name}>
            {prod.primary_image_url ? <img src={prod.primary_image_url} alt="" className="w-full h-full object-cover" /> : null}
          </div>
        ))}
        {p.products_count === 0 && <div className="w-11 h-11 rounded-lg border-2 border-dashed border-border" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-sm text-text-primary truncate max-w-[260px]">{p.name}</span>
          {p.source === 'admin'
            ? <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#db142e] text-white"><Tag size={10} /> Choose&apos;Tounsi</span>
            : <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/10 text-text-secondary"><Store size={10} /> Seller</span>}
          {p.type === 'flash_sale' && <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#f59e0b]/15 text-[#fbbf24]"><Zap size={10} /> Flash{p.per_customer_limit ? ` · max ${p.per_customer_limit}/customer` : ''}</span>}
          {p.funded_by === 'platform' && <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#8b5cf6]/15 text-[#c4b5fd]">Platform-funded</span>}
          <span className={clsx('text-[10px] font-black uppercase px-2 py-0.5 rounded-full border', st.cls)}>{st.label}</span>
        </div>
        <p className="text-xs text-text-muted mt-1">
          <b className="text-text-secondary">{p.seller.name}</b> · {p.products_count} product{p.products_count !== 1 ? 's' : ''}
          {p.products.length > 0 && <> · {p.products.slice(0, 2).map((x) => x.name).join(', ')}{p.products_count > 2 ? '…' : ''}</>}
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          {fmtDate(p.starts_at)} → {fmtDate(p.ends_at)}
          {p.order_items_count > 0 && <> · {p.order_items_count} order line{p.order_items_count !== 1 ? 's' : ''}</>}
          {p.flash_stock !== null && <> · {p.flash_stock_remaining}/{p.flash_stock} flash units left</>}
          {p.created_by_admin && <> · by {p.created_by_admin.name}</>}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xl font-black" style={{ color: RED }}>-{p.discount_label}</span>
        <div className="flex flex-wrap gap-1.5">
          {!ended && (
            <button type="button" onClick={onEdit} className={clsx(btn, 'border-border text-text-secondary hover:bg-bg-hover')} aria-label={`Edit ${p.name}`}>
              <Pencil size={12} /> Edit
            </button>
          )}
          {!ended && p.display_status !== 'paused' && (
            <button type="button" onClick={onPause} disabled={busy === `pause-${p.id}`} className={clsx(btn, 'border-[#f59e0b]/40 text-[#fbbf24] hover:bg-[#f59e0b]/10')}>
              {busy === `pause-${p.id}` ? <BrandLoader variant="inline" size={12} /> : <Pause size={12} />} Pause
            </button>
          )}
          {!ended && p.display_status === 'paused' && (
            <button type="button" onClick={onResume} disabled={busy === `resume-${p.id}`} className={clsx(btn, 'border-[#10b981]/40 text-[#34d399] hover:bg-[#10b981]/10')}>
              {busy === `resume-${p.id}` ? <BrandLoader variant="inline" size={12} /> : <Play size={12} />} Resume
            </button>
          )}
          <button type="button" onClick={onDelete} className={clsx(btn, 'border-[#db142e]/40 text-[#f87171] hover:bg-[#db142e]/10')} aria-label={`Delete ${p.name}`}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </li>
  )
}

// ── Create / edit form ──────────────────────────────────────────────────────

function PromotionForm({ promo, sellers, onClose, onSaved }: {
  promo: AdminPromotion | null
  sellers: SellerOption[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const isEdit = !!promo
  const started = !!promo && new Date(promo.starts_at) <= new Date()
  const now = new Date()
  const [name, setName]               = useState(promo?.name ?? '')
  const [type, setType]               = useState<PromotionType>(promo?.type ?? 'discount')
  const [discountType, setDiscountType] = useState<DiscountType>(promo?.discount_type ?? 'percentage')
  const [value, setValue]             = useState(promo ? String(promo.discount_value) : '50')
  const [startsAt, setStartsAt]       = useState(promo ? toLocalInput(promo.starts_at) : toLocalInput(now.toISOString()))
  const [endsAt, setEndsAt]           = useState(promo ? toLocalInput(promo.ends_at) : toLocalInput(new Date(now.getTime() + 7 * 86400000).toISOString()))
  const [flashStock, setFlashStock]   = useState(promo?.flash_stock ? String(promo.flash_stock) : '')
  // Flash sales: units per customer at the flash price (AUDIT L-4); who pays the discount (AUDIT M-8)
  const [perCustomer, setPerCustomer] = useState(promo?.per_customer_limit ? String(promo.per_customer_limit) : '2')
  const [fundedBy, setFundedBy]       = useState<'seller' | 'platform'>(promo?.funded_by === 'platform' ? 'platform' : 'seller')
  const canFund = !promo || promo.source === 'admin'
  const [selected, setSelected]       = useState<Array<{ id: number; name: string; seller: string; image: string | null }>>(
    promo?.products.map((p) => ({ id: p.id, name: p.name, seller: promo.seller.name, image: p.primary_image_url })) ?? [])
  const [query, setQuery]             = useState('')
  const [sellerFilter, setSellerFilter] = useState<number | ''>(promo?.seller.id ?? '')
  const [results, setResults]         = useState<PromoProduct[]>([])
  const [searching, setSearching]     = useState(false)
  const [preview, setPreview]         = useState<ProductPreview[]>([])
  const [errors, setErrors]           = useState<Record<string, string[]>>({})
  const [apiError, setApiError]       = useState('')
  const [conflict, setConflict]       = useState<{ message: string; conflicts: PromotionConflict[] } | null>(null)
  const [saving, setSaving]           = useState(false)

  const numValue = Number(value)
  const selectedIds = useMemo(() => selected.map((s) => s.id), [selected])

  // Product search across sellers (edit: only this promotion's seller)
  useEffect(() => {
    setSearching(true)
    const t = setTimeout(() => {
      promotionsApi.products(query, sellerFilter).then(setResults).catch(() => setResults([])).finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query, sellerFilter])

  // Live preview with the server's rules (30-day reference price, rounding)
  useEffect(() => {
    if (!selectedIds.length || !(numValue > 0)) { setPreview([]); return }
    const t = setTimeout(() => {
      promotionsApi.preview(selectedIds, discountType, numValue).then(setPreview).catch(() => setPreview([]))
    }, 250)
    return () => clearTimeout(t)
  }, [selectedIds, discountType, numValue])

  const add = (p: PromoProduct) => {
    if (selectedIds.includes(p.id)) return
    setSelected((s) => [...s, { id: p.id, name: p.name, seller: p.seller.name, image: p.primary_image_url }])
  }
  const remove = (id: number) => setSelected((s) => s.filter((x) => x.id !== id))

  const localErrors = (): Record<string, string[]> => {
    const e: Record<string, string[]> = {}
    if (!name.trim()) e.name = ['Required.']
    if (!(numValue > 0)) e.discount_value = ['Must be greater than 0.']
    else if (discountType === 'percentage' && numValue > 99) e.discount_value = ['Max 99%.']
    if (!startsAt || !endsAt) e.ends_at = ['Start and end are required.']
    else if (new Date(endsAt) <= new Date(startsAt)) e.ends_at = ['The end must be after the start.']
    if (!selected.length) e.product_ids = ['Choose at least one product.']
    if (preview.some((p) => !p.valid || p.variants.some((v) => !v.valid))) e.discount_value = ['The final price would be 0 DT or less for some products.']
    return e
  }

  const submit = async (replace = false) => {
    const e = localErrors()
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true); setApiError('')
    const payload: PromotionPayload = {
      name: name.trim(), type, discount_type: discountType, discount_value: numValue,
      starts_at: fromLocalInput(startsAt), ends_at: fromLocalInput(endsAt),
      product_ids: selectedIds,
      ...(type === 'flash_sale' && flashStock ? { flash_stock: Number(flashStock) } : {}),
      ...(type === 'flash_sale' ? { per_customer_limit: Math.max(1, Number(perCustomer) || 2) } : {}),
      ...(canFund ? { funded_by: fundedBy } : {}),
      ...(replace ? { replace_conflicts: true } : {}),
    }
    try {
      const res = isEdit ? await promotionsApi.update(promo!.id, payload) : await promotionsApi.create(payload)
      onSaved(res.message)
    } catch (err) {
      const c = conflictsOf(err)
      if (c) { setConflict(c); return }
      const data = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data
      if (data?.errors) setErrors(data.errors)
      setApiError(apiErrorMessage(err, 'Could not save the promotion.'))
    } finally {
      setSaving(false)
    }
  }

  const fieldErr = (k: string) => errors[k]?.length ? <p className="text-xs text-[#f87171] mt-1">{errors[k].join(' ')}</p> : null
  const label = 'block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1'

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit promotion · ${promo!.seller.name}` : "New Choose'Tounsi promotion"} size="xl">
      {conflict ? (
        <ConflictPanel conflicts={conflict.conflicts} message={conflict.message} busy={saving}
          onReplace={() => { setConflict(null); submit(true) }} onCancel={() => setConflict(null)} />
      ) : (
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {apiError && <p className="text-sm text-[#f87171] bg-[#db142e]/10 border border-[#db142e]/30 rounded-lg px-3 py-2">{apiError}</p>}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="pf-name">Name (shown to the seller)</label>
            <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className={clsx(inputCls, 'w-full')} placeholder="e.g. Soldes d'hiver Choose'Tounsi" maxLength={255} />
            {fieldErr('name')}
          </div>
          <div>
            <label className={label} htmlFor="pf-type">Type</label>
            <select id="pf-type" value={type} disabled={started} onChange={(e) => setType(e.target.value as PromotionType)} className={clsx(inputCls, 'w-full')}>
              <option value="discount">Discount</option>
              <option value="flash_sale">Flash sale (countdown)</option>
            </select>
          </div>
          <div>
            <label className={label}>Discount</label>
            <div className="flex gap-2">
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)} className={inputCls} aria-label="Discount type">
                <option value="percentage">%</option>
                <option value="fixed">DT</option>
              </select>
              <input type="number" min={0} step={discountType === 'percentage' ? 1 : 0.001} max={discountType === 'percentage' ? 99 : undefined}
                value={value} onChange={(e) => setValue(e.target.value)} className={clsx(inputCls, 'flex-1')} aria-label="Discount value" />
            </div>
            {fieldErr('discount_value')}
          </div>
          <div>
            <label className={label} htmlFor="pf-start">Starts</label>
            <input id="pf-start" type="datetime-local" value={startsAt} disabled={started} onChange={(e) => setStartsAt(e.target.value)} className={clsx(inputCls, 'w-full')} />
            {fieldErr('starts_at')}
          </div>
          <div>
            <label className={label} htmlFor="pf-end">Ends</label>
            <input id="pf-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={clsx(inputCls, 'w-full')} />
            {fieldErr('ends_at')}
          </div>
          {type === 'flash_sale' && (
            <div>
              <label className={label} htmlFor="pf-stock">Flash stock limit (optional)</label>
              <input id="pf-stock" type="number" min={1} value={flashStock} onChange={(e) => setFlashStock(e.target.value)} className={clsx(inputCls, 'w-full')} placeholder="Unlimited" />
            </div>
          )}
          {type === 'flash_sale' && (
            <div>
              <label className={label} htmlFor="pf-per-customer">Max per customer</label>
              <input id="pf-per-customer" type="number" min={1} max={100} value={perCustomer} onChange={(e) => setPerCustomer(e.target.value)} className={clsx(inputCls, 'w-full')} />
              <p className="text-[11px] text-text-muted mt-1">Units one customer (account, or phone for guests) can buy at the flash price.</p>
              {fieldErr('per_customer_limit')}
            </div>
          )}
          {canFund && (
            <div>
              <label className={label} htmlFor="pf-funded">Who pays the discount</label>
              <select id="pf-funded" value={fundedBy} onChange={(e) => setFundedBy(e.target.value as 'seller' | 'platform')} className={clsx(inputCls, 'w-full')}>
                <option value="seller">Seller (commission on the final price)</option>
                <option value="platform">Choose&apos;Tounsi (seller paid on the original price)</option>
              </select>
              <p className="text-[11px] text-text-muted mt-1">
                {fundedBy === 'platform'
                  ? 'The seller is paid as if sold at the original price; the platform absorbs the discount. Applies to orders placed from now on.'
                  : 'The seller receives the final price minus commission. Applies to orders placed from now on.'}
              </p>
              {fieldErr('funded_by')}
            </div>
          )}
        </div>

        {/* Products */}
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="bg-bg-primary/50 border border-border rounded-xl p-3">
            <p className={label}>Find products {isEdit ? `(${promo!.seller.name})` : '(all sellers)'}</p>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, SKU or #id…" className={clsx(inputCls, 'w-full pl-8')} aria-label="Search products" />
              </div>
              {!isEdit && (
                <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value ? Number(e.target.value) : '')} className={clsx(inputCls, 'max-w-[150px]')} aria-label="Seller">
                  <option value="">All sellers</option>
                  {sellers.map((s) => <option key={s.id} value={s.id}>{s.shop_name || s.name}</option>)}
                </select>
              )}
            </div>
            <ul className="max-h-72 overflow-y-auto divide-y divide-border">
              {searching && results.length === 0 && <li className="py-6 flex justify-center"><BrandLoader variant="inline" size={16} /></li>}
              {!searching && results.length === 0 && <li className="py-6 text-center text-xs text-text-muted">No active products found.</li>}
              {results.map((r) => {
                const picked = selectedIds.includes(r.id)
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => add(r)} disabled={picked}
                      className="w-full flex items-center gap-2.5 py-2 px-1 text-left hover:bg-bg-hover rounded-lg disabled:opacity-40">
                      <div className="w-9 h-9 rounded-md overflow-hidden bg-bg-primary flex-shrink-0">
                        {r.primary_image_url && <img src={r.primary_image_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-text-primary truncate">{r.name}</p>
                        <p className="text-[11px] text-text-muted truncate">
                          {r.seller.name} · {money(r.price)}{r.variants_count > 0 && ` · ${r.variants_count} variants`}
                        </p>
                        {r.current_promotion && (
                          <p className="text-[11px] text-[#fbbf24] truncate flex items-center gap-1">
                            <AlertTriangle size={10} /> In {r.current_promotion.source === 'admin' ? "a Choose'Tounsi" : 'a seller'} promotion: {r.current_promotion.name}
                          </p>
                        )}
                      </div>
                      {!picked && <Plus size={14} className="text-text-muted flex-shrink-0" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="bg-bg-primary/50 border border-border rounded-xl p-3">
            <p className={label}>Selected ({selected.length}) · live price</p>
            {fieldErr('product_ids')}
            {selected.length === 0 && <p className="py-6 text-center text-xs text-text-muted">Pick products on the left.</p>}
            <ul className="max-h-72 overflow-y-auto divide-y divide-border">
              {selected.map((s) => {
                const pv = preview.find((p) => p.product_id === s.id)
                return (
                  <li key={s.id} className="py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-10 h-10 rounded-md overflow-hidden bg-bg-primary flex-shrink-0">
                        {s.image && <img src={s.image} alt="" className="w-full h-full object-cover" />}
                        {pv && pv.valid && pv.discount_percent > 0 && (
                          <span className="absolute top-0 left-0 text-[9px] font-black text-white px-1 rounded-br" style={{ background: RED }}>-{pv.discount_percent}%</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-text-primary truncate">{s.name}</p>
                        <p className="text-[11px] text-text-muted truncate">{s.seller}</p>
                      </div>
                      <PriceCell row={pv} />
                      <button type="button" onClick={() => remove(s.id)} className="p-1 rounded hover:bg-bg-hover text-text-muted" aria-label={`Remove ${s.name}`}><X size={13} /></button>
                    </div>
                    {pv && pv.variants.length > 0 && (
                      <ul className="mt-1 ml-12 space-y-0.5">
                        {pv.variants.map((v) => (
                          <li key={v.variant_id} className="flex items-center gap-2 text-[11px]">
                            <span className="flex-1 text-text-muted truncate">{v.label || `Variant #${v.variant_id}`}</span>
                            <PriceCell row={v} small />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
            {selected.length > 0 && (
              <p className="text-[11px] text-text-muted mt-2">
                Crossed-out price = lowest price of the last 30 days (anti fake-discount), same as the storefront. Shipping is never discounted.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <p className="text-[11px] text-text-muted">The seller is paid on the discounted price and gets a notification + e-mail.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-bg-hover">Cancel</button>
            <button type="button" onClick={() => submit()} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#db142e] hover:bg-[#b80f25] disabled:opacity-50">
              {saving && <BrandLoader variant="inline" size={13} />} {isEdit ? 'Save changes' : 'Create promotion'}
            </button>
          </div>
        </div>
      </div>
      )}
    </Modal>
  )
}

function PriceCell({ row, small = false }: { row?: { original_price: number; final_price: number; discount_percent: number; valid: boolean }; small?: boolean }) {
  if (!row) return <span className="text-[11px] text-text-muted">…</span>
  if (!row.valid) return <span className="text-[11px] font-bold text-[#f87171]">0 DT: not allowed</span>
  return (
    <span className={clsx('text-right whitespace-nowrap', small ? 'text-[11px]' : 'text-xs')}>
      <s className="text-text-muted mr-1.5">{money(row.original_price)}</s>
      <b style={{ color: '#f87171' }}>{money(row.final_price)}</b>
      <span className="ml-1.5 font-black" style={{ color: '#f87171' }}>-{row.discount_percent}%</span>
    </span>
  )
}

function ConflictPanel({ conflicts, message, busy, onReplace, onCancel }: {
  conflicts: PromotionConflict[]
  message: string
  busy: boolean
  onReplace: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 p-3 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30">
        <AlertTriangle size={18} className="text-[#fbbf24] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-text-secondary">
          <p className="font-bold text-text-primary">A product can only have one promotion at a time.</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {conflicts.map((c) => (
          <li key={c.id} className="p-3 rounded-lg border border-border bg-bg-primary/50 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-text-primary">{c.name}</b>
              <span className={clsx('text-[10px] font-black uppercase px-2 py-0.5 rounded-full', c.source === 'admin' ? 'bg-[#db142e] text-white' : 'bg-white/10 text-text-secondary')}>
                {c.source === 'admin' ? "Choose'Tounsi" : 'Seller'}
              </span>
              <span className="font-black" style={{ color: '#f87171' }}>-{c.discount_type === 'percentage' ? `${c.discount_value}%` : money(c.discount_value)}</span>
              <span className="text-text-muted">{fmtDate(c.starts_at)} → {fmtDate(c.ends_at)}</span>
            </div>
            <p className="text-text-muted mt-1">Products: {c.products.map((p) => p.name).join(', ')}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">
        Replace: these products leave the other promotion (it keeps its other products; it ends if none are left) and its seller is notified.
        Promotions never stack.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-bg-hover">Cancel</button>
        <button type="button" onClick={onReplace} disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#db142e] hover:bg-[#b80f25] disabled:opacity-50">
          {busy && <BrandLoader variant="inline" size={13} />} Replace it
        </button>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone, onClick }: { label: string; value?: number; tone?: 'red' | 'green'; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="bg-bg-card border border-border rounded-xl px-4 py-3 text-left hover:border-border-light transition-colors">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className={clsx('text-xl font-black mt-0.5', tone === 'red' ? 'text-[#f87171]' : tone === 'green' ? 'text-[#34d399]' : 'text-text-primary')}>
        {value ?? '—'}
      </p>
    </button>
  )
}
