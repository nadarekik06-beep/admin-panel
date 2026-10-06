'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { format, formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle, ChevronDown, Edit2, ExternalLink, EyeOff, Filter, History, RotateCcw, Search, ShieldAlert, Store, X,
} from 'lucide-react'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { productsApi } from '@/lib/api/products'
import {
  productChangesApi, type ChangeFilters, type ChangeGroup, type ChangeItem, type ChangeSet, type ChangeStats,
  type SensitiveReason,
} from '@/lib/api/productChanges'
import { Toasts, type ToastMsg } from '../products/[id]/edit/_components/ui'
import { apiErrorMessage } from '../products/reviewUtils'

import BrandLoader from '@/components/brand/BrandLoader'
import { usePageLoading } from '@/components/brand/NavigationLoader'
const GROUP_LABEL: Record<ChangeGroup, string> = {
  text: 'Text', price: 'Price', stock: 'Stock', category: 'Category', images: 'Images',
  variants: 'Variants', attributes: 'Details', settings: 'Settings',
}

const REASON_LABEL: Record<SensitiveReason, string> = {
  name_changed:     'Name changed',
  category_changed: 'Category changed',
  images_changed:   'Images changed',
  price_jump:       'Price ±50%+',
}

const SOURCE_LABEL: Record<string, string> = {
  seller_edit: 'Product form', restock: 'Restock', images: 'Image action', admin_revert: 'Admin revert',
}

const inputCls = 'bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#db142e] transition-colors'

