'use client'

/**
 * FILE: app/vip-requests/page.tsx  (Admin Panel — port 3001)
 *
 * FIX: Removed standalone full-viewport wrapper that was fighting the layout.
 * The page now renders inside the existing sidebar layout exactly like
 * complaints/page.tsx — no background override, no full-screen takeover.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Crown, Clock, CheckCircle, XCircle, Loader2,
  Search, Eye, RefreshCw, ChevronRight, FileText,
  RotateCcw, User, CalendarDays, MessageSquare, X,
  AlertCircle, Filter, Zap, Star, Headphones,
  PlayCircle, Megaphone, StickyNote, ArrowRight,
  TrendingUp,
} from 'lucide-react'
import {
  adminVipRequestApi,
  type VipRequest,
  type VipRequestStats,
  type VipRequestStatus,
  type VipRequestType,
} from '@/lib/vipRequestApi'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const RED    = '#db142e'
const GREEN  = '#198f41'
const GOLD   = '#f59e0b'
const PURPLE = '#8b5cf6'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<VipRequestStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: GOLD,      bg: 'rgba(245,158,11,0.12)'  },
  in_progress: { label: 'In Progress', color: PURPLE,    bg: 'rgba(139,92,246,0.12)' },
  completed:   { label: 'Completed',   color: GREEN,     bg: 'rgba(25,143,65,0.12)'  },
  rejected:    { label: 'Rejected',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
}

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<VipRequestType, { label: string; color: string; icon: React.ReactNode }> = {
  reel:      { label: 'Reel',        color: RED,    icon: <PlayCircle  size={13} /> },
  promotion: { label: 'Promotion',   color: GOLD,   icon: <Megaphone   size={13} /> },
  support:   { label: 'VIP Support', color: PURPLE, icon: <Headphones  size={13} /> },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Scoped CSS (vip- prefix to avoid any conflict with layout styles) ─────────
const PAGE_CSS = `
  .vip-stat {
    background: #161a22;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: border-color .2s, transform .2s;
    cursor: default;
    position: relative;
    overflow: hidden;
  }
  .vip-stat::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,.025) 0%, transparent 60%);
    pointer-events: none;
  }
  .vip-stat:hover { transform: translateY(-2px); }
  .vip-stat--gold { border-color: rgba(245,158,11,.3); }

  .vip-icon-bubble {
    width: 42px; height: 42px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .vip-table-wrap {
    background: #161a22;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    overflow: hidden;
  }
  .vip-table { width: 100%; border-collapse: collapse; }
  .vip-table th {
    padding: 11px 16px;
    font-size: 10px; font-weight: 800;
    color: #4e5668;
    text-align: left; text-transform: uppercase; letter-spacing: .08em;
    white-space: nowrap;
    background: #0a0c10;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .vip-table tr { transition: background .15s; cursor: pointer; }
  .vip-table tr:hover td { background: rgba(255,255,255,.025); }
  .vip-table td {
    padding: 13px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    vertical-align: middle;
    transition: background .15s;
  }
  .vip-table tr:last-child td { border-bottom: none; }

  .vip-btn-view {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 14px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: #8891a4;
    font-size: 12px; font-weight: 700;
    font-family: inherit; cursor: pointer;
    transition: background .15s, color .15s, transform .1s;
  }
  .vip-btn-view:hover {
    background: rgba(255,255,255,.06);
    color: #f0f2f7;
    transform: translateX(1px);
  }

  .vip-filter-bar {
    background: #161a22;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 16px 20px;
    display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end;
  }
  .vip-input {
    background: #0a0c10;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    color: #f0f2f7;
    font-family: inherit; font-size: 13px;
    padding: 9px 14px; outline: none; width: 100%;
    transition: border-color .2s, box-shadow .2s;
  }
  .vip-input:focus {
    border-color: rgba(219,20,46,.5);
    box-shadow: 0 0 0 3px rgba(219,20,46,.08);
  }
  .vip-input::placeholder { color: #4e5668; }
  .vip-select {
    background: #0a0c10;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    color: #f0f2f7;
    font-family: inherit; font-size: 13px;
    padding: 9px 14px; outline: none;
    cursor: pointer; width: 100%;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234e5668' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 34px;
    transition: border-color .2s;
  }
  .vip-select:focus { border-color: rgba(219,20,46,.5); }
  .vip-select option { background: #161a22; }
  .vip-label {
    font-size: 10px; font-weight: 800;
    color: #4e5668;
    text-transform: uppercase; letter-spacing: .08em;
    display: block; margin-bottom: 6px;
  }

  .vip-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 11px 18px; border-radius: 10px;
    font-family: inherit; font-size: 13px; font-weight: 700;
    border: none; cursor: pointer;
    transition: opacity .15s, transform .1s, filter .15s;
  }
  .vip-btn:active:not(:disabled) { transform: scale(0.97); }
  .vip-btn:disabled { opacity: .45; cursor: not-allowed; }
  .vip-btn--ghost   { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,0.1); color: #8891a4; }
  .vip-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,.08); color: #f0f2f7; }
  .vip-btn--danger  { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25); color: #f87171; }
  .vip-btn--danger:hover:not(:disabled) { background: rgba(239,68,68,.18); }
  .vip-btn--success { background: rgba(25,143,65,.15); border: 1px solid rgba(25,143,65,.35); color: #4ade80; }
  .vip-btn--success:hover:not(:disabled) { background: rgba(25,143,65,.25); color: #86efac; }
  .vip-btn--gold    { background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.3); color: #fbbf24; }
  .vip-btn--gold:hover:not(:disabled) { background: rgba(245,158,11,.22); }
  .vip-btn--purple  { background: rgba(139,92,246,.12); border: 1px solid rgba(139,92,246,.3); color: #a78bfa; }
  .vip-btn--purple:hover:not(:disabled) { background: rgba(139,92,246,.22); }
  .vip-btn--primary-danger { background: #ef4444; color: #fff; }
  .vip-btn--primary-danger:hover:not(:disabled) { filter: brightness(1.1); }

  /* Drawer */
  .vip-drawer {
    position: fixed; top: 0; right: 0; bottom: 0;
    width: 100%; max-width: 600px;
    background: #1e2330;
    border-left: 2px solid rgba(219,20,46,.25);
    box-shadow: -32px 0 96px rgba(0,0,0,.75);
    z-index: 9001;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .vip-drawer-header {
    padding: 22px 26px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.14);
    background: #242838;
    display: flex; align-items: flex-start; justify-content: space-between;
  }
  .vip-drawer-body {
    flex: 1; overflow-y: auto;
    padding: 22px 26px;
    display: flex; flex-direction: column; gap: 18px;
    background: #1e2330;
  }
  .vip-drawer-body::-webkit-scrollbar { width: 4px; }
  .vip-drawer-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 2px; }
  .vip-drawer-footer {
    padding: 16px 26px;
    border-top: 1px solid rgba(255,255,255,0.14);
    background: #242838;
    display: flex; gap: 10px;
  }
  .vip-info-card {
    background: #323b52;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 12px; padding: 16px 18px;
    box-shadow: 0 2px 12px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.07);
  }
  .vip-info-card-label {
    font-size: 10px; font-weight: 800;
    color: #6e7d9e;
    text-transform: uppercase; letter-spacing: .08em;
    margin: 0 0 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .vip-close-btn {
    width: 32px; height: 32px; border-radius: 8px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,0.14);
    color: #b0bbd4;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .15s, color .15s; flex-shrink: 0;
  }
  .vip-close-btn:hover { background: rgba(255,255,255,.12); color: #f4f6fc; }
  .vip-section-title {
    font-size: 11px; font-weight: 800;
    color: #6e7d9e;
    text-transform: uppercase; letter-spacing: .08em;
    margin: 0 0 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .vip-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.6);
    backdrop-filter: blur(3px);
    z-index: 9000;
  }
  .vip-modal {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 100%; max-width: 480px;
    background: #161a22;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px; padding: 28px;
    z-index: 10001;
    box-shadow: 0 40px 100px rgba(0,0,0,.6);
  }
  .vip-toast {
    position: fixed; bottom: 28px; left: 50%;
    transform: translateX(-50%);
    background: #161a22;
    border: 1px solid rgba(255,255,255,0.1);
    color: #f0f2f7;
    padding: 10px 20px; border-radius: 100px;
    font-size: 13px; font-weight: 600;
    z-index: 99999;
    box-shadow: 0 12px 40px rgba(0,0,0,.5);
    white-space: nowrap;
  }
  .vip-skeleton {
    background: #1c2130; border-radius: 6px;
    position: relative; overflow: hidden;
  }
  .vip-skeleton::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.04) 50%, transparent 100%);
    animation: vip-shimmer 1.5s infinite;
  }
  .vip-textarea {
    background: #0a0c10;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    color: #f0f2f7;
    font-family: inherit; font-size: 13px;
    padding: 9px 14px; outline: none;
    resize: vertical; line-height: 1.6; width: 100%;
    transition: border-color .2s, box-shadow .2s;
  }
  .vip-textarea:focus {
    border-color: rgba(219,20,46,.5);
    box-shadow: 0 0 0 3px rgba(219,20,46,.08);
  }
  .vip-textarea::placeholder { color: #4e5668; }

  @keyframes vip-shimmer { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
  @keyframes vip-slide-in { from{transform:translateX(100%)} to{transform:translateX(0)} }
  @keyframes vip-slide-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes vip-spin     { to{transform:rotate(360deg)} }

  .vip-animate-slide-in { animation: vip-slide-in 0.3s cubic-bezier(.22,1,.36,1) both; }
  .vip-animate-slide-up { animation: vip-slide-up 0.25s cubic-bezier(.22,1,.36,1) both; }
  .vip-spin             { animation: vip-spin 0.9s linear infinite; }
`

// ── Badges ────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: VipRequestStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 100,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}28`,
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function TypeBadge({ type }: { type: VipRequestType }) {
  const cfg = TYPE_CONFIG[type]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
      background: `${cfg.color}14`, color: cfg.color,
      border: `1px solid ${cfg.color}25`, whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, highlight }: {
  label: string; value: number; color: string; icon: React.ReactNode; highlight?: boolean
}) {
  return (
    <div className={`vip-stat${highlight && value > 0 ? ' vip-stat--gold' : ''}`}>
      <div className="vip-icon-bubble" style={{ background: `${color}18` }}>
        <span style={{ color, display: 'flex' }}>{icon}</span>
      </div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 900, color, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </p>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#4e5668', textTransform: 'uppercase', letterSpacing: '.07em', margin: '5px 0 0' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ requestId, isOpen, onClose, onRejected }: {
  requestId: number; isOpen: boolean; onClose: () => void; onRejected: () => void
}) {
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => { if (isOpen) { setNote(''); setError('') } }, [isOpen])
  if (!isOpen) return null

  const handleReject = async () => {
    if (note.trim().length < 5) { setError('Please provide a reason (min 5 characters).'); return }
    setSaving(true)
    try {
      await adminVipRequestApi.reject(requestId, note.trim())
      onRejected(); onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to reject.')
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="vip-backdrop" style={{ zIndex: 10000 }} onClick={onClose} />
      <div className="vip-modal vip-animate-slide-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={18} color="#ef4444" />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: '#f0f2f7', margin: 0 }}>Reject VIP Request</h3>
            <p style={{ fontSize: 12, color: '#8891a4', margin: 0 }}>Seller will see your note</p>
          </div>
        </div>
        <textarea className="vip-textarea" rows={4}
          placeholder="Explain why this request cannot be fulfilled…"
          value={note} onChange={e => { setNote(e.target.value); setError('') }}
          style={{ borderColor: error ? '#ef4444' : undefined }} />
        {error && (
          <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertCircle size={12} /> {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="vip-btn vip-btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="vip-btn vip-btn--primary-danger" onClick={handleReject} disabled={saving}>
            {saving ? <Loader2 size={14} className="vip-spin" /> : <XCircle size={14} />}
            {saving ? 'Rejecting…' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function VipRequestDrawer({ request, onClose, onRefresh }: {
  request: VipRequest | null; onClose: () => void; onRefresh: () => void
}) {
  const [rejectModal, setRejectModal] = useState(false)
  const [noteEdit,    setNoteEdit]    = useState(false)
  const [noteText,    setNoteText]    = useState('')
  const [acting,      setActing]      = useState(false)
  const [toast,       setToast]       = useState('')

  useEffect(() => { if (request) setNoteText(request.admin_note ?? '') }, [request])
  if (!request) return null

  const isTerminal = request.status === 'completed' || request.status === 'rejected'
  const isPending  = request.status === 'pending'
  const isProgress = request.status === 'in_progress'
  const typeCfg    = TYPE_CONFIG[request.type]

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const act = async (action: () => Promise<any>, successMsg: string) => {
    setActing(true)
    try {
      await action()
      showToast(successMsg)
      onRefresh(); onClose()
    } catch (err: any) {
      showToast('Error: ' + (err?.response?.data?.message ?? 'Action failed.'))
    } finally { setActing(false) }
  }

  const saveNote = async () => {
    if (!noteText.trim()) return
    setActing(true)
    try {
      await adminVipRequestApi.addNote(request.id, noteText.trim())
      showToast('✅ Note saved')
      setNoteEdit(false)
      onRefresh()
    } catch { showToast('Failed to save note') }
    finally { setActing(false) }
  }

  return (
    <>
      <div className="vip-backdrop" onClick={onClose} />
      <aside className="vip-drawer vip-animate-slide-in">

        {/* Header */}
        <div className="vip-drawer-header">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#b0bbd4', background: 'rgba(255,255,255,.06)', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.18)' }}>
                #{request.id}
              </span>
              <TypeBadge type={request.type} />
              <StatusBadge status={request.status} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#f4f6fc', margin: 0, lineHeight: 1.3 }}>
              {request.type_label}
            </h2>
            <p style={{ fontSize: 12, color: '#b0bbd4', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CalendarDays size={11} /> {timeAgo(request.created_at)}
              {request.handler && (
                <span style={{ marginLeft: 8, color: '#6e7d9e' }}>
                  · Handled by <strong style={{ color: '#b0bbd4' }}>{request.handler.name}</strong>
                </span>
              )}
            </p>
          </div>
          <button className="vip-close-btn" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Body */}
        <div className="vip-drawer-body">

          {/* Seller */}
          <div>
            <p className="vip-section-title"><User size={12} /> Black Pepper Seller</p>
            <div className="vip-info-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 14px rgba(245,158,11,.35)',
                fontWeight: 900, fontSize: 18, color: '#fff',
              }}>
                {request.seller?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#f4f6fc', margin: '0 0 2px' }}>{request.seller?.name ?? '—'}</p>
                <p style={{ fontSize: 12, color: '#b0bbd4', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{request.seller?.email ?? '—'}</p>
              </div>
              <span style={{
                marginLeft: 'auto', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 800, color: GOLD,
                background: 'rgba(245,158,11,.12)', padding: '3px 10px', borderRadius: 100,
                border: '1px solid rgba(245,158,11,.25)',
              }}>⬛ Black</span>
            </div>
          </div>

          {/* Request message */}
          <div>
            <p className="vip-section-title"><MessageSquare size={12} /> Request Details</p>
            <div style={{
              background: `${typeCfg.color}10`,
              border: `1px solid ${typeCfg.color}28`,
              borderLeft: `3px solid ${typeCfg.color}`,
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ color: typeCfg.color, display: 'flex' }}>{typeCfg.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: typeCfg.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>{typeCfg.label}</span>
              </div>
              <p style={{ fontSize: 13, color: '#f4f6fc', margin: 0, lineHeight: 1.75, fontWeight: 500 }}>{request.message}</p>
            </div>
          </div>

          {/* Admin note */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p className="vip-section-title" style={{ margin: 0 }}><StickyNote size={12} /> Internal Note</p>
              {!noteEdit && (
                <button onClick={() => setNoteEdit(true)}
                  style={{ fontSize: 11, fontWeight: 700, color: PURPLE, background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.25)', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {request.admin_note ? 'Edit' : '+ Add Note'}
                </button>
              )}
            </div>
            {noteEdit ? (
              <div>
                <textarea className="vip-textarea" rows={3}
                  placeholder="Add an internal note (visible to admins only)…"
                  value={noteText} onChange={e => setNoteText(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="vip-btn vip-btn--ghost" style={{ flex: 1, padding: '8px 12px', fontSize: 12 }} onClick={() => setNoteEdit(false)} disabled={acting}>Cancel</button>
                  <button className="vip-btn vip-btn--purple" style={{ flex: 1, padding: '8px 12px', fontSize: 12 }} onClick={saveNote} disabled={acting || !noteText.trim()}>
                    {acting ? <Loader2 size={12} className="vip-spin" /> : <StickyNote size={12} />}
                    Save Note
                  </button>
                </div>
              </div>
            ) : request.admin_note ? (
              <div className="vip-info-card">
                <p style={{ fontSize: 13, color: '#f4f6fc', margin: 0, lineHeight: 1.75, fontWeight: 500 }}>{request.admin_note}</p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#6e7d9e', fontStyle: 'italic', margin: 0 }}>No note added yet.</p>
            )}
          </div>

          {/* Timeline */}
          <div>
            <p className="vip-section-title"><CalendarDays size={12} /> Timeline</p>
            <div className="vip-info-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6e7d9e', fontWeight: 600 }}>Submitted</span>
                <span style={{ fontSize: 12, color: '#f4f6fc', fontWeight: 700 }}>
                  {new Date(request.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {request.handled_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#6e7d9e', fontWeight: 600 }}>Last updated</span>
                  <span style={{ fontSize: 12, color: '#f4f6fc', fontWeight: 700 }}>
                    {new Date(request.handled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Terminal state */}
          {isTerminal && (
            <div style={{
              background: request.status === 'completed' ? 'rgba(25,143,65,.07)' : 'rgba(239,68,68,.07)',
              border: `1px solid ${request.status === 'completed' ? 'rgba(25,143,65,.25)' : 'rgba(239,68,68,.25)'}`,
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              {request.status === 'completed'
                ? <CheckCircle size={18} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
                : <XCircle    size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />}
              <p style={{ fontSize: 13, fontWeight: 800, color: request.status === 'completed' ? GREEN : '#ef4444', margin: 0 }}>
                {request.status === 'completed' ? 'Request completed' : 'Request rejected'}
                {request.admin_note && ` — ${request.admin_note}`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isTerminal && (
          <div className="vip-drawer-footer">
            {isPending && (
              <>
                <button className="vip-btn vip-btn--danger" style={{ flex: 1 }} disabled={acting} onClick={() => setRejectModal(true)}>
                  <XCircle size={15} /> Reject
                </button>
                <button className="vip-btn vip-btn--gold" style={{ flex: 1 }} disabled={acting}
                  onClick={() => act(() => adminVipRequestApi.approve(request.id), '✅ Marked as in progress')}>
                  {acting ? <Loader2 size={15} className="vip-spin" /> : <ArrowRight size={15} />}
                  {acting ? 'Working…' : 'Start Processing'}
                </button>
              </>
            )}
            {isProgress && (
              <>
                <button className="vip-btn vip-btn--danger" style={{ flex: 1 }} disabled={acting} onClick={() => setRejectModal(true)}>
                  <XCircle size={15} /> Reject
                </button>
                <button className="vip-btn vip-btn--success" style={{ flex: 1 }} disabled={acting}
                  onClick={() => act(() => adminVipRequestApi.complete(request.id, noteText || undefined), '🎉 Request completed!')}>
                  {acting ? <Loader2 size={15} className="vip-spin" /> : <CheckCircle size={15} />}
                  {acting ? 'Completing…' : 'Mark Completed'}
                </button>
              </>
            )}
          </div>
        )}
      </aside>

      <RejectModal requestId={request.id} isOpen={rejectModal}
        onClose={() => setRejectModal(false)}
        onRejected={() => { onRefresh(); onClose() }} />

      {toast && <div className="vip-toast">{toast}</div>}
    </>
  )
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function VipRequestRow({ request, onSelect }: {
  request: VipRequest; onSelect: (r: VipRequest) => void
}) {
  return (
    <tr onClick={() => onSelect(request)}>
      <td>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#f0f2f7' }}>#{request.id}</span>
      </td>
      <td>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f7', marginBottom: 2 }}>{request.seller?.name ?? '—'}</div>
        <div style={{ fontSize: 11, color: '#4e5668' }}>{request.seller?.email ?? ''}</div>
      </td>
      <td><TypeBadge type={request.type} /></td>
      <td>
        <p style={{ fontSize: 12, color: '#8891a4', margin: 0, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {request.message}
        </p>
      </td>
      <td><StatusBadge status={request.status} /></td>
      <td>
        <span style={{ fontSize: 11, color: '#4e5668', fontWeight: 600 }}>{timeAgo(request.created_at)}</span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <button className="vip-btn-view" onClick={e => { e.stopPropagation(); onSelect(request) }}>
          <Eye size={12} /> View <ChevronRight size={10} />
        </button>
      </td>
    </tr>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[40, 140, 90, 200, 80, 60, 60].map((w, i) => (
        <td key={i} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="vip-skeleton" style={{ height: 14, width: w }} />
        </td>
      ))}
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminVipRequestsPage() {
  const [requests,     setRequests]     = useState<VipRequest[]>([])
  const [stats,        setStats]        = useState<VipRequestStats | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<VipRequest | null>(null)
  const [filterStatus, setFilterStatus] = useState<VipRequestStatus | ''>('')
  const [filterType,   setFilterType]   = useState<VipRequestType | ''>('')
  const [filterSearch, setFilterSearch] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterStatus) params.status = filterStatus
      if (filterType)   params.type   = filterType
      if (filterSearch) params.search = filterSearch

      const [listRes, statsRes] = await Promise.all([
        adminVipRequestApi.getAll(params),
        adminVipRequestApi.stats(),
      ])

      const raw = listRes.data ?? []
      setRequests(Array.isArray(raw) ? raw : [])
      setStats(statsRes.data)
    } catch { setRequests([]) }
    finally { setLoading(false) }
  }, [filterStatus, filterType, filterSearch])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSelectFresh = async (r: VipRequest) => {
    try {
      const res = await adminVipRequestApi.getOne(r.id)
      setSelected(res.data)
    } catch { setSelected(r) }
  }

  const hasFilters = filterStatus || filterType || filterSearch

  return (
    <>
      <style>{PAGE_CSS}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 14,
            background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Crown size={22} color={GOLD} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f0f2f7', margin: 0, lineHeight: 1.2 }}>
              VIP Requests
            </h1>
            <p style={{ fontSize: 13, color: '#8891a4', margin: '4px 0 0', fontWeight: 500 }}>
              Manage Black Pepper seller requests — Reels, Promotions &amp; VIP Support
              {stats && stats.pending > 0 && (
                <span style={{ marginLeft: 10, color: GOLD, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Zap size={12} /> {stats.pending} pending
                </span>
              )}
            </p>
          </div>
        </div>
        <button onClick={fetchAll}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: '#161a22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, color: '#8891a4', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as any).style.color = '#f0f2f7'; (e.currentTarget as any).style.background = '#1c2130' }}
          onMouseLeave={e => { (e.currentTarget as any).style.color = '#8891a4'; (e.currentTarget as any).style.background = '#161a22' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total"       value={stats.total}       color="#8891a4" icon={<FileText   size={18} />} />
          <StatCard label="Pending"     value={stats.pending}     color={GOLD}    icon={<Clock       size={18} />} highlight />
          <StatCard label="In Progress" value={stats.in_progress} color={PURPLE}  icon={<ArrowRight  size={18} />} />
          <StatCard label="Completed"   value={stats.completed}   color={GREEN}   icon={<CheckCircle size={18} />} />
          <StatCard label="Rejected"    value={stats.rejected}    color="#ef4444" icon={<XCircle     size={18} />} />
        </div>
      )}

      {/* ── Type breakdown ── */}
      {stats && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['reel', 'promotion', 'support'] as VipRequestType[]).map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#161a22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
              <span style={{ color: TYPE_CONFIG[t].color, display: 'flex' }}>{TYPE_CONFIG[t].icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#8891a4' }}>{TYPE_CONFIG[t].label}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: TYPE_CONFIG[t].color }}>{stats.by_type[t]}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="vip-filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ flex: '1 1 220px' }}>
          <label className="vip-label"><Search size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />Search seller</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#4e5668" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input className="vip-input" type="text" placeholder="Seller name or email…"
              value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              style={{ paddingLeft: 34 }} />
          </div>
        </div>
        <div style={{ flex: '0 0 170px' }}>
          <label className="vip-label"><Filter size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />Status</label>
          <select className="vip-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div style={{ flex: '0 0 170px' }}>
          <label className="vip-label"><Star size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />Type</label>
          <select className="vip-select" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
            <option value="">All types</option>
            <option value="reel">🎬 Reel</option>
            <option value="promotion">📣 Promotion</option>
            <option value="support">👑 VIP Support</option>
          </select>
        </div>
        {hasFilters && (
          <button className="vip-btn vip-btn--ghost" style={{ alignSelf: 'flex-end', gap: 6 }}
            onClick={() => { setFilterStatus(''); setFilterType(''); setFilterSearch('') }}>
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="vip-table-wrap">
        {loading ? (
          <table className="vip-table">
            <thead><tr>{['ID','Seller','Type','Message','Status','Date',''].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#1c2130', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Crown size={24} color="#4e5668" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#f0f2f7', margin: '0 0 6px' }}>
              {hasFilters ? 'No results found' : 'No VIP requests yet'}
            </p>
            <p style={{ fontSize: 13, color: '#8891a4' }}>
              {hasFilters ? 'Try adjusting your filters.' : 'Black Pepper sellers have not submitted any requests yet.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="vip-table">
              <thead>
                <tr>{['ID','Seller','Type','Message','Status','Date',''].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <VipRequestRow key={r.id} request={r} onSelect={handleSelectFresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && requests.length > 0 && (
        <p style={{ fontSize: 12, color: '#4e5668', fontWeight: 600, margin: '10px 0 0', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
          <TrendingUp size={12} /> {requests.length} request{requests.length !== 1 ? 's' : ''}
        </p>
      )}

      <VipRequestDrawer request={selected} onClose={() => setSelected(null)} onRefresh={fetchAll} />
    </>
  )
}