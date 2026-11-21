'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { BadgePercent, Search, Pencil, StopCircle, Trash2, History, AlertTriangle, Plus, Store, ImageIcon } from 'lucide-react'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import { productEditorApi, type SellerOption } from '@/lib/api/productEditor'
import {
  specialCommissionsApi, SOURCE_LABEL,
  type AuditEntry, type CommissionPreviewRow, type OfferInput, type OverrideStatus, type OverrideType,
  type SellerProductRow, type SpecialCommission, type SpecialCommissionList,
} from '@/lib/api/specialCommissions'
import { Toasts, type ToastMsg } from '../products/[id]/edit/_components/ui'
import { apiErrorMessage, resolveImageUrl } from '../products/reviewUtils'

/**
 * Special Commissions: a deliberate, temporary commission on chosen products of a seller
 * (incentive / special offer). Every figure on this page is computed by the backend
 * (CommissionService) at the product's CURRENT price: nothing is calculated here.
 *
 * Saving only affects orders placed afterwards: existing orders keep their own commission.
 */

const inputCls = 'bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#db142e] transition-colors'
const RED = '#db142e'
const GREEN = '#198f41'

const STATUS: Record<OverrideStatus, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30' },
  scheduled: { label: 'Scheduled', cls: 'bg-[#06b6d4]/15 text-[#67e8f9] border-[#06b6d4]/30' },
  expired:   { label: 'Expired',   cls: 'bg-white/5 text-text-muted border-border' },
  ended:     { label: 'Ended',     cls: 'bg-white/5 text-text-muted border-border' },
}

/** 48px rounded cover thumbnail; a neutral icon when the product has no image (layout never breaks). */
function Thumb({ src, alt }: { src: string | null | undefined; alt: string }) {
  const [failed, setFailed] = useState(false)
  const url = resolveImageUrl(src)
  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden bg-bg-hover flex-shrink-0 flex items-center justify-center text-text-muted">
      {url && !failed
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt={alt} className="w-full h-full object-cover" onError={() => setFailed(true)} />
        : <ImageIcon size={18} />}
    </div>
  )
}

const money = (n: number) => `${n.toFixed(3)} DT`
const pct = (n: number) => `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`
const fmtDate = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm')

/** Dates are typed in Tunis time, whatever the admin's device timezone. */
const toLocalInput = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
const fromLocalInput = (v: string) => `${v.length === 16 ? `${v}:00` : v}+01:00`

const WARNING_TEXT: Record<string, string> = {
  below_floor: 'Below the platform floor',
  zero_commission: '0% commission: the platform earns nothing on this product',
  clamped_to_zero: 'The reduction is larger than the normal rate: capped at 0%',
}