export default function ProductChangesPage() {
  const [filters, setFilters] = useState<ChangeFilters>({ page: 1 })
  const [search, setSearch]   = useState('')
  const [data, setData]       = useState<Awaited<ReturnType<typeof productChangesApi.list>> | null>(null)
  const [pinned, setPinned]   = useState<ChangeSet | null>(null)     // opened from a notification (?set=)
  const [stats, setStats]     = useState<ChangeStats | null>(null)
  const [loading, setLoading] = useState(true)
  // holds the navigation loader until the first load is done
  usePageLoading(loading)
  const [error, setError]     = useState<string | null>(null)
  const [open, setOpen]       = useState<Set<number>>(new Set())
  const [busy, setBusy]       = useState<string | null>(null)
  const [toasts, setToasts]   = useState<ToastMsg[]>([])
  const [conflict, setConflict] = useState<{ set: ChangeSet; itemIds?: number[]; details: string[] } | null>(null)
  const [deactivate, setDeactivate] = useState<ChangeSet | null>(null)
  const highlightRef = useRef<HTMLDivElement | null>(null)

  const toast = useCallback((message: string, type: ToastMsg['type'] = 'success') =>
    setToasts((t) => [...t, { id: Date.now() + Math.random(), message, type }]), [])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await productChangesApi.list(filters))
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load product changes.'))
    } finally {
      setLoading(false)
    }
  }, [filters])

  const loadStats = useCallback(() => { productChangesApi.stats().then(setStats).catch(() => {}) }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === (search || undefined) ? f : { ...f, search: search || undefined, page: 1 })), 350)
    return () => clearTimeout(t)
  }, [search])

  // Deep link from an admin notification: /product-changes?set=123
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('set'))
    if (!id) return
    productChangesApi.get(id).then((s) => {
      setPinned(s)
      setOpen((o) => new Set(o).add(s.id))
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }).catch(() => toast('That change no longer exists.', 'error'))
  }, [toast])

  const setFilter = <K extends keyof ChangeFilters>(k: K, v: ChangeFilters[K]) => setFilters((f) => ({ ...f, [k]: v, page: 1 }))
  const activeFilters = !!(filters.seller_id || filters.group || filters.sensitive || filters.source || filters.from || filters.to || filters.search)

  const replaceSet = (s: ChangeSet) => {
    setData((d) => (d ? { ...d, data: d.data.map((x) => (x.id === s.id ? s : x)) } : d))
    setPinned((p) => (p && p.id === s.id ? s : p))
  }

  const revert = async (set: ChangeSet, itemIds?: number[], force = false) => {
    const key = `revert-${set.id}-${itemIds?.join(',') ?? 'all'}`
    setBusy(key)
    try {
      const res = await productChangesApi.revert(set.id, itemIds, force)
      replaceSet(res.data.set)
      toast(res.message)
      setConflict(null)
      loadStats()
      load()   // other cards of the same product show its current name/state
    } catch (err) {
      const r = (err as { response?: { status?: number; data?: { message?: string; data?: { conflicts?: Record<string, string>; set?: ChangeSet } } } }).response
      if (r?.status === 409) {
        const details = Object.entries(r.data?.data?.conflicts ?? {}).map(([itemId, why]) => {
          const item = set.items.find((i) => i.id === Number(itemId))
          return `${item?.label ?? 'Field'}: ${why}`
        })
        setConflict({ set, itemIds, details })
      } else {
        toast(apiErrorMessage(err, 'Revert failed.'), 'error')
      }
    } finally {
      setBusy(null)
    }
  }

  const doDeactivate = async () => {
    if (!deactivate?.product) return
    setBusy(`deactivate-${deactivate.id}`)
    try {
      await productsApi.disable(deactivate.product.id)
      const pid = deactivate.product.id
      const patch = (s: ChangeSet) => (s.product?.id === pid ? { ...s, product: { ...s.product, is_active: false, status: 'disabled' } } : s)
      setData((d) => (d ? { ...d, data: d.data.map(patch) } : d))
      setPinned((p) => (p ? patch(p) : p))
      toast('Product deactivated — hidden from the storefront.')
      setDeactivate(null)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not deactivate the product.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const list = (data?.data ?? []).filter((s) => s.id !== pinned?.id)

  return (
    <div className="space-y-4">
      <Toasts toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-bold text-text-primary flex items-center gap-2"><History size={18} /> Product changes</h1>
        <p className="text-xs text-text-muted">
          Sellers edit their products directly — every save is logged here. Sensitive changes are flagged so you can check them quickly; stock-only saves are logged without notifying you.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Today" value={stats?.today} />
        <Kpi label="Last 7 days" value={stats?.last_7_days} />
        <Kpi label="Sensitive (7d)" value={stats?.sensitive_7d} tone="red" onClick={() => setFilter('sensitive', true)} />
        <Kpi label="Price changes (7d)" value={stats?.price_7d} onClick={() => setFilter('group', 'price')} />
        <Kpi label="Reverted (7d)" value={stats?.reverted_7d} tone="green" />
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product…" className={clsx(inputCls, 'w-full pl-8')} aria-label="Search product" />
        </div>
        <select value={filters.seller_id ?? ''} onChange={(e) => setFilter('seller_id', e.target.value ? Number(e.target.value) : '')} className={inputCls} aria-label="Seller">
          <option value="">All sellers</option>
          {stats?.sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.group ?? ''} onChange={(e) => setFilter('group', e.target.value as ChangeGroup | '')} className={inputCls} aria-label="Field type">
          <option value="">All field types</option>
          {Object.entries(GROUP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filters.source ?? ''} onChange={(e) => setFilter('source', e.target.value as ChangeFilters['source'])} className={inputCls} aria-label="Source">
          <option value="">Seller edits</option>
          <option value="seller_edit">Product form</option>
          <option value="restock">Restock</option>
          <option value="images">Image actions</option>
          <option value="admin_revert">Admin reverts</option>
        </select>
        <input type="date" value={filters.from ?? ''} onChange={(e) => setFilter('from', e.target.value || undefined)} className={inputCls} aria-label="From date" />
        <input type="date" value={filters.to ?? ''} onChange={(e) => setFilter('to', e.target.value || undefined)} className={inputCls} aria-label="To date" />
        <button
          type="button" onClick={() => setFilter('sensitive', !filters.sensitive)} aria-pressed={!!filters.sensitive}
          className={clsx('inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors',
            filters.sensitive ? 'bg-[#db142e]/15 border-[#db142e]/50 text-[#f87171]' : 'border-border text-text-secondary hover:bg-bg-hover')}
        >
          <ShieldAlert size={13} /> Sensitive only
        </button>
        {activeFilters && (
          <button type="button" onClick={() => { setSearch(''); setFilters({ page: 1 }) }} className="inline-flex items-center gap-1 px-2 py-2 text-xs text-text-muted hover:text-text-primary">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Pinned (from a notification) */}
      {pinned && (
        <div ref={highlightRef}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#f87171] mb-1.5">From your notification</p>
          <ChangeCard
            set={pinned} highlighted open={open.has(pinned.id)} busy={busy}
            onToggle={() => setOpen((o) => toggle(o, pinned.id))}
            onRevert={revert} onDeactivate={setDeactivate}
          />
        </div>
      )}

      {/* List */}
      {error ? (
        <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-[#f87171] mb-3">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-[#db142e] text-white text-sm font-semibold">Retry</button>
        </div>
      ) : loading && !data ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 bg-bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : list.length === 0 && !pinned ? (
        <div className="bg-bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <Filter size={20} className="mx-auto text-text-muted mb-2" />
          <p className="text-sm text-text-secondary">{activeFilters ? 'No changes match these filters.' : 'No seller edits yet.'}</p>
        </div>
      ) : (
        <div className={clsx('space-y-2', loading && 'opacity-60 transition-opacity')}>
          {list.map((s) => (
            <ChangeCard
              key={s.id} set={s} open={open.has(s.id)} busy={busy}
              onToggle={() => setOpen((o) => toggle(o, s.id))}
              onRevert={revert} onDeactivate={setDeactivate}
            />
          ))}
        </div>
      )}

      {data && data.last_page > 1 && (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} from={data.from} to={data.to}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
      )}

      {/* Revert conflict */}
      <Modal open={!!conflict} onClose={() => setConflict(null)} title="Changed again since" size="sm">
        <p className="text-sm text-text-secondary mb-3">The seller edited these values again after this change. Reverting now would also undo the newer edit.</p>
        <ul className="text-xs text-text-muted space-y-1 mb-5 list-disc pl-4">{conflict?.details.map((d) => <li key={d}>{d}</li>)}</ul>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConflict(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-hover">Keep current values</button>
          <button onClick={() => conflict && revert(conflict.set, conflict.itemIds, true)} disabled={!!busy}
            className="px-4 py-2 rounded-lg bg-[#db142e] text-white text-sm font-semibold disabled:opacity-60">Revert anyway</button>
        </div>
      </Modal>

      {/* Deactivate */}
      <Modal open={!!deactivate} onClose={() => setDeactivate(null)} title="Deactivate product?" size="sm">
        <p className="text-sm text-text-secondary mb-5">
          “{deactivate?.product?.name}” will be hidden from the storefront until you re-approve it. The seller keeps their product and edits.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeactivate(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-hover">Cancel</button>
          <button onClick={doDeactivate} disabled={!!busy} className="px-4 py-2 rounded-lg bg-[#db142e] text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2">
            {busy?.startsWith('deactivate') && <BrandLoader variant="inline" size={13} />} Deactivate
          </button>
        </div>
      </Modal>
    </div>
  )
}

const toggle = (s: Set<number>, id: number) => {
  const n = new Set(s)
  if (n.has(id)) n.delete(id)
  else n.add(id)
  return n
}

function Kpi({ label, value, tone, onClick }: { label: string; value?: number; tone?: 'red' | 'green'; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={clsx('bg-bg-card border border-border rounded-xl px-4 py-3 text-left', onClick && 'hover:border-border-light transition-colors')}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className={clsx('text-xl font-black mt-0.5', tone === 'red' ? 'text-[#f87171]' : tone === 'green' ? 'text-[#34d399]' : 'text-text-primary')}>
        {value ?? '—'}
      </p>
    </Tag>
  )
}

function ChangeCard({ set, open, busy, highlighted, onToggle, onRevert, onDeactivate }: {
  set: ChangeSet
  open: boolean
  busy: string | null
  highlighted?: boolean
  onToggle: () => void
  onRevert: (set: ChangeSet, itemIds?: number[], force?: boolean) => void
  onDeactivate: (set: ChangeSet) => void
}) {
  const p = set.product
  const pending = set.items.filter((i) => i.revertible && !i.reverted_at)
  const created = new Date(set.created_at)

  return (
    <div className={clsx(
      'bg-bg-card border rounded-xl overflow-hidden transition-colors',
      highlighted ? 'border-[#db142e]/60 ring-1 ring-[#db142e]/30' : set.is_sensitive ? 'border-[#db142e]/35' : 'border-border',
    )}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-start gap-3 p-3 sm:p-4 text-left hover:bg-bg-hover/40 transition-colors">
        <div className="w-11 h-11 rounded-lg overflow-hidden bg-bg-hover flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p?.primary_image_url && <img src={p.primary_image_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-text-primary truncate max-w-[280px]">{p?.name ?? 'Deleted product'}</span>
            {set.is_sensitive && set.sensitive_reasons.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#db142e]/15 text-[#f87171] border border-[#db142e]/40">
                <AlertTriangle size={9} /> {REASON_LABEL[r] ?? r}
              </span>
            ))}
            {set.stock_only && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-bg-hover text-text-muted border border-border">Stock only · not notified</span>}
            {set.reverted_at && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#198f41]/15 text-[#34d399] border border-[#198f41]/40">Reverted</span>}
            {p && !p.is_active && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#fbbf24] border border-[#f59e0b]/30">Inactive</span>}
          </div>
          <p className="text-sm text-text-secondary mt-0.5 truncate">{set.summary}</p>
          <p className="text-[11px] text-text-muted mt-0.5 flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-1"><Store size={10} /> {set.seller?.name ?? '—'}</span>
            <span title={format(created, 'PPpp')}>{formatDistanceToNow(created, { addSuffix: true })}</span>
            <span>· {SOURCE_LABEL[set.source] ?? set.source}</span>
          </p>
        </div>
        <ChevronDown size={16} className={clsx('text-text-muted mt-1 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-text-muted text-left bg-bg-primary/40">
                  <th className="font-bold px-4 py-2 w-[26%]">Field</th>
                  <th className="font-bold px-4 py-2">Before</th>
                  <th className="font-bold px-4 py-2">After</th>
                  <th className="font-bold px-4 py-2 w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {set.items.map((i) => <ItemRow key={i.id} item={i} set={set} busy={busy} onRevert={onRevert} />)}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-border bg-bg-primary/30">
            {pending.length > 0 && (
              <button type="button" onClick={() => onRevert(set)} disabled={!!busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[#db142e]/50 text-[#f87171] hover:bg-[#db142e]/10 disabled:opacity-50">
                {busy === `revert-${set.id}-all` ? <BrandLoader variant="inline" size={12} /> : <RotateCcw size={12} />}
                Revert all{pending.length > 1 ? ` (${pending.length})` : ''}
              </button>
            )}
            {p && p.is_active && (
              <button type="button" onClick={() => onDeactivate(set)} disabled={!!busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-50">
                <EyeOff size={12} /> Deactivate product
              </button>
            )}
            {p && (
              <>
                <Link href={`/products/${p.id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#198f41] hover:bg-[#157a37] text-white">
                  <Edit2 size={12} /> Open in editor
                </Link>
                <Link href={`/products/${p.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary">
                  Review page
                </Link>
                {p.status === 'approved' && (
                  <a href={p.storefront_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-text-muted hover:text-text-primary">
                    <ExternalLink size={11} /> Storefront
                  </a>
                )}
              </>
            )}
            {set.reverted_by && (
              <span className="ml-auto text-[11px] text-text-muted">Reverted by {set.reverted_by.name}{set.reverted_at && ` · ${format(new Date(set.reverted_at), 'MMM d, HH:mm')}`}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Removed images are deleted from storage, so old thumbnails may 404. */
function Thumb({ src, faded }: { src: string; faded: boolean }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <span title="File deleted" className="w-10 h-10 rounded border border-dashed border-border flex items-center justify-center text-[8px] font-bold uppercase text-text-muted">
        deleted
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setBroken(true)}
      className={clsx('w-10 h-10 rounded object-cover border', faded ? 'border-border opacity-70' : 'border-border-light')} />
  )
}

function ItemRow({ item, set, busy, onRevert }: {
  item: ChangeItem; set: ChangeSet; busy: string | null
  onRevert: (set: ChangeSet, itemIds?: number[], force?: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const key = `revert-${set.id}-${item.id}`

  const value = (text: string | null, images: string[] | null, tone: 'old' | 'new') => {
    if (images) {
      return images.length === 0 ? <span className="text-text-muted">none</span> : (
        <div className="flex flex-wrap gap-1">
          {images.slice(0, 8).map((src) => <Thumb key={src} src={src} faded={tone === 'old'} />)}
        </div>
      )
    }
    const long = item.is_long_text && (text?.length ?? 0) > 140
    return (
      <span className={clsx('break-words whitespace-pre-line', tone === 'old' ? 'text-text-muted line-through decoration-[#db142e]/60' : 'text-text-primary')}>
        {long && !expanded ? `${text!.slice(0, 140)}…` : text}
      </span>
    )
  }

  return (
    <tr className={clsx('border-t border-border align-top', item.reverted_at && 'opacity-50')}>
      <td className="px-4 py-2.5">
        <span className="text-text-secondary">{item.label}</span>
        {item.is_sensitive && <AlertTriangle size={11} className="inline ml-1.5 text-[#f87171]" aria-label="Sensitive" />}
        <span className="block text-[10px] text-text-muted">{GROUP_LABEL[item.group]}</span>
        {item.is_long_text && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-[10px] text-[#f87171] hover:underline">
            {expanded ? 'Collapse' : 'Show full text'}
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 max-w-[320px]">{value(item.old_display, item.old_images, 'old')}</td>
      <td className="px-4 py-2.5 max-w-[320px]">{value(item.new_display, item.new_images, 'new')}</td>
      <td className="px-4 py-2.5 text-right">
        {item.reverted_at ? (
          <span className="text-[11px] text-[#34d399] font-semibold">Reverted</span>
        ) : item.revertible ? (
          <button type="button" onClick={() => onRevert(set, [item.id])} disabled={!!busy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-text-secondary border border-border hover:text-[#f87171] hover:border-[#db142e]/50 disabled:opacity-50">
            {busy === key ? <BrandLoader variant="inline" size={11} /> : <RotateCcw size={11} />} Revert
          </button>
        ) : (
          <span className="text-[10px] text-text-muted" title="Fix images and added/removed variants in the product editor">Use editor</span>
        )}
      </td>
    </tr>
  )
}
