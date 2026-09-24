'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle, XCircle, MessageSquareWarning, Star, ExternalLink, SkipForward,
  Loader2, Edit2, EyeOff, RotateCcw, AlertTriangle, RefreshCw, Keyboard, Copy, Check,
} from 'lucide-react'
import clsx from 'clsx'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { productsApi } from '@/lib/api/products'
import type { ProductReview } from '@/types/productReview'
import AdminEditProductModal from '../AdminEditProductModal'
import ModerationActionModal from '../ModerationActionModal'
import { STATUS_META, apiErrorMessage } from '../reviewUtils'
import MediaGallery, { type GalleryFilter } from './_components/MediaGallery'
import SummaryPanel from './_components/SummaryPanel'
import ReviewTabs from './_components/ReviewTabs'

type Confirm = 'approve' | 'disable' | 'restore'
const AUTO_ADVANCE_KEY = 'ct_admin_review_auto_advance'

export default function ProductReviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const productId = Number(id)

  const [product, setProduct]   = useState<ProductReview | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<{ status?: number; message: string } | null>(null)
  const [busy, setBusy]         = useState<string | null>(null)
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirm, setConfirm]   = useState<Confirm | null>(null)
  const [actionModal, setActionModal] = useState<'reject' | 'request_changes' | null>(null)
  const [editing, setEditing]   = useState(false)
  const [filter, setFilter]     = useState<GalleryFilter>({ kind: 'all' })
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [showKeys, setShowKeys] = useState(false)
  const [copied, setCopied]     = useState(false)

  useEffect(() => {
    try { setAutoAdvance(localStorage.getItem(AUTO_ADVANCE_KEY) !== '0') } catch { /* storage unavailable */ }
  }, [])
  const toggleAutoAdvance = () => {
    setAutoAdvance((v) => {
      try { localStorage.setItem(AUTO_ADVANCE_KEY, v ? '0' : '1') } catch { /* ignore */ }
      return !v
    })
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      setProduct(await productsApi.review(productId))
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError({ status, message: status === 404 ? 'This product does not exist or was permanently deleted.' : apiErrorMessage(err, 'Failed to load the product.') })
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { setFilter({ kind: 'all' }); load() }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const nextId = product?.queue?.next_pending_id ?? null
  const goNext = useCallback(() => { if (nextId) router.push(`/products/${nextId}`) }, [nextId, router])

  /** After a decision on a queued product: jump to the next one, or refresh in place. */
  const afterDecision = useCallback((message: string, wasQueued: boolean) => {
    setToast({ message, type: 'success' })
    if (wasQueued && autoAdvance && nextId) router.push(`/products/${nextId}`)
    else load(true)
  }, [autoAdvance, nextId, router, load])

  const status = product?.status
  const isQueued = status === 'pending' || status === 'changes_requested'

  const runConfirm = async () => {
    if (!product || !confirm) return
    setBusy(confirm)
    try {
      if (confirm === 'approve') await productsApi.approve(product.id)
      if (confirm === 'disable') await productsApi.disable(product.id)
      if (confirm === 'restore') await productsApi.restore(product.id)
      setConfirm(null)
      afterDecision(
        confirm === 'approve' ? 'Product approved — seller notified.' : confirm === 'disable' ? 'Product disabled.' : 'Product restored to pending review.',
        confirm === 'approve' && isQueued
      )
    } catch (err) {
      setToast({ message: apiErrorMessage(err, 'Action failed. Please try again.'), type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const toggleFeatured = useCallback(async () => {
    if (!product) return
    setBusy('featured')
    try {
      await productsApi.setFeatured(product.id, !product.featured)
      setToast({ message: product.featured ? 'Removed from featured.' : 'Marked as featured.', type: 'success' })
      load(true)
    } catch (err) {
      setToast({ message: apiErrorMessage(err, 'Could not update featured.'), type: 'error' })
    } finally {
      setBusy(null)
    }
  }, [product, load])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const anyModal = !!confirm || !!actionModal || editing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyModal || !product || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (document.querySelector('[role="dialog"]')) return   // lightbox open
      const k = e.key.toLowerCase()
      const s = product.status
      if (k === 'a' && s !== 'approved' && s !== 'deleted_by_seller') setConfirm('approve')
      else if (k === 'r' && (s === 'pending' || s === 'changes_requested')) setActionModal('reject')
      else if (k === 'c' && (s === 'pending' || s === 'changes_requested')) setActionModal('request_changes')
      else if (k === 'f' && s !== 'deleted_by_seller') toggleFeatured()
      else if (k === 'n') goNext()
      else if (k === 'e' && s !== 'deleted_by_seller') setEditing(true)
      else if (k === '?') setShowKeys((v) => !v)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyModal, product, goNext, toggleFeatured])

  // ── States ─────────────────────────────────────────────────────────────────
  if (loading && !product) return <ReviewSkeleton />

  if (error && !product) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-bg-card border border-border rounded-xl p-8 text-center space-y-4">
        <AlertTriangle size={32} className="mx-auto text-accent-orange" />
        <div>
          <p className="text-base font-semibold text-text-primary">{error.status === 404 ? 'Product not found' : 'Something went wrong'}</p>
          <p className="text-sm text-text-muted mt-1">{error.message}</p>
        </div>
        <div className="flex justify-center gap-3">
          <Link href="/products" className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-hover">Back to products</Link>
          {error.status !== 404 && (
            <button onClick={() => load()} className="px-4 py-2 rounded-lg bg-accent-red hover:bg-accent-red/90 text-white text-sm inline-flex items-center gap-2">
              <RefreshCw size={14} /> Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!product) return null
  const meta = STATUS_META[product.status]
  const lastDecision = product.history.find((h) => h.action === 'rejected' || h.action === 'changes_requested')

  const copySku = async () => {
    if (!product.sku) return
    try { await navigator.clipboard.writeText(product.sku); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* ignore */ }
  }

  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap'

  return (
    <div className="space-y-4 -mt-6">
      {toast && (
        <div className={clsx(
          'fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium',
          toast.type === 'success' ? 'bg-accent-green' : 'bg-accent-red'
        )}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-6 px-6 pt-6 pb-3 bg-bg-primary/95 backdrop-blur border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <Link href="/products" className="mt-0.5 p-2 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover" title="Back to products">
              <ArrowLeft size={16} />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-text-primary truncate max-w-[52ch]" title={product.name}>{product.name}</h1>
                <Badge variant={meta.badge}>{meta.label}</Badge>
                {product.featured && <Badge variant="warning">★ Featured</Badge>}
                {loading && <Loader2 size={14} className="animate-spin text-text-muted" />}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted mt-1">
                <span>ID #{product.id}</span>
                <span className="inline-flex items-center gap-1">
                  SKU {product.sku ? <span className="font-mono text-text-secondary">{product.sku}</span> : <em>none</em>}
                  {product.sku && (
                    <button onClick={copySku} className="hover:text-text-primary" title="Copy SKU">
                      {copied ? <Check size={11} className="text-accent-green" /> : <Copy size={11} />}
                    </button>
                  )}
                </span>
                {product.seller && <span>by <span className="text-text-secondary">{product.seller.store_name}</span></span>}
                {product.storefront_url ? (
                  <a href={product.storefront_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-purple-light hover:underline">
                    View on storefront <ExternalLink size={11} />
                  </a>
                ) : (
                  <span title="Only approved, active products are visible on the storefront">Not live on storefront</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {product.status === 'deleted_by_seller' ? (
              <button onClick={() => setConfirm('restore')} className={clsx(btn, 'bg-accent-green hover:bg-accent-green/90 text-white')}>
                <RotateCcw size={14} /> Restore
              </button>
            ) : (
              <>
                <button
                  onClick={toggleFeatured}
                  disabled={busy === 'featured'}
                  className={clsx(btn, product.featured
                    ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/40 hover:bg-accent-orange/25'
                    : 'border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary')}
                  title="Toggle featured (F)"
                >
                  {busy === 'featured' ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} className={product.featured ? 'fill-accent-orange' : ''} />}
                  {product.featured ? 'Featured' : 'Feature'}
                </button>
                <button onClick={() => setEditing(true)} className={clsx(btn, 'border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary')} title="Edit (E)">
                  <Edit2 size={14} /> Edit
                </button>
                {product.status === 'approved' && (
                  <button onClick={() => setConfirm('disable')} className={clsx(btn, 'border border-accent-orange/40 text-accent-orange hover:bg-accent-orange/10')}>
                    <EyeOff size={14} /> Disable
                  </button>
                )}
                {isQueued && (
                  <>
                    <button onClick={() => setActionModal('request_changes')} className={clsx(btn, 'border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/10')} title="Request changes (C)">
                      <MessageSquareWarning size={14} /> Request changes
                    </button>
                    <button onClick={() => setActionModal('reject')} className={clsx(btn, 'bg-accent-red hover:bg-accent-red/90 text-white')} title="Reject (R)">
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
                {product.status !== 'approved' && (
                  <button onClick={() => setConfirm('approve')} className={clsx(btn, 'bg-accent-green hover:bg-accent-green/90 text-white')} title="Approve (A)">
                    <CheckCircle size={14} /> {product.status === 'disabled' ? 'Re-enable' : 'Approve'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Queue bar */}
        {product.queue && (
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs text-text-muted">
            <span>
              <span className="text-text-secondary font-medium">{product.queue.pending_count}</span> product{product.queue.pending_count === 1 ? '' : 's'} pending review
            </span>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={autoAdvance} onChange={toggleAutoAdvance} className="accent-[#db142e]" />
                Auto-advance after decision
              </label>
              <button onClick={() => setShowKeys((v) => !v)} className="inline-flex items-center gap-1 hover:text-text-primary" title="Keyboard shortcuts (?)">
                <Keyboard size={13} /> Shortcuts
              </button>
              <button
                onClick={goNext}
                disabled={!nextId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
                title="Next pending product (N)"
              >
                Next pending <SkipForward size={12} />
              </button>
            </div>
          </div>
        )}
        {showKeys && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
            {[['A', 'Approve'], ['R', 'Reject'], ['C', 'Request changes'], ['F', 'Toggle featured'], ['E', 'Edit'], ['N', 'Next pending'], ['← →', 'Images (fullscreen)'], ['Esc', 'Close']].map(([k, l]) => (
              <span key={k}><kbd className="px-1.5 py-0.5 rounded border border-border bg-bg-card text-text-secondary font-mono">{k}</kbd> {l}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Decision banners ──────────────────────────────────────────────── */}
      {product.status === 'rejected' && (
        <Banner tone="red" title="Rejected">
          {product.rejection_reason}
        </Banner>
      )}
      {product.status === 'changes_requested' && (
        <Banner tone="cyan" title="Waiting for the seller to make changes">
          {lastDecision?.reasons.length ? `${lastDecision.reasons.join(', ')} — ` : ''}{lastDecision?.note}
        </Banner>
      )}
      {product.status === 'deleted_by_seller' && (
        <Banner tone="red" title="Deleted by the seller">
          The seller removed this product{product.deleted_at ? ` on ${new Date(product.deleted_at).toLocaleDateString()}` : ''}. Restore it to send it back to review.
        </Banner>
      )}
      {product.hidden_reason && (
        <Banner tone="orange" title="Hidden from storefront">
          {product.hidden_reason === 'over_plan_limit' ? "The seller is over their plan's product limit." : 'Suspended by an admin.'}
        </Banner>
      )}

      {/* ── Media + summary ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 items-start">
        <MediaGallery product={product} filter={filter} onFilterChange={setFilter} />
        <SummaryPanel product={product} />
      </div>

      <ReviewTabs product={product} onShowVariantImages={setFilter} />

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === 'approve' ? (product.status === 'disabled' ? 'Re-enable product' : 'Approve product') : confirm === 'disable' ? 'Disable product' : 'Restore product'}
        size="sm"
      >
        <p className="text-text-secondary text-sm mb-2">
          {confirm === 'approve' && <>Approve <b className="text-text-primary">&ldquo;{product.name}&rdquo;</b> and make it visible to customers? The seller will be notified.</>}
          {confirm === 'disable' && <>Disable <b className="text-text-primary">&ldquo;{product.name}&rdquo;</b>? It will be hidden from customers.</>}
          {confirm === 'restore' && <>Restore <b className="text-text-primary">&ldquo;{product.name}&rdquo;</b> to the pending review queue?</>}
        </p>
        {confirm === 'approve' && product.checks.some((c) => !c.ok && !c.na) && (
          <p className="text-xs text-accent-orange mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {product.checks.filter((c) => !c.ok && !c.na).length} quality check(s) not passing.
          </p>
        )}
        <div className="flex gap-3 justify-end mt-4">
          <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover text-sm">Cancel</button>
          <button
            autoFocus
            onClick={runConfirm}
            disabled={!!busy}
            className={clsx(
              'px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 inline-flex items-center gap-2',
              confirm === 'disable' ? 'bg-accent-orange hover:bg-accent-orange/90' : 'bg-accent-green hover:bg-accent-green/90'
            )}
          >
            {busy ? <><Loader2 size={13} className="animate-spin" /> Processing…</> : 'Confirm'}
          </button>
        </div>
      </Modal>

      <ModerationActionModal
        open={!!actionModal}
        mode={actionModal ?? 'reject'}
        product={product}
        reasons={product.moderation_reasons}
        onClose={() => setActionModal(null)}
        onDone={(msg) => { setActionModal(null); afterDecision(msg, isQueued) }}
      />

      {editing && (
        <AdminEditProductModal
          productId={product.id}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setToast({ message: 'Product updated.', type: 'success' }); load(true) }}
        />
      )}
    </div>
  )
}

function Banner({ tone, title, children }: { tone: 'red' | 'cyan' | 'orange'; title: string; children: React.ReactNode }) {
  const cls = {
    red:    'bg-accent-red/[0.07] border-accent-red/25 text-accent-red',
    cyan:   'bg-accent-cyan/[0.07] border-accent-cyan/25 text-accent-cyan',
    orange: 'bg-accent-orange/[0.07] border-accent-orange/25 text-accent-orange',
  }[tone]
  return (
    <div className={clsx('flex items-start gap-2.5 border rounded-xl px-4 py-3', cls)}>
      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
        {children && <p className="text-sm text-text-secondary mt-0.5 whitespace-pre-line break-words">{children}</p>}
      </div>
    </div>
  )
}

function ReviewSkeleton() {
  const block = 'bg-bg-card border border-border rounded-xl animate-pulse'
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading product">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-72 rounded bg-bg-hover animate-pulse" />
          <div className="h-3 w-48 rounded bg-bg-hover animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-9 w-28 rounded-lg bg-bg-hover animate-pulse" />)}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={clsx(block, 'aspect-square')} />
        <div className="space-y-4">
          <div className={clsx(block, 'h-28')} />
          <div className={clsx(block, 'h-72')} />
          <div className={clsx(block, 'h-56')} />
        </div>
      </div>
      <div className={clsx(block, 'h-64')} />
    </div>
  )
}