export default function SpecialCommissionsPage() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const toast = useCallback((message: string, type: ToastMsg['type'] = 'success') =>
    setToasts((t) => [...t, { id: Date.now() + Math.random(), message, type }]), [])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // ── list ──
  const [status, setStatus] = useState<'' | 'active' | 'scheduled' | 'expired'>('')
  const [sellerFilter, setSellerFilter] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<SpecialCommissionList | null>(null)
  const [loading, setLoading] = useState(true)
  usePageLoading(loading && !list)
  const [sellers, setSellers] = useState<SellerOption[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setList(await specialCommissionsApi.list({
        status: status || undefined, seller_id: sellerFilter || undefined, q: q || undefined, page,
      }))
    } catch (err) {
      toast(apiErrorMessage(err, 'Failed to load special commissions.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [status, sellerFilter, q, page, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { productEditorApi.sellerOptions('').then(setSellers).catch(() => {}) }, [])
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  // ── dialogs ──
  const [edit, setEdit] = useState<SpecialCommission | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'end' | 'delete'; row: SpecialCommission } | null>(null)
  const [history, setHistory] = useState<{ title: string; entries: AuditEntry[] | null } | null>(null)
  const [busy, setBusy] = useState(false)

  const openHistory = async (row: SpecialCommission) => {
    setHistory({ title: `${row.product_name ?? `Product #${row.product_id}`} — audit log`, entries: null })
    try {
      setHistory({ title: `${row.product_name ?? `Product #${row.product_id}`} — audit log`, entries: await specialCommissionsApi.logs({ product_id: row.product_id }) })
    } catch (err) {
      setHistory(null)
      toast(apiErrorMessage(err, 'Could not load the audit log.'), 'error')
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      const r = confirm.kind === 'end' ? await specialCommissionsApi.end(confirm.row.id) : await specialCommissionsApi.remove(confirm.row.id)
      toast(r.message)
      setConfirm(null)
      load()
    } catch (err) {
      toast(apiErrorMessage(err, 'Action failed.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const counts = list?.counts

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <BadgePercent size={22} color={RED} /> Special commissions
        </h1>
        <p className="text-sm text-text-muted mt-1">
          A deliberate commission on chosen products of a seller (incentive / special offer). It applies to
          <strong className="text-text-secondary"> new orders only</strong>: existing orders keep the commission they were placed with.
        </p>
      </div>

      <NewOffer sellers={sellers} onSaved={() => { setPage(1); load() }} toast={toast} />

      {/* ── All special commissions ── */}
      <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {([['', 'All', undefined], ['active', 'Active', counts?.active], ['scheduled', 'Scheduled', counts?.scheduled], ['expired', 'Expired / ended', counts?.expired]] as const).map(([k, label, n]) => (
            <button key={k} onClick={() => { setStatus(k); setPage(1) }}
              className={clsx('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                status === k ? 'border-[#db142e] text-white bg-[#db142e]/20' : 'border-border text-text-secondary hover:bg-bg-hover')}>
              {label}{n !== undefined ? ` (${n})` : ''}
            </button>
          ))}
          <select className={clsx(inputCls, 'ml-auto')} value={sellerFilter} onChange={(e) => { setSellerFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }}>
            <option value="">All sellers</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.shop_name || s.name}</option>)}
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input className={clsx(inputCls, 'pl-8 w-60')} placeholder="Search product, seller, note…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted">
                <th className="py-2 pr-3">Product</th><th className="pr-3">Seller</th><th className="pr-3">Offer</th>
                <th className="pr-3">Period</th><th className="pr-3">Status</th><th className="pr-3">Internal note</th><th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(list?.data ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <Thumb src={r.product_image} alt={r.product_name ?? ''} />
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary max-w-[220px] truncate">{r.product_name ?? `#${r.product_id}`}</p>
                        {r.product_price != null && <p className="text-[11px] text-text-muted">{money(r.product_price)}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="pr-3 text-text-secondary">{r.seller_name ?? '—'}</td>
                  <td className="pr-3">
                    <span className="font-bold" style={{ color: GREEN }}>{r.label}</span>
                    <p className="text-[11px] text-text-muted">{r.type === 'fixed_rate' ? 'final rate' : 'off the normal rate'}</p>
                  </td>
                  <td className="pr-3 text-[12px] text-text-secondary whitespace-nowrap">
                    {r.starts_at ? fmtDate(r.starts_at) : 'from creation'} →<br />{r.ends_at ? fmtDate(r.ends_at) : 'no end'}
                  </td>
                  <td className="pr-3">
                    <span className={clsx('inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border', STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
                  </td>
                  <td className="pr-3 text-[12px] text-text-muted max-w-[200px]">{r.note || '—'}</td>
                  <td className="text-right whitespace-nowrap">
                    <button title="Edit" onClick={() => setEdit(r)} className="p-1.5 rounded hover:bg-bg-hover text-text-secondary"><Pencil size={14} /></button>
                    {(r.status === 'active' || r.status === 'scheduled') && (
                      <button title="End now" onClick={() => setConfirm({ kind: 'end', row: r })} className="p-1.5 rounded hover:bg-bg-hover text-[#f59e0b]"><StopCircle size={14} /></button>
                    )}
                    <button title="Audit log" onClick={() => openHistory(r)} className="p-1.5 rounded hover:bg-bg-hover text-text-secondary"><History size={14} /></button>
                    <button title="Delete" onClick={() => setConfirm({ kind: 'delete', row: r })} className="p-1.5 rounded hover:bg-bg-hover text-[#ef4444]"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {list && list.data.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-text-muted">No special commission {status || q || sellerFilter ? 'matches these filters' : 'yet'}.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {list && list.meta.last_page > 1 && (
          <Pagination currentPage={list.meta.current_page} lastPage={list.meta.last_page} total={list.meta.total}
            from={(list.meta.current_page - 1) * 25 + 1} to={Math.min(list.meta.current_page * 25, list.meta.total)} onPageChange={setPage} />
        )}
      </div>

      {edit && <EditModal row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} toast={toast} />}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === 'delete' ? 'Delete special commission' : 'End special commission now'} size="sm">
        {confirm && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {confirm.kind === 'delete' ? 'Delete' : 'End'} the special commission <strong>{confirm.row.label}</strong> on
              {' '}<strong>{confirm.row.product_name}</strong>? The seller {confirm.kind === 'end' ? 'is notified' : 'is notified if it was live'}.
              <br />Existing orders keep the commission they were placed with.
            </p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border border-border text-sm text-text-secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button disabled={busy} className="px-3 py-2 rounded-lg text-sm text-white disabled:opacity-50" style={{ background: confirm.kind === 'delete' ? '#ef4444' : '#f59e0b' }} onClick={runConfirm}>
                {confirm.kind === 'delete' ? 'Delete' : 'End now'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!history} onClose={() => setHistory(null)} title={history?.title ?? ''} size="lg">
        {history && (history.entries === null ? <p className="text-sm text-text-muted">Loading…</p> : <AuditList entries={history.entries} />)}
      </Modal>

      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// New offer: seller → products → offer → backend preview → save
// ─────────────────────────────────────────────────────────────────────────────

function NewOffer({ sellers, onSaved, toast }: { sellers: SellerOption[]; onSaved: () => void; toast: (m: string, t?: ToastMsg['type']) => void }) {
  const [sellerId, setSellerId] = useState<number | ''>('')
  const [products, setProducts] = useState<SellerProductRow[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [pq, setPq] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [type, setType] = useState<OverrideType>('fixed_rate')
  const [value, setValue] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<CommissionPreviewRow[]>([])
  const [previewing, setPreviewing] = useState(false)
  const [ack, setAck] = useState(false)
  const [saving, setSaving] = useState(false)

  const num = value.trim() === '' ? null : Number(value)
  const valueOk = num !== null && Number.isFinite(num) && num >= 0 && num <= 100 && Math.abs(num * 100 - Math.round(num * 100)) < 1e-9

  useEffect(() => {
    setSelected([]); setPreview([]); setAck(false)
    if (!sellerId) { setProducts([]); return }
    setLoadingProducts(true)
    const t = setTimeout(() => {
      specialCommissionsApi.sellerProducts(sellerId, pq).then(setProducts).catch((e) => toast(apiErrorMessage(e, 'Could not load products.'), 'error')).finally(() => setLoadingProducts(false))
    }, 250)
    return () => clearTimeout(t)
  }, [sellerId, pq, toast])

  // Live preview from the backend: the real rate, commission and seller net at each product's current price
  useEffect(() => {
    setAck(false)
    if (selected.length === 0) { setPreview([]); return }
    setPreviewing(true)
    const t = setTimeout(() => {
      specialCommissionsApi.preview(selected, valueOk ? { type, value: num as number } : undefined)
        .then(setPreview).catch((e) => toast(apiErrorMessage(e, 'Preview failed.'), 'error')).finally(() => setPreviewing(false))
    }, 300)
    return () => clearTimeout(t)
  }, [selected, type, value, valueOk, num, toast])

  const warnings = useMemo(() => Array.from(new Set(preview.flatMap((r) => r.warnings))), [preview])
  const canSave = selected.length > 0 && valueOk && (warnings.length === 0 || ack) && !saving

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const selectable = products.filter((p) => !p.offer)

  const save = async () => {
    if (!canSave || num === null) return
    setSaving(true)
    try {
      const offer: OfferInput = {
        type, value: num,
        starts_at: startsAt ? fromLocalInput(startsAt) : null,
        ends_at: endsAt ? fromLocalInput(endsAt) : null,
        note: note.trim() || null,
      }
      const r = await specialCommissionsApi.create(selected, offer)
      toast(r.message)
      if (r.failed.length > 0) {
        const names = r.failed.map((f) => products.find((p) => p.id === f.product_id)?.name ?? `#${f.product_id}`).join(', ')
        toast(`Not saved: ${names} — ${Object.values(r.failed[0].errors)[0]?.[0] ?? 'see the list'}`, 'error')
      }
      setSelected([]); setValue(''); setNote(''); setStartsAt(''); setEndsAt('')
      specialCommissionsApi.sellerProducts(sellerId as number, pq).then(setProducts).catch(() => {})
      onSaved()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not save.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const seller = sellers.find((s) => s.id === sellerId)

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4">
      <h2 className="text-base font-semibold text-text-primary flex items-center gap-2"><Plus size={16} color={RED} /> New special commission</h2>

      {/* 1 — seller */}
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5"><Store size={10} className="inline mr-1" />1 · Seller</span>
          <select className={clsx(inputCls, 'w-full')} value={sellerId} onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Choose a seller…</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.shop_name || s.name} — {s.plan.name}</option>)}
          </select>
        </label>
        {sellerId !== '' && (
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Search their products</span>
            <input className={clsx(inputCls, 'w-full')} value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Product name…" />
          </label>
        )}
      </div>

      {/* 2 — products */}
      {sellerId !== '' && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">2 · Products ({selected.length} selected)</span>
            <button className="text-xs text-text-secondary underline disabled:opacity-40" disabled={selectable.length === 0}
              onClick={() => setSelected(selected.length === selectable.length ? [] : selectable.map((p) => p.id))}>
              {selected.length === selectable.length && selectable.length > 0 ? 'Clear' : 'Select all'}
            </button>
          </div>
          <div className="border border-border rounded-lg max-h-96 overflow-y-auto divide-y divide-border">
            {loadingProducts && <p className="p-3 text-sm text-text-muted">Loading…</p>}
            {!loadingProducts && products.length === 0 && <p className="p-3 text-sm text-text-muted">No approved product.</p>}
            {products.map((p) => (
              <label key={p.id} className={clsx('flex items-center gap-3 px-3 py-2 text-sm', p.offer ? 'opacity-60' : 'cursor-pointer hover:bg-bg-hover')}>
                <input type="checkbox" disabled={!!p.offer} checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                <Thumb src={p.image} alt={p.name} />
                <span className="flex-1 truncate text-text-primary">{p.name}</span>
                {p.offer && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ color: GREEN, borderColor: `${GREEN}55` }}>{p.offer.label} · {STATUS[p.offer.status].label}</span>}
                <span className="text-text-secondary w-24 text-right">{money(p.price)}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-1">A product with a special commission already live or scheduled must be edited or ended first (one at a time per product). It applies to all variants.</p>
        </div>
      )}

      {/* 3 — the offer */}
      {selected.length > 0 && (
        <>
          <div className="grid md:grid-cols-4 gap-3">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">3 · Type</span>
              <select className={clsx(inputCls, 'w-full')} value={type} onChange={(e) => setType(e.target.value as OverrideType)}>
                <option value="fixed_rate">Fixed rate (final commission %)</option>
                <option value="reduction_points">Reduction (− points off the normal rate)</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">{type === 'fixed_rate' ? 'Commission %' : 'Points off'}</span>
              <input className={clsx(inputCls, 'w-full', value && !valueOk && 'border-red-500')} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'fixed_rate' ? 'e.g. 5' : 'e.g. 3'} />
              {value && !valueOk && <span className="text-[11px] text-red-400">0 to 100, at most 2 decimals</span>}
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Starts (Tunis time, empty = now)</span>
              <input type="datetime-local" className={clsx(inputCls, 'w-full')} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Ends (empty = no end)</span>
              <input type="datetime-local" className={clsx(inputCls, 'w-full')} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Internal note (admin only, never shown to the seller)</span>
            <textarea rows={2} maxLength={1000} className={clsx(inputCls, 'w-full resize-none')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this offer?" />
          </label>

          {/* 4 — live preview from the backend */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
              4 · Preview at each product&apos;s current price {previewing && <span className="normal-case tracking-normal text-text-muted">(updating…)</span>}
            </p>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted">
                    <th className="p-2">Product</th><th className="p-2 text-right">Price</th>
                    <th className="p-2">Current rate</th><th className="p-2">New rate</th>
                    <th className="p-2 text-right">Commission</th><th className="p-2 text-right">Seller net</th><th className="p-2 text-right">Seller gain</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.product.id} className="border-t border-border align-top">
                      <td className="p-2 max-w-[220px]"><p className="truncate text-text-primary">{r.product.name}</p>
                        {r.warnings.map((w) => <p key={w} className="text-[11px] text-[#f59e0b] flex items-center gap-1"><AlertTriangle size={10} />{WARNING_TEXT[w] ?? w}{w === 'below_floor' ? ` (${pct(r.floor)})` : ''}</p>)}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">{money(r.price.unit)}{r.price.unit !== r.price.original && <p className="text-[10px] text-text-muted line-through">{money(r.price.original)}</p>}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span className="font-semibold text-text-primary">Current rate: {pct(r.normal.rate)}</span>
                        <p className="text-[11px] text-text-muted">({r.normal.source === 'plan' ? `${r.normal.plan_name} ` : ''}{SOURCE_LABEL[r.normal.source]})</p>
                        {r.current.override_id !== null && <p className="text-[11px]" style={{ color: GREEN }}>special: {pct(r.current.rate)} now</p>}
                      </td>
                      <td className="p-2 whitespace-nowrap">{r.proposed ? <span className="font-bold" style={{ color: GREEN }}>{pct(r.proposed.rate)}</span> : <span className="text-text-muted">—</span>}</td>
                      <td className="p-2 text-right whitespace-nowrap">{r.proposed ? <><span className="text-[#ef4444]">{money(r.proposed.commission)}</span><p className="text-[10px] text-text-muted">was {money(r.normal.commission)}</p></> : '—'}</td>
                      <td className="p-2 text-right whitespace-nowrap">{r.proposed ? <><span className="text-[#34d399]">{money(r.proposed.seller_amount)}</span><p className="text-[10px] text-text-muted">was {money(r.normal.seller_amount)}</p></> : '—'}</td>
                      <td className="p-2 text-right whitespace-nowrap">{r.proposed ? `${r.proposed.seller_gain >= 0 ? '+' : ''}${money(r.proposed.seller_gain)}` : '—'}</td>
                    </tr>
                  ))}
                  {preview.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-text-muted">{previewing ? 'Calculating…' : 'Enter a value to see the figures.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-text-muted mt-1">Per unit sold at the price above, delivery excluded, same calculation as checkout.{seller ? ` Seller: ${seller.shop_name || seller.name}.` : ''}</p>
          </div>

          {warnings.length > 0 && (
            <label className="flex items-start gap-2 p-3 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-sm text-[#fbbf24]">
              <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span><strong>Warning:</strong> {warnings.map((w) => WARNING_TEXT[w] ?? w).join(' · ')}. This is allowed because it is a deliberate admin decision. I confirm.</span>
            </label>
          )}

          <div className="flex justify-end">
            <button disabled={!canSave} onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: RED }}>
              {saving ? 'Saving…' : `Save for ${selected.length} product${selected.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit
// ─────────────────────────────────────────────────────────────────────────────

function EditModal({ row, onClose, onSaved, toast }: { row: SpecialCommission; onClose: () => void; onSaved: () => void; toast: (m: string, t?: ToastMsg['type']) => void }) {
  const [type, setType] = useState<OverrideType>(row.type)
  const [value, setValue] = useState(String(row.value))
  const [startsAt, setStartsAt] = useState(row.starts_at ? toLocalInput(row.starts_at) : '')
  const [endsAt, setEndsAt] = useState(row.ends_at ? toLocalInput(row.ends_at) : '')
  const [note, setNote] = useState(row.note ?? '')
  const [preview, setPreview] = useState<CommissionPreviewRow | null>(null)
  const [saving, setSaving] = useState(false)

  const num = value.trim() === '' ? null : Number(value)
  const valueOk = num !== null && Number.isFinite(num) && num >= 0 && num <= 100 && Math.abs(num * 100 - Math.round(num * 100)) < 1e-9

  useEffect(() => {
    if (!valueOk) { setPreview(null); return }
    const t = setTimeout(() => {
      specialCommissionsApi.preview([row.product_id], { type, value: num as number }).then((r) => setPreview(r[0] ?? null)).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [row.product_id, type, num, valueOk])

  const save = async () => {
    if (!valueOk || num === null) return
    setSaving(true)
    try {
      const r = await specialCommissionsApi.update(row.id, {
        type, value: num, note: note.trim() || null,
        starts_at: startsAt ? fromLocalInput(startsAt) : null,
        ends_at: endsAt ? fromLocalInput(endsAt) : null,
      })
      toast(r.message)
      onSaved()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not save.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit — ${row.product_name ?? `#${row.product_id}`}`} size="lg">
      <div className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block"><span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Type</span>
            <select className={clsx(inputCls, 'w-full')} value={type} onChange={(e) => setType(e.target.value as OverrideType)}>
              <option value="fixed_rate">Fixed rate (final commission %)</option>
              <option value="reduction_points">Reduction (− points)</option>
            </select></label>
          <label className="block"><span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">{type === 'fixed_rate' ? 'Commission %' : 'Points off'}</span>
            <input className={clsx(inputCls, 'w-full', !valueOk && 'border-red-500')} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></label>
          <label className="block"><span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Starts (Tunis time)</span>
            <input type="datetime-local" className={clsx(inputCls, 'w-full')} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
          <label className="block"><span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Ends (empty = no end)</span>
            <input type="datetime-local" className={clsx(inputCls, 'w-full')} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
        </div>
        <label className="block"><span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Internal note (admin only)</span>
          <textarea rows={2} maxLength={1000} className={clsx(inputCls, 'w-full resize-none')} value={note} onChange={(e) => setNote(e.target.value)} /></label>

        {preview?.proposed && (
          <div className="rounded-lg border border-border p-3 text-sm space-y-1">
            <p className="text-text-secondary">Current rate: <strong>{pct(preview.normal.rate)}</strong> ({SOURCE_LABEL[preview.normal.source]}) → new rate <strong style={{ color: GREEN }}>{pct(preview.proposed.rate)}</strong></p>
            <p className="text-text-muted">At {money(preview.price.unit)}: commission {money(preview.proposed.commission)} · seller net {money(preview.proposed.seller_amount)}</p>
            {preview.warnings.map((w) => <p key={w} className="text-[#f59e0b] text-[12px] flex items-center gap-1"><AlertTriangle size={11} />{WARNING_TEXT[w] ?? w}</p>)}
          </div>
        )}
        <p className="text-[11px] text-text-muted">Orders already placed are never changed.</p>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 rounded-lg border border-border text-sm text-text-secondary" onClick={onClose}>Cancel</button>
          <button disabled={!valueOk || saving} onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: RED }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<AuditEntry['action'], string> = { created: 'Created', updated: 'Updated', ended: 'Ended', deleted: 'Deleted', expired: 'Expired (automatic)' }

function describe(v: Record<string, unknown> | null): string {
  if (!v) return '—'
  const type = v.type === 'fixed_rate' ? 'fixed' : 'reduction'
  const val = v.type === 'fixed_rate' ? `${v.value}%` : `−${v.value} pts`
  const from = v.starts_at ? fmtDate(String(v.starts_at)) : 'creation'
  const to = v.ends_at ? fmtDate(String(v.ends_at)) : 'no end'
  return `${type} ${val} · ${from} → ${to}${v.is_active === false ? ' · off' : ''}${v.note ? ` · note: ${String(v.note)}` : ''}`
}

function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-text-muted">Nothing logged yet.</p>
  return (
    <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
      {entries.map((e) => (
        <li key={e.id} className="border border-border rounded-lg p-3 text-sm">
          <div className="flex justify-between gap-2">
            <strong className="text-text-primary">{ACTION_LABEL[e.action] ?? e.action}</strong>
            <span className="text-[11px] text-text-muted">{fmtDate(e.created_at)} · {e.actor_name ?? 'system'}</span>
          </div>
          {e.before && <p className="text-[12px] text-text-muted mt-1">before: {describe(e.before)}</p>}
          {e.after && <p className="text-[12px] text-text-secondary">after: {describe(e.after)}</p>}
        </li>
      ))}
    </ul>
  )
}
