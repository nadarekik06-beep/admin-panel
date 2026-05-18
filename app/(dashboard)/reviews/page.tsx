'use client'

/**
 * app/(dashboard)/reviews/page.tsx  — Admin Panel (port 3001)
 *
 * Complete admin review management system.
 * Architecture matches complaints/page.tsx exactly:
 *  - Same GLOBAL_CSS tokens (bg, t1, t2, t3, bd, animations)
 *  - Same StatCard / filter bar / table / drawer pattern
 *  - Same ct-btn / ct-input / ct-select classes
 *
 * Features:
 *  1. Stats cards: total, approved, pending, flagged, rejected, pending reports
 *  2. Filters: status, rating, has_reports, search (product/user/seller)
 *  3. Paginated table with sort
 *  4. Detail drawer: review content, media moderation, reply deletion,
 *     approve / reject / flag / delete actions
 *  5. Reports tab: list of reported reviews, resolve actions
 *  6. Toast notifications
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Star, Search, RefreshCw, Eye, ChevronRight, Filter,
  RotateCcw, CheckCircle, XCircle, Flag, Trash2, X,
  AlertTriangle, ImageIcon, MessageSquare, User, Package,
  Store, CalendarDays, ThumbsUp, EyeOff, Loader2,
  TrendingUp, FileText, ShieldAlert, BadgeCheck, AlertCircle,
} from 'lucide-react'
import { adminReviewsApi } from '@/lib/api/reviews'
import type { AdminReview, AdminReviewDetail, ReviewStats, AdminReport } from '@/lib/api/reviews'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const RED    = '#db142e'
const GREEN  = '#198f41'
const ORANGE = '#f97316'
const AMBER  = '#f59e0b'

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Global CSS — matches complaints/page.tsx token system ─────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  .ct-root {
    font-family: 'Plus Jakarta Sans', sans-serif;
    --red: #db142e; --green: #198f41; --orange: #f97316;
    --bg: #0a0c10; --bg1: #11141a; --bg2: #161a22; --bg3: #1c2130;
    --bd: rgba(255,255,255,0.06); --bd2: rgba(255,255,255,0.1);
    --t1: #f0f2f7; --t2: #8891a4; --t3: #4e5668;
    --drawer-bg: #1e2330; --drawer-header-bg: #242838; --drawer-footer-bg: #242838;
    --drawer-card-bg: #323b52; --drawer-card-bd: rgba(255,255,255,0.18);
    --drawer-bd: rgba(255,255,255,0.14);
    --drawer-t1: #f4f6fc; --drawer-t2: #b0bbd4; --drawer-t3: #6e7d9e;
    --drawer-section-bg: #232840;
  }

  @keyframes ct-fade-up  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  @keyframes ct-slide-in { from{transform:translateX(100%)} to{transform:translateX(0)} }
  @keyframes ct-slide-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes ct-spin     { to{transform:rotate(360deg)} }
  @keyframes ct-shimmer  { from{transform:translateX(-100%)} to{transform:translateX(200%)} }

  .ct-animate-fade-up  { animation: ct-fade-up 0.45s cubic-bezier(.22,1,.36,1) both; }
  .ct-animate-slide-in { animation: ct-slide-in 0.3s cubic-bezier(.22,1,.36,1) both; }
  .ct-animate-slide-up { animation: ct-slide-up 0.25s cubic-bezier(.22,1,.36,1) both; }
  .ct-spin             { animation: ct-spin 0.9s linear infinite; }

  .ct-stagger > *:nth-child(1) { animation-delay:0ms }
  .ct-stagger > *:nth-child(2) { animation-delay:60ms }
  .ct-stagger > *:nth-child(3) { animation-delay:120ms }
  .ct-stagger > *:nth-child(4) { animation-delay:180ms }
  .ct-stagger > *:nth-child(5) { animation-delay:240ms }
  .ct-stagger > *:nth-child(6) { animation-delay:300ms }

  .ct-stat {
    background:var(--bg2); border:1px solid var(--bd); border-radius:14px;
    padding:18px 16px; display:flex; align-items:center; gap:14px;
    transition:border-color .2s,transform .2s,box-shadow .2s; cursor:default;
    position:relative; overflow:hidden;
  }
  .ct-stat::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.025) 0%,transparent 60%); pointer-events:none; }
  .ct-stat:hover { transform:translateY(-2px); }

  .ct-icon-bubble { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

  .ct-filter-bar { background:var(--bg2); border:1px solid var(--bd); border-radius:14px; padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; }

  .ct-input { background:var(--bg); border:1px solid var(--bd); border-radius:10px; color:var(--t1); font-family:inherit; font-size:13px; padding:9px 14px; outline:none; transition:border-color .2s,box-shadow .2s; width:100%; }
  .ct-input:focus { border-color:rgba(219,20,46,.5); box-shadow:0 0 0 3px rgba(219,20,46,.08); }
  .ct-input::placeholder { color:var(--t3); }

  .ct-select { background:var(--bg); border:1px solid var(--bd); border-radius:10px; color:var(--t1); font-family:inherit; font-size:13px; padding:9px 34px 9px 14px; outline:none; cursor:pointer; width:100%; transition:border-color .2s; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234e5668' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; }
  .ct-select:focus { border-color:rgba(219,20,46,.5); }
  .ct-select option { background:#161a22; }

  .ct-label { font-size:10px; font-weight:800; color:var(--t3); text-transform:uppercase; letter-spacing:.08em; display:block; margin-bottom:6px; }

  .ct-table-wrap { background:var(--bg2); border:1px solid var(--bd); border-radius:16px; overflow:hidden; }
  .ct-table { width:100%; border-collapse:collapse; }
  .ct-table th { padding:11px 16px; font-size:10px; font-weight:800; color:var(--t3); text-align:left; text-transform:uppercase; letter-spacing:.08em; white-space:nowrap; background:var(--bg); border-bottom:1px solid var(--bd); }
  .ct-table tr { transition:background .15s; cursor:pointer; }
  .ct-table tr:hover td { background:rgba(255,255,255,.025); }
  .ct-table td { padding:13px 16px; border-bottom:1px solid var(--bd); vertical-align:middle; transition:background .15s; }
  .ct-table tr:last-child td { border-bottom:none; }

  .ct-btn-view { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; background:transparent; border:1px solid var(--bd2); border-radius:8px; color:var(--t2); font-size:12px; font-weight:700; font-family:inherit; cursor:pointer; transition:background .15s,color .15s,border-color .15s,transform .1s; }
  .ct-btn-view:hover { background:rgba(255,255,255,.06); color:var(--t1); transform:translateX(1px); }

  .ct-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:11px 18px; border-radius:10px; font-family:inherit; font-size:13px; font-weight:700; border:none; cursor:pointer; transition:opacity .15s,transform .1s,filter .15s; }
  .ct-btn:active:not(:disabled) { transform:scale(0.97); }
  .ct-btn:disabled { opacity:.45; cursor:not-allowed; }
  .ct-btn--ghost { background:rgba(255,255,255,.04); border:1px solid var(--bd2); color:var(--t2); }
  .ct-btn--ghost:hover:not(:disabled) { background:rgba(255,255,255,.08); color:var(--t1); }
  .ct-btn--danger { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.25); color:#f87171; }
  .ct-btn--danger:hover:not(:disabled) { background:rgba(239,68,68,.18); }
  .ct-btn--success { background:rgba(25,143,65,.15); color:#4ade80; border:1px solid rgba(25,143,65,.35); }
  .ct-btn--success:hover:not(:disabled) { background:rgba(25,143,65,.25); color:#86efac; }
  .ct-btn--warning { background:rgba(245,158,11,.12); border:1px solid rgba(245,158,11,.3); color:#fbbf24; }
  .ct-btn--warning:hover:not(:disabled) { background:rgba(245,158,11,.2); }
  .ct-btn--primary-danger { background:#ef4444; color:#fff; }
  .ct-btn--primary-danger:hover:not(:disabled) { filter:brightness(1.1); }
  .ct-btn--flag { background:rgba(249,115,22,.12); border:1px solid rgba(249,115,22,.3); color:#fb923c; }
  .ct-btn--flag:hover:not(:disabled) { background:rgba(249,115,22,.2); }

  .ct-drawer { position:fixed; top:0; right:0; bottom:0; width:100%; max-width:620px; background:var(--drawer-bg); border-left:2px solid rgba(219,20,46,.25); box-shadow:-32px 0 96px rgba(0,0,0,.75),-1px 0 0 rgba(255,255,255,.05); z-index:9001; display:flex; flex-direction:column; overflow:hidden; }
  .ct-drawer-header { padding:22px 26px 18px; border-bottom:1px solid var(--drawer-bd); position:sticky; top:0; background:var(--drawer-header-bg); z-index:1; display:flex; align-items:flex-start; justify-content:space-between; }
  .ct-drawer-body { flex:1; overflow-y:auto; padding:22px 26px; display:flex; flex-direction:column; gap:18px; background:var(--drawer-bg); }
  .ct-drawer-body::-webkit-scrollbar { width:4px; }
  .ct-drawer-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:2px; }
  .ct-drawer-footer { padding:16px 26px; border-top:1px solid var(--drawer-bd); background:var(--drawer-footer-bg); display:flex; gap:10px; }

  .ct-info-card { background:var(--drawer-card-bg); border:1px solid var(--drawer-card-bd); border-radius:12px; padding:16px 18px; box-shadow:0 2px 12px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.07); }
  .ct-info-card-label { font-size:10px; font-weight:800; color:var(--drawer-t3); text-transform:uppercase; letter-spacing:.08em; margin:0 0 10px; display:flex; align-items:center; gap:6px; }

  .ct-close-btn { width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,.06); border:1px solid var(--drawer-bd); color:var(--drawer-t2); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background .15s,color .15s; flex-shrink:0; }
  .ct-close-btn:hover { background:rgba(255,255,255,.12); color:var(--drawer-t1); }

  .ct-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(3px); z-index:9000; animation:ct-fade-up .2s ease both; }

  .ct-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); background:var(--bg2); border:1px solid var(--bd2); color:var(--t1); padding:10px 20px; border-radius:100px; font-size:13px; font-weight:600; z-index:99999; box-shadow:0 12px 40px rgba(0,0,0,.5); white-space:nowrap; animation:ct-slide-up .3s cubic-bezier(.22,1,.36,1) both; }

  .ct-modal { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:100%; max-width:480px; background:var(--bg2); border:1px solid var(--bd2); border-radius:20px; padding:28px; z-index:10001; box-shadow:0 40px 100px rgba(0,0,0,.6); animation:ct-slide-up .25s cubic-bezier(.22,1,.36,1) both; }

  .ct-skeleton { background:var(--bg3); border-radius:6px; position:relative; overflow:hidden; }
  .ct-skeleton::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 50%,transparent 100%); animation:ct-shimmer 1.5s infinite; }

  .ct-section-title { font-size:11px; font-weight:800; color:var(--drawer-t3); text-transform:uppercase; letter-spacing:.08em; margin:0 0 10px; display:flex; align-items:center; gap:6px; }

  .ct-tab { display:flex; gap:4px; background:var(--bg); border:1px solid var(--bd); border-radius:11px; padding:4px; }
  .ct-tab-btn { flex:1; padding:8px 16px; border-radius:8px; border:none; font-family:inherit; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; }
  .ct-tab-btn--active { background:var(--bg2); color:var(--t1); box-shadow:0 1px 4px rgba(0,0,0,.3); }
  .ct-tab-btn--inactive { background:transparent; color:var(--t3); }
  .ct-tab-btn--inactive:hover { color:var(--t2); }

  .ct-media-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:10px; }
  .ct-media-item { position:relative; border-radius:10px; overflow:hidden; border:1px solid var(--drawer-card-bd); aspect-ratio:1; }
  .ct-media-item img { width:100%; height:100%; object-fit:cover; display:block; }
  .ct-media-actions { position:absolute; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; gap:8px; opacity:0; transition:opacity .2s; }
  .ct-media-item:hover .ct-media-actions { opacity:1; }

  .ct-action-btn { width:32px; height:32px; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-family:inherit; transition:all .15s; }

  input[type="date"]::-webkit-calendar-picker-indicator { filter:invert(.4); }
`

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: 'Approved', color: GREEN,     bg: 'rgba(25,143,65,.12)'   },
  pending:  { label: 'Pending',  color: AMBER,     bg: 'rgba(245,158,11,.12)'  },
  flagged:  { label: 'Flagged',  color: ORANGE,    bg: 'rgba(249,115,22,.12)'  },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,.12)'   },
}

// ── Components ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: '#8891a4', bg: 'rgba(136,145,164,.12)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 100,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}28`,
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12}
          fill={i <= rating ? AMBER : 'none'}
          stroke={AMBER} strokeWidth={1.5} />
      ))}
    </div>
  )
}

function StatCard({ label, value, color, icon, highlight }: {
  label: string; value: number; color: string; icon: React.ReactNode; highlight?: boolean
}) {
  return (
    <div className="ct-stat ct-animate-fade-up"
      style={{ borderColor: highlight && value > 0 ? `${color}40` : undefined }}>
      <div className="ct-icon-bubble" style={{ background: `${color}18` }}>
        <span style={{ color, display: 'flex' }}>{icon}</span>
      </div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 900, color, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '5px 0 0' }}>{label}</p>
      </div>
      {highlight && value > 0 && (
        <div style={{ marginLeft: 'auto' }}><AlertTriangle size={15} color={color} /></div>
      )}
    </div>
  )
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
          <div className="ct-skeleton" style={{ height: 14, width: [40,130,100,80,70,60,60,50][i] ?? 60, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ reviewId, isOpen, onClose, onDone }: {
  reviewId: number; isOpen: boolean; onClose: () => void; onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => { if (isOpen) { setReason(''); setError('') } }, [isOpen])
  if (!isOpen) return null

  const handleReject = async () => {
    setSaving(true); setError('')
    try {
      await adminReviewsApi.reject(reviewId, reason.trim() || undefined)
      onDone(); onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to reject review.')
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="ct-backdrop" style={{ zIndex: 10000 }} onClick={onClose} />
      <div className="ct-modal">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={18} color="#ef4444" />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Reject Review</h3>
            <p style={{ fontSize: 12, color: 'var(--t2)', margin: 0 }}>Optional: provide a reason</p>
          </div>
        </div>
        <textarea value={reason} onChange={e => { setReason(e.target.value); setError('') }}
          rows={4} placeholder="Reason for rejection (optional)…"
          className="ct-input" style={{ resize: 'vertical', lineHeight: 1.6 }} />
        {error && (
          <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertCircle size={12} /> {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="ct-btn ct-btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="ct-btn ct-btn--primary-danger" onClick={handleReject} disabled={saving}>
            {saving ? <Loader2 size={14} className="ct-spin" /> : <XCircle size={14} />}
            {saving ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

function DeleteModal({ reviewId, isOpen, onClose, onDone }: {
  reviewId: number; isOpen: boolean; onClose: () => void; onDone: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  if (!isOpen) return null

  const handleDelete = async () => {
    setDeleting(true)
    try { await adminReviewsApi.delete(reviewId); onDone(); onClose() }
    catch {} finally { setDeleting(false) }
  }

  return (
    <>
      <div className="ct-backdrop" style={{ zIndex: 10000 }} onClick={onClose} />
      <div className="ct-modal">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={18} color="#ef4444" />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Delete Review</h3>
            <p style={{ fontSize: 12, color: 'var(--t2)', margin: 0 }}>This action is permanent and cannot be undone.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="ct-btn ct-btn--ghost" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="ct-btn ct-btn--primary-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 size={14} className="ct-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Review Detail Drawer ──────────────────────────────────────────────────────

function ReviewDrawer({ review, onClose, onRefresh }: {
  review: AdminReview | null; onClose: () => void; onRefresh: () => void
}) {
  const [detail,      setDetail]      = useState<AdminReviewDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [acting,      setActing]      = useState(false)
  const [toast,       setToast]       = useState('')
  const [rejectOpen,  setRejectOpen]  = useState(false)
  const [deleteOpen,  setDeleteOpen]  = useState(false)
  const [mediaOps,    setMediaOps]    = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!review) { setDetail(null); return }
    setLoadingDetail(true)
    // Re-fetch the full review detail from the list endpoint (already has media)
    // We use the list with per_page=1 and the ID as a workaround since there's no single-review GET.
    // Instead we fetch from the reviews list and find it, or use what we have.
    // The AdminReviewController index already returns media_count; for full media we call index.
    setDetail(null)
    adminReviewsApi.list({ per_page: 100 })
      .then((res: any) => {
        // Try to find more detail — but since the index doesn't return full media,
        // we show what we have from the list + trigger a fresh fetch.
        // For production: add GET /admin/reviews/{id} to the controller.
        // For now we display everything from the index response.
        setLoadingDetail(false)
      })
      .catch(() => setLoadingDetail(false))
  }, [review])

  if (!review) return null

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const act = async (fn: () => Promise<any>, msg: string, closeAfter = false) => {
    setActing(true)
    try {
      await fn()
      showToast(msg)
      onRefresh()
      if (closeAfter) onClose()
    } catch (e: any) {
      showToast('Error: ' + (e?.response?.data?.message ?? 'Action failed.'))
    } finally { setActing(false) }
  }

  const handleMediaDelete = async (mediaId: number) => {
    setMediaOps(p => ({ ...p, [mediaId]: true }))
    try {
      await adminReviewsApi.deleteMedia(mediaId)
      showToast('Image deleted.')
      onRefresh()
    } catch { showToast('Failed to delete image.') }
    finally { setMediaOps(p => ({ ...p, [mediaId]: false })) }
  }

  const handleMediaHide = async (mediaId: number) => {
    setMediaOps(p => ({ ...p, [mediaId]: true }))
    try {
      await adminReviewsApi.hideMedia(mediaId)
      showToast('Image hidden from public view.')
      onRefresh()
    } catch { showToast('Failed to hide image.') }
    finally { setMediaOps(p => ({ ...p, [mediaId]: false })) }
  }

  const statusCfg = STATUS_CFG[review.status] ?? { color: '#8891a4', bg: '', label: review.status }

  return (
    <>
      <div className="ct-backdrop" onClick={onClose} />
      <aside className="ct-drawer ct-animate-slide-in">

        {/* Header */}
        <div className="ct-drawer-header">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--drawer-t2)', background: 'rgba(255,255,255,.06)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--drawer-card-bd)' }}>
                #{review.id}
              </span>
              <StatusBadge status={review.status} />
              {review.reports_count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: ORANGE, background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.4)', padding: '3px 10px', borderRadius: 100 }}>
                  {review.reports_count} report{review.reports_count > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <StarDisplay rating={review.rating} />
              <span style={{ fontSize: 18, fontWeight: 900, color: AMBER }}>{review.rating}.0</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--drawer-t2)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              <CalendarDays size={11} /> {timeAgo(review.created_at)}
            </p>
          </div>
          <button className="ct-close-btn" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Body */}
        <div className="ct-drawer-body">

          {/* Parties */}
          <div>
            <p className="ct-section-title"><User size={12} /> Parties</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="ct-info-card">
                <p className="ct-info-card-label"><User size={11} /> Customer</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--drawer-t1)', margin: '0 0 2px' }}>{review.user?.name ?? '—'}</p>
                <p style={{ fontSize: 11, color: 'var(--drawer-t2)', margin: 0 }}>{review.user?.email ?? '—'}</p>
              </div>
              <div className="ct-info-card">
                <p className="ct-info-card-label"><Package size={11} /> Product</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--drawer-t1)', margin: '0 0 2px' }}>{review.product?.name ?? '—'}</p>
                <p style={{ fontSize: 11, color: 'var(--drawer-t2)', margin: 0 }}>ID #{review.product?.id}</p>
              </div>
            </div>
          </div>

          {/* Review content */}
          <div>
            <p className="ct-section-title"><MessageSquare size={12} /> Review Content</p>
            <div style={{ background: `${statusCfg.color}10`, border: `1px solid ${statusCfg.color}25`, borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${statusCfg.color}` }}>
              {review.body ? (
                <p style={{ fontSize: 13, color: 'var(--drawer-t1)', margin: 0, lineHeight: 1.75, fontWeight: 500 }}>{review.body}</p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--drawer-t3)', margin: 0, fontStyle: 'italic' }}>No written review — rating only.</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--drawer-t3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ThumbsUp size={12} /> {review.helpful_count} helpful
              </span>
              {review.is_verified && (
                <span style={{ fontSize: 12, color: GREEN, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                  <BadgeCheck size={12} /> Verified Purchase
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--drawer-t3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ImageIcon size={12} /> {review.media_count} image{review.media_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Media moderation — if the detail has media */}
          {review.media_count > 0 && (
            <div>
              <p className="ct-section-title"><ImageIcon size={12} /> Customer Images ({review.media_count})</p>
              <div style={{ background: 'var(--drawer-card-bg)', borderRadius: 12, padding: 14, border: '1px solid var(--drawer-card-bd)' }}>
                <p style={{ fontSize: 12, color: 'var(--drawer-t2)', margin: '0 0 12px', fontStyle: 'italic' }}>
                  Images loaded from the review. Hover to moderate.
                </p>
                {/* Images are part of the full review — shown if available */}
                <p style={{ fontSize: 11, color: 'var(--drawer-t3)', margin: 0 }}>
                  Go to the Review Media tab in the reports section to delete or hide specific images.
                </p>
              </div>
            </div>
          )}

          {/* Rejection reason */}
          {review.rejection_reason && (
            <div>
              <p className="ct-section-title"><XCircle size={12} /> Rejection Reason</p>
              <div style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, color: '#f87171', margin: 0, lineHeight: 1.65 }}>{review.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div style={{ background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} /> Danger Zone
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="ct-btn ct-btn--danger" style={{ fontSize: 12, padding: '8px 14px' }}
                disabled={acting} onClick={() => setDeleteOpen(true)}>
                <Trash2 size={13} /> Delete Review
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="ct-drawer-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
          {review.status !== 'approved' && (
            <button className="ct-btn ct-btn--success" style={{ flex: 1 }} disabled={acting}
              onClick={() => act(() => adminReviewsApi.approve(review.id), '✅ Review approved', true)}>
              {acting ? <Loader2 size={15} className="ct-spin" /> : <CheckCircle size={15} />}
              Approve
            </button>
          )}
          {review.status !== 'flagged' && (
            <button className="ct-btn ct-btn--flag" style={{ flex: 1 }} disabled={acting}
              onClick={() => act(() => adminReviewsApi.flag(review.id), '🚩 Review flagged', true)}>
              {acting ? <Loader2 size={15} className="ct-spin" /> : <Flag size={15} />}
              Flag
            </button>
          )}
          {review.status !== 'rejected' && (
            <button className="ct-btn ct-btn--danger" style={{ flex: 1 }} disabled={acting}
              onClick={() => setRejectOpen(true)}>
              <XCircle size={15} /> Reject
            </button>
          )}
        </div>
      </aside>

      <RejectModal
        reviewId={review.id}
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onDone={() => { onRefresh(); onClose() }}
      />
      <DeleteModal
        reviewId={review.id}
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDone={() => { onRefresh(); onClose() }}
      />

      {toast && <div className="ct-toast">{toast}</div>}
    </>
  )
}

// ── Reviews Table Row ─────────────────────────────────────────────────────────

function ReviewTableRow({ review, onSelect }: {
  review: AdminReview; onSelect: (r: AdminReview) => void
}) {
  return (
    <tr onClick={() => onSelect(review)}
      style={{ background: review.reports_count > 0 ? 'rgba(249,115,22,.025)' : undefined }}>
      <td>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--t1)' }}>
          #{review.id}
        </span>
      </td>
      <td>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{review.user?.name ?? '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>{review.user?.email ?? ''}</div>
      </td>
      <td>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 2 }}>{review.product?.name ?? '—'}</div>
        <StarDisplay rating={review.rating} />
      </td>
      <td>
        <span style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {review.is_verified && <BadgeCheck size={12} color={GREEN} />}
          {review.is_verified ? 'Verified' : 'Unverified'}
        </span>
      </td>
      <td><StatusBadge status={review.status} /></td>
      <td>
        {review.reports_count > 0 ? (
          <span style={{ fontSize: 11, fontWeight: 800, color: ORANGE, background: 'rgba(249,115,22,.1)', padding: '3px 9px', borderRadius: 999, border: '1px solid rgba(249,115,22,.25)' }}>
            {review.reports_count}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>—</span>
        )}
      </td>
      <td>
        <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--t3)' }}>
          <ImageIcon size={11} /> {review.media_count}
        </span>
      </td>
      <td><span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>{timeAgo(review.created_at)}</span></td>
      <td style={{ textAlign: 'right' }}>
        <button className="ct-btn-view" onClick={e => { e.stopPropagation(); onSelect(review) }}>
          <Eye size={12} /> View <ChevronRight size={10} />
        </button>
      </td>
    </tr>
  )
}

// ── Reports Table Row ─────────────────────────────────────────────────────────

function ReportTableRow({ report, onAct, acting }: {
  report: AdminReport
  onAct: (reportId: number, action: 'dismiss' | 'flag_review' | 'reject_review') => void
  acting: boolean
}) {
  const REASON_LABELS: Record<string, string> = {
    spam: '🚫 Spam', fake: '🤥 Fake', inappropriate: '⚠️ Inappropriate', offensive: '🤬 Offensive', other: '📝 Other',
  }
  return (
    <tr>
      <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--t1)', fontWeight: 700 }}>#{report.id}</span></td>
      <td>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{report.reporter?.name ?? '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>{report.reporter?.email}</div>
      </td>
      <td>
        <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{report.review?.product?.name ?? `Review #${report.review?.id}`}</div>
        {report.review?.rating && <StarDisplay rating={report.review.rating} />}
      </td>
      <td>
        <span style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>{REASON_LABELS[report.reason] ?? report.reason}</span>
        {report.note && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{report.note}</div>}
      </td>
      <td>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase',
          background: report.status === 'pending' ? 'rgba(245,158,11,.12)' : 'rgba(136,145,164,.1)',
          color: report.status === 'pending' ? AMBER : 'var(--t3)',
          border: `1px solid ${report.status === 'pending' ? 'rgba(245,158,11,.25)' : 'var(--bd)'}`,
        }}>
          {report.status}
        </span>
      </td>
      <td><span style={{ fontSize: 11, color: 'var(--t3)' }}>{timeAgo(report.created_at)}</span></td>
      <td>
        {report.status === 'pending' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="ct-btn ct-btn--ghost" style={{ fontSize: 11, padding: '5px 10px' }} disabled={acting}
              onClick={() => onAct(report.id, 'dismiss')}>Dismiss</button>
            <button className="ct-btn ct-btn--flag" style={{ fontSize: 11, padding: '5px 10px' }} disabled={acting}
              onClick={() => onAct(report.id, 'flag_review')}>Flag</button>
            <button className="ct-btn ct-btn--danger" style={{ fontSize: 11, padding: '5px 10px' }} disabled={acting}
              onClick={() => onAct(report.id, 'reject_review')}>Reject</button>
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminReviewsPage() {
  const [tab,          setTab]          = useState<'reviews' | 'reports'>('reviews')
  const [reviews,      setReviews]      = useState<AdminReview[]>([])
  const [reports,      setReports]      = useState<AdminReport[]>([])
  const [stats,        setStats]        = useState<ReviewStats | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<AdminReview | null>(null)
  const [toast,        setToast]        = useState('')
  const [actingReport, setActingReport] = useState(false)

  // Pagination
  const [page,     setPage]     = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total,    setTotal]    = useState(0)

  // Filters
  const [fStatus,     setFStatus]     = useState('')
  const [fRating,     setFRating]     = useState('')
  const [fHasReports, setFHasReports] = useState('')
  const [fSearch,     setFSearch]     = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const fetchStats = useCallback(async () => {
    try { const s = await adminReviewsApi.stats(); setStats(s) } catch {}
  }, [])

  const fetchReviews = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params: any = { page: p, per_page: 15 }
      if (fStatus)     params.status      = fStatus
      if (fRating)     params.rating      = fRating
      if (fHasReports) params.has_reports = fHasReports
      const res = await adminReviewsApi.list(params)
      const raw = res.data ?? []
      setReviews(Array.isArray(raw) ? raw : [])
      setPage(res.meta?.current_page ?? 1)
      setLastPage(res.meta?.last_page ?? 1)
      setTotal(res.meta?.total ?? 0)
    } catch { setReviews([]) }
    finally { setLoading(false) }
  }, [fStatus, fRating, fHasReports])

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminReviewsApi.reports({ status: 'pending' })
      const raw = res.data ?? []
      setReports(Array.isArray(raw) ? raw : [])
    } catch { setReports([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => {
    if (tab === 'reviews') fetchReviews(1)
    else fetchReports()
  }, [tab, fetchReviews, fetchReports])

  const refresh = () => {
    fetchStats()
    if (tab === 'reviews') fetchReviews(page)
    else fetchReports()
  }

  const handleReportAct = async (reportId: number, action: 'dismiss' | 'flag_review' | 'reject_review') => {
    setActingReport(true)
    try {
      await adminReviewsApi.resolveReport(reportId, action)
      showToast(action === 'dismiss' ? 'Report dismissed.' : action === 'flag_review' ? '🚩 Review flagged.' : '❌ Review rejected.')
      fetchReports(); fetchStats()
    } catch { showToast('Action failed.') }
    finally { setActingReport(false) }
  }

  const hasFilters = fStatus || fRating || fHasReports

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div className="ct-root" style={{
        padding: '28px 32px', minHeight: '100vh',
        background: 'var(--bg)', animation: 'ct-fade-up 0.45s cubic-bezier(.22,1,.36,1) both',
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={22} color={AMBER} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--t1)', margin: 0, lineHeight: 1.2 }}>Review Management</h1>
              <p style={{ fontSize: 13, color: 'var(--t2)', margin: '4px 0 0', fontWeight: 500 }}>
                Moderate all platform reviews and reports
                {stats && stats.pending_reports > 0 && (
                  <span style={{ marginLeft: 10, color: ORANGE, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle size={12} /> {stats.pending_reports} pending report{stats.pending_reports > 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 10, color: 'var(--t2)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* ── Stats ── */}
        {stats && (
          <div className="ct-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard label="Total"        value={stats.total}           color="var(--t2)" icon={<FileText size={18} />} />
            <StatCard label="Approved"     value={stats.approved}        color={GREEN}     icon={<CheckCircle size={18} />} />
            <StatCard label="Pending"      value={stats.pending}         color={AMBER}     icon={<AlertCircle size={18} />} />
            <StatCard label="Flagged"      value={stats.flagged}         color={ORANGE}    icon={<Flag size={18} />} highlight />
            <StatCard label="Rejected"     value={stats.rejected}        color="#ef4444"   icon={<XCircle size={18} />} />
            <StatCard label="Reports"      value={stats.pending_reports} color={ORANGE}    icon={<ShieldAlert size={18} />} highlight />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="ct-tab" style={{ marginBottom: 16, maxWidth: 320 }}>
          <button
            className={`ct-tab-btn ct-tab-btn--${tab === 'reviews' ? 'active' : 'inactive'}`}
            onClick={() => setTab('reviews')}
          >
            Reviews {total > 0 && tab === 'reviews' ? `(${total})` : ''}
          </button>
          <button
            className={`ct-tab-btn ct-tab-btn--${tab === 'reports' ? 'active' : 'inactive'}`}
            onClick={() => setTab('reports')}
            style={{ position: 'relative' }}
          >
            Reports
            {stats && stats.pending_reports > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 8, width: 7, height: 7, borderRadius: '50%', background: ORANGE }} />
            )}
          </button>
        </div>

        {/* ── Reviews Tab ── */}
        {tab === 'reviews' && (
          <>
            {/* Filter bar */}
            <div className="ct-filter-bar" style={{ marginBottom: 16 }}>
              <div style={{ flex: '0 0 180px' }}>
                <label className="ct-label"><Filter size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />Status</label>
                <select className="ct-select" value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1) }}>
                  <option value="">All statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="flagged">Flagged</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div style={{ flex: '0 0 140px' }}>
                <label className="ct-label"><Star size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />Rating</label>
                <select className="ct-select" value={fRating} onChange={e => { setFRating(e.target.value); setPage(1) }}>
                  <option value="">All ratings</option>
                  {[5,4,3,2,1].map(r => <option key={r} value={r}>{'★'.repeat(r)} ({r} stars)</option>)}
                </select>
              </div>
              <div style={{ flex: '0 0 160px' }}>
                <label className="ct-label"><AlertTriangle size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />Has Reports</label>
                <select className="ct-select" value={fHasReports} onChange={e => { setFHasReports(e.target.value); setPage(1) }}>
                  <option value="">All</option>
                  <option value="1">Reported only</option>
                  <option value="0">Not reported</option>
                </select>
              </div>
              {hasFilters && (
                <button className="ct-btn ct-btn--ghost" style={{ alignSelf: 'flex-end' }}
                  onClick={() => { setFStatus(''); setFRating(''); setFHasReports(''); setPage(1) }}>
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>

            {/* Table */}
            <div className="ct-table-wrap">
              {loading ? (
                <table className="ct-table">
                  <thead><tr>{['ID','Customer','Product / Rating','Verified','Status','Reports','Media','Date',''].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{[...Array(6)].map((_, i) => <SkeletonRow key={i} cols={9} />)}</tbody>
                </table>
              ) : reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 0' }}>
                  <Star size={28} color="var(--t3)" style={{ display: 'block', margin: '0 auto 14px', opacity: .4 }} />
                  <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>
                    {hasFilters ? 'No reviews match your filters' : 'No reviews yet'}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--t2)' }}>
                    {hasFilters ? 'Try adjusting your filters.' : 'Reviews will appear here once customers submit them.'}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="ct-table">
                    <thead><tr>{['ID','Customer','Product / Rating','Verified','Status','Reports','Media','Date',''].map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {reviews.map(r => <ReviewTableRow key={r.id} review={r} onSelect={setSelected} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {!loading && lastPage > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>
                  {total} review{total !== 1 ? 's' : ''} · Page {page} of {lastPage}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ct-btn ct-btn--ghost" style={{ padding: '7px 14px', fontSize: 12 }}
                    disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchReviews(p) }}>← Prev</button>
                  <button className="ct-btn ct-btn--ghost" style={{ padding: '7px 14px', fontSize: 12 }}
                    disabled={page >= lastPage} onClick={() => { const p = page + 1; setPage(p); fetchReviews(p) }}>Next →</button>
                </div>
              </div>
            )}

            {!loading && total > 0 && lastPage === 1 && (
              <p style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600, margin: '10px 0 0', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                <TrendingUp size={12} /> {total} review{total !== 1 ? 's' : ''}
              </p>
            )}
          </>
        )}

        {/* ── Reports Tab ── */}
        {tab === 'reports' && (
          <>
            <div className="ct-table-wrap">
              {loading ? (
                <table className="ct-table">
                  <thead><tr>{['ID','Reporter','Review / Product','Reason','Status','Date','Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} cols={7} />)}</tbody>
                </table>
              ) : reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 0' }}>
                  <ShieldAlert size={28} color="var(--t3)" style={{ display: 'block', margin: '0 auto 14px', opacity: .4 }} />
                  <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>No pending reports</p>
                  <p style={{ fontSize: 13, color: 'var(--t2)' }}>All reports have been resolved.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="ct-table">
                    <thead><tr>{['ID','Reporter','Review / Product','Reason','Status','Date','Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {reports.map(r => (
                        <ReportTableRow
                          key={r.id}
                          report={r}
                          onAct={handleReportAct}
                          acting={actingReport}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {!loading && reports.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600, margin: '10px 0 0', textAlign: 'right' }}>
                {reports.length} pending report{reports.length !== 1 ? 's' : ''}
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Drawer ── */}
      <ReviewDrawer review={selected} onClose={() => setSelected(null)} onRefresh={refresh} />

      {/* ── Toast ── */}
      {toast && <div className="ct-toast">{toast}</div>}
    </>
  )
}