'use client'

/**
 * FILE: app/admin/complaints/page.tsx  (Admin Panel — port 3001)
 *
 * REDESIGNED: Lucide React icons, Framer Motion animations, refined spacing,
 * glassmorphism stat cards, polished table, smooth drawer with micro-interactions.
 * Brand: ChooseTounsi (#db142e red, #198f41 green, dark theme)
 * Zero logic changes — only presentation layer was touched.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle, XCircle, Clock, Search,
  Eye, RefreshCw, ChevronRight, FileText, RotateCcw,
  ShieldAlert, User, Store, Package, Image as ImageIcon,
  CalendarDays, MessageSquare, X, AlertCircle, Loader2,
  TrendingUp, Filter, ArrowUpRight,
} from 'lucide-react'
import { adminComplaintApi } from '@/lib/complaintApi'
import type { Complaint } from '@/types/complaint'
import { STATUS_CONFIG, COMPLAINT_TYPE_LABELS } from '@/types/complaint'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const RED    = '#db142e'
const GREEN  = '#198f41'
const ORANGE = '#f97316'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(n) + ' DT'
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── CSS (injected once) ───────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .ct-root {
    font-family: 'Plus Jakarta Sans', sans-serif;
    --red: #db142e;
    --green: #198f41;
    --orange: #f97316;
    --bg:        #0a0c10;
    --bg1:       #11141a;
    --bg2:       #161a22;
    --bg3:       #1c2130;
    --bd:        rgba(255,255,255,0.06);
    --bd2:       rgba(255,255,255,0.1);
    --t1:        #f0f2f7;
    --t2:        #8891a4;
    --t3:        #4e5668;

    /* ── Drawer-specific elevated palette ── */
    --drawer-bg:        #1e2330;   /* main drawer surface */
    --drawer-header-bg: #242838;   /* header strip */
    --drawer-footer-bg: #242838;   /* footer strip */
    --drawer-card-bg:   #323b52;   /* cards — lifted significantly for legibility */
    --drawer-card-bd:   rgba(255,255,255,0.18);
    --drawer-bd:        rgba(255,255,255,0.14);
    --drawer-t1:        #f4f6fc;   /* primary text — pure bright white-blue */
    --drawer-t2:        #b0bbd4;   /* secondary text — noticeably lighter */
    --drawer-t3:        #6e7d9e;   /* muted labels */
    --drawer-section-bg: #232840;  /* section wrappers */
  }

  /* ── animations ── */
  @keyframes ct-fade-up   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  @keyframes ct-slide-in  { from{transform:translateX(100%)} to{transform:translateX(0)} }
  @keyframes ct-slide-up  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes ct-spin      { to{transform:rotate(360deg)} }
  @keyframes ct-pulse-ring{ 0%{box-shadow:0 0 0 0 rgba(249,115,22,.45)} 70%{box-shadow:0 0 0 8px rgba(249,115,22,0)} 100%{box-shadow:0 0 0 0 rgba(249,115,22,0)} }
  @keyframes ct-shimmer   { from{transform:translateX(-100%)} to{transform:translateX(200%)} }

  .ct-animate-fade-up { animation: ct-fade-up 0.45s cubic-bezier(.22,1,.36,1) both; }
  .ct-animate-slide-in{ animation: ct-slide-in 0.3s cubic-bezier(.22,1,.36,1) both; }
  .ct-animate-slide-up{ animation: ct-slide-up 0.25s cubic-bezier(.22,1,.36,1) both; }
  .ct-spin            { animation: ct-spin 0.9s linear infinite; }

  /* ── stagger utility ── */
  .ct-stagger > *:nth-child(1) { animation-delay: 0ms }
  .ct-stagger > *:nth-child(2) { animation-delay: 60ms }
  .ct-stagger > *:nth-child(3) { animation-delay: 120ms }
  .ct-stagger > *:nth-child(4) { animation-delay: 180ms }
  .ct-stagger > *:nth-child(5) { animation-delay: 240ms }
  .ct-stagger > *:nth-child(6) { animation-delay: 300ms }

  /* ── stat card ── */
  .ct-stat {
    background: var(--bg2);
    border: 1px solid var(--bd);
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    cursor: default;
    position: relative;
    overflow: hidden;
  }
  .ct-stat::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,.025) 0%, transparent 60%);
    pointer-events: none;
  }
  .ct-stat:hover { transform: translateY(-2px); }
  .ct-stat.ct-stat--alert {
    border-color: rgba(249,115,22,.35);
    animation: ct-pulse-ring 2.5s infinite;
  }

  /* ── icon bubble ── */
  .ct-icon-bubble {
    width: 42px; height: 42px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  /* ── filter bar ── */
  .ct-filter-bar {
    background: var(--bg2);
    border: 1px solid var(--bd);
    border-radius: 14px;
    padding: 16px 20px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: flex-end;
  }
  .ct-input {
    background: var(--bg);
    border: 1px solid var(--bd);
    border-radius: 10px;
    color: var(--t1);
    font-family: inherit;
    font-size: 13px;
    padding: 9px 14px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
  }
  .ct-input:focus {
    border-color: rgba(219,20,46,.5);
    box-shadow: 0 0 0 3px rgba(219,20,46,.08);
  }
  .ct-input::placeholder { color: var(--t3); }
  .ct-select {
    background: var(--bg);
    border: 1px solid var(--bd);
    border-radius: 10px;
    color: var(--t1);
    font-family: inherit;
    font-size: 13px;
    padding: 9px 14px;
    outline: none;
    cursor: pointer;
    width: 100%;
    transition: border-color 0.2s;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234e5668' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 34px;
  }
  .ct-select:focus { border-color: rgba(219,20,46,.5); }
  .ct-select option { background: #161a22; }

  /* ── label ── */
  .ct-label {
    font-size: 10px;
    font-weight: 800;
    color: var(--t3);
    text-transform: uppercase;
    letter-spacing: .08em;
    display: block;
    margin-bottom: 6px;
  }

  /* ── table ── */
  .ct-table-wrap {
    background: var(--bg2);
    border: 1px solid var(--bd);
    border-radius: 16px;
    overflow: hidden;
  }
  .ct-table { width: 100%; border-collapse: collapse; }
  .ct-table th {
    padding: 11px 16px;
    font-size: 10px;
    font-weight: 800;
    color: var(--t3);
    text-align: left;
    text-transform: uppercase;
    letter-spacing: .08em;
    white-space: nowrap;
    background: var(--bg);
    border-bottom: 1px solid var(--bd);
  }
  .ct-table tr {
    transition: background 0.15s;
    cursor: pointer;
  }
  .ct-table tr:hover td { background: rgba(255,255,255,.025); }
  .ct-table tr.ct-row--alert td { background: rgba(249,115,22,.03); }
  .ct-table tr.ct-row--alert:hover td { background: rgba(249,115,22,.07); }
  .ct-table td {
    padding: 13px 16px;
    border-bottom: 1px solid var(--bd);
    vertical-align: middle;
    transition: background 0.15s;
  }
  .ct-table tr:last-child td { border-bottom: none; }

  /* ── view button ── */
  .ct-btn-view {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    background: transparent;
    border: 1px solid var(--bd2);
    border-radius: 8px;
    color: var(--t2);
    font-size: 12px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
  }
  .ct-btn-view:hover {
    background: rgba(255,255,255,.06);
    color: var(--t1);
    border-color: var(--bd2);
    transform: translateX(1px);
  }

  /* ── action buttons ── */
  .ct-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 11px 18px;
    border-radius: 10px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s, filter 0.15s;
  }
  .ct-btn:active:not(:disabled) { transform: scale(0.97); }
  .ct-btn:disabled { opacity: .45; cursor: not-allowed; }
  .ct-btn--ghost {
    background: rgba(255,255,255,.04);
    border: 1px solid var(--bd2);
    color: var(--t2);
  }
  .ct-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,.08); color: var(--t1); }
  .ct-btn--danger {
    background: rgba(239,68,68,.1);
    border: 1px solid rgba(239,68,68,.25);
    color: #f87171;
  }
  .ct-btn--danger:hover:not(:disabled) { background: rgba(239,68,68,.18); }
  .ct-btn--success {
    background: rgba(25, 143, 65, 0.15);
    color: #4ade80;
    border: 1px solid rgba(25, 143, 65, 0.35);
    backdrop-filter: blur(8px);
  }
  .ct-btn--success:hover:not(:disabled) {
    background: rgba(25, 143, 65, 0.25);
    border-color: rgba(25, 143, 65, 0.55);
    color: #86efac;
  }
  .ct-btn--warning {
    background: rgba(249,115,22,.12);
    border: 1px solid rgba(249,115,22,.3);
    color: #fb923c;
  }
  .ct-btn--warning:hover:not(:disabled) { background: rgba(249,115,22,.2); }
  .ct-btn--primary-danger {
    background: #ef4444;
    color: #fff;
  }
  .ct-btn--primary-danger:hover:not(:disabled) { filter: brightness(1.1); }

  /* ── drawer ── */
  .ct-drawer {
    position: fixed; top: 0; right: 0; bottom: 0;
    width: 100%; max-width: 600px;
    background: var(--drawer-bg);
    border-left: 2px solid rgba(219,20,46,.25);
    box-shadow: -32px 0 96px rgba(0,0,0,.75), -1px 0 0 rgba(255,255,255,.05);
    z-index: 9001;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ct-drawer-header {
    padding: 22px 26px 18px;
    border-bottom: 1px solid var(--drawer-bd);
    position: sticky; top: 0;
    background: var(--drawer-header-bg);
    z-index: 1;
    display: flex; align-items: flex-start; justify-content: space-between;
  }
  .ct-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 22px 26px;
    display: flex; flex-direction: column; gap: 18px;
    background: var(--drawer-bg);
  }
  .ct-drawer-body::-webkit-scrollbar { width: 4px; }
  .ct-drawer-body::-webkit-scrollbar-track { background: transparent; }
  .ct-drawer-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 2px; }
  .ct-drawer-footer {
    padding: 16px 26px;
    border-top: 1px solid var(--drawer-bd);
    background: var(--drawer-footer-bg);
    display: flex; gap: 10px;
  }

  /* ── info card (inside drawer) ── */
  .ct-info-card {
    background: var(--drawer-card-bg);
    border: 1px solid var(--drawer-card-bd);
    border-radius: 12px;
    padding: 16px 18px;
    box-shadow: 0 2px 12px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.07);
  }
  .ct-info-card-label {
    font-size: 10px;
    font-weight: 800;
    color: var(--drawer-t3);
    text-transform: uppercase;
    letter-spacing: .08em;
    margin: 0 0 10px;
    display: flex; align-items: center; gap: 6px;
  }

  /* ── close button ── */
  .ct-close-btn {
    width: 32px; height: 32px; border-radius: 8px;
    background: rgba(255,255,255,.06); border: 1px solid var(--drawer-bd);
    color: var(--drawer-t2); display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .ct-close-btn:hover { background: rgba(255,255,255,.12); color: var(--drawer-t1); }

  /* ── section title in drawer ── */
  .ct-drawer .ct-section-title {
    color: var(--drawer-t3);
  }

  /* ── backdrop ── */
  .ct-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.6);
    backdrop-filter: blur(3px);
    z-index: 9000;
    animation: ct-fade-up 0.2s ease both;
  }

  /* ── toast ── */
  .ct-toast {
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
    background: var(--bg2);
    border: 1px solid var(--bd2);
    color: var(--t1);
    padding: 10px 20px;
    border-radius: 100px;
    font-size: 13px; font-weight: 600;
    z-index: 99999;
    box-shadow: 0 12px 40px rgba(0,0,0,.5);
    white-space: nowrap;
    animation: ct-slide-up 0.3s cubic-bezier(.22,1,.36,1) both;
  }

  /* ── modal ── */
  .ct-modal {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 100%; max-width: 480px;
    background: var(--bg2);
    border: 1px solid var(--bd2);
    border-radius: 20px;
    padding: 28px;
    z-index: 10001;
    box-shadow: 0 40px 100px rgba(0,0,0,.6);
    animation: ct-slide-up 0.25s cubic-bezier(.22,1,.36,1) both;
  }

  /* ── skeleton ── */
  .ct-skeleton {
    background: var(--bg3);
    border-radius: 6px;
    position: relative;
    overflow: hidden;
  }
  .ct-skeleton::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.04) 50%, transparent 100%);
    animation: ct-shimmer 1.5s infinite;
  }

  /* ── divider ── */
  .ct-divider { border: none; border-top: 1px solid var(--bd); margin: 4px 0; }

  /* ── section heading ── */
  .ct-section-title {
    font-size: 11px; font-weight: 800;
    color: var(--t3); text-transform: uppercase; letter-spacing: .08em;
    margin: 0 0 10px;
    display: flex; align-items: center; gap: 6px;
  }

  input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(.4); }
`

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:                       <Clock size={10} strokeWidth={2.5} />,
  reviewing:                     <Search size={10} strokeWidth={2.5} />,
  approved:                      <CheckCircle size={10} strokeWidth={2.5} />,
  seller_rejected_pending_admin: <AlertTriangle size={10} strokeWidth={2.5} />,
  rejected:                      <XCircle size={10} strokeWidth={2.5} />,
}

function StatusBadge({ status }: { status: Complaint['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 100,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}28`,
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>
      {STATUS_ICONS[status]}
      {cfg.label}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, alert }: {
  label: string; value: number; color: string
  icon: React.ReactNode; alert?: boolean
}) {
  const isUrgent = alert && value > 0
  return (
    <div className={`ct-stat ct-animate-fade-up${isUrgent ? ' ct-stat--alert' : ''}`}
      style={{ animationDelay: 'inherit' }}>
      <div className="ct-icon-bubble" style={{ background: `${color}18` }}>
        <span style={{ color, display: 'flex' }}>{icon}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 26, fontWeight: 900, color, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </p>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '5px 0 0' }}>
          {label}
        </p>
      </div>
      {isUrgent && (
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <AlertTriangle size={16} color={ORANGE} />
        </div>
      )}
    </div>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ complaintId, isOpen, onClose, onRejected }: {
  complaintId: number; isOpen: boolean; onClose: () => void; onRejected: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => { if (isOpen) { setReason(''); setError('') } }, [isOpen])
  if (!isOpen) return null

  const handleReject = async () => {
    if (reason.trim().length < 10) { setError('Please provide a reason (at least 10 characters).'); return }
    setSaving(true)
    try {
      await adminComplaintApi.reject(complaintId, reason.trim())
      onRejected(); onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to reject complaint.')
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
            <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--t1)', margin: 0 }}>Reject Complaint</h3>
            <p style={{ fontSize: 12, color: 'var(--t2)', margin: 0 }}>Client will be notified with your reason</p>
          </div>
        </div>

        <textarea value={reason} onChange={e => { setReason(e.target.value); setError('') }}
          rows={4} placeholder="Clearly explain why this complaint cannot be approved…"
          className="ct-input" style={{ resize: 'vertical', lineHeight: 1.6, borderColor: error ? '#ef4444' : undefined }} />

        {error && (
          <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertCircle size={12} /> {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="ct-btn ct-btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="ct-btn ct-btn--primary-danger" onClick={handleReject} disabled={saving}>
            {saving ? <Loader2 size={14} className="ct-spin" /> : <XCircle size={14} />}
            {saving ? 'Rejecting…' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function ComplaintDrawer({ complaint, onClose, onRefresh }: {
  complaint: Complaint | null; onClose: () => void; onRefresh: () => void
}) {
  const [rejectModal, setRejectModal] = useState(false)
  const [acting,      setActing]      = useState(false)
  const [toast,       setToast]       = useState('')

  if (!complaint) return null

  const isResolved       = ['approved', 'rejected'].includes(complaint.status)
  const isSellerRejected = complaint.status === 'seller_rejected_pending_admin'
  const cfg              = STATUS_CONFIG[complaint.status]

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const act = async (action: () => Promise<any>, successMsg: string) => {
    setActing(true)
    try {
      await action()
      showToast(successMsg)
      onRefresh(); onClose()
    } catch (err: any) {
      showToast('Failed: ' + (err?.response?.data?.message ?? 'Action failed.'))
    } finally { setActing(false) }
  }

  return (
    <>
      <div className="ct-backdrop" onClick={onClose} />
      <aside className="ct-drawer ct-animate-slide-in">

        {/* Header */}
        <div className="ct-drawer-header">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--drawer-t2)', background: 'rgba(255,255,255,.06)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--drawer-card-bd)' }}>
                #{complaint.id}
              </span>
              <StatusBadge status={complaint.status} />
              {isSellerRejected && (
                <span style={{ fontSize: 10, fontWeight: 800, color: ORANGE, background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.4)', padding: '3px 10px', borderRadius: 100 }}>
                  Admin Required
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--drawer-t1)', margin: 0, lineHeight: 1.3 }}>
              {COMPLAINT_TYPE_LABELS[complaint.complaint_type]}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--drawer-t2)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CalendarDays size={11} /> {timeAgo(complaint.created_at)}
            </p>
          </div>
          <button className="ct-close-btn" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Body */}
        <div className="ct-drawer-body">

          {/* Parties */}
          <div>
            <p className="ct-section-title"><User size={12} /> Parties Involved</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Client',  icon: <User size={13} />,  ...complaint.user },
                { label: 'Seller',  icon: <Store size={13} />, ...complaint.seller },
              ].map(p => (
                <div key={p.label} className="ct-info-card">
                  <p className="ct-info-card-label">{p.icon} {p.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--drawer-t1)', margin: '0 0 2px' }}>{(p as any).name ?? '—'}</p>
                  <p style={{ fontSize: 11, color: 'var(--drawer-t2)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p as any).email ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Order */}
          <div>
            <p className="ct-section-title"><Package size={12} /> Order Details</p>
            <div className="ct-info-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--drawer-t1)', background: 'rgba(255,255,255,.07)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--drawer-card-bd)' }}>
                  #{complaint.order?.order_number ?? complaint.order_id}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {complaint.order?.items?.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--drawer-t1)', fontWeight: 600 }}>{item.product_name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--drawer-t2)', background: 'rgba(255,255,255,.07)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--drawer-card-bd)' }}>×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Complaint details */}
          <div>
            <p className="ct-section-title"><MessageSquare size={12} /> Complaint Description</p>
            <div style={{
              background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`,
              borderRadius: 12, padding: '14px 16px',
              borderLeft: `3px solid ${cfg.color}`,
            }}>
              <p style={{ fontSize: 13, color: cfg.color, fontWeight: 700, margin: '0 0 8px' }}>
                {COMPLAINT_TYPE_LABELS[complaint.complaint_type]}
                {complaint.complaint_type === 'other' && complaint.other_reason ? ` — ${complaint.other_reason}` : ''}
              </p>
              <p style={{ fontSize: 13, color: 'var(--drawer-t1)', margin: 0, lineHeight: 1.75, fontWeight: 500 }}>
                {complaint.description}
              </p>
            </div>
          </div>

          {/* Proof image */}
          {complaint.image_url && (
            <div>
              <p className="ct-section-title"><ImageIcon size={12} /> Proof Photo</p>
              <a href={complaint.image_url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                <div style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: '1px solid var(--drawer-card-bd)',
                  position: 'relative',
                }}>
                  <img src={complaint.image_url} alt="Proof"
                    style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(0,0,0,.6)', borderRadius: 8,
                    padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, color: '#fff', fontWeight: 600,
                  }}>
                    <ArrowUpRight size={11} /> View full
                  </div>
                </div>
              </a>
            </div>
          )}

          {/* Seller response */}
          {complaint.seller_note && (
            <div>
              <p className="ct-section-title">
                <Store size={12} /> Seller Response
                <span style={{ marginLeft: 6, fontWeight: 800, color: complaint.seller_decision === 'approved' ? GREEN : ORANGE }}>
                  {complaint.seller_decision === 'approved' ? '· Approved' : '· Rejected'}
                </span>
              </p>
              <div style={{ background: 'rgba(99,130,246,.1)', border: '1px solid rgba(99,130,246,.2)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, color: 'var(--drawer-t1)', margin: 0, lineHeight: 1.75, fontWeight: 500 }}>
                  {complaint.seller_note}
                </p>
                {complaint.rejection_reason && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(99,130,246,.15)' }}>
                    <p style={{ fontSize: 10, fontWeight: 800, color: ORANGE, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                      Seller's rejection reason
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--drawer-t1)', margin: 0, fontWeight: 500 }}>{complaint.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Seller rejected — admin action required */}
          {isSellerRejected && (
            <div style={{
              background: 'rgba(249,115,22,.06)', border: `1.5px solid rgba(249,115,22,.3)`,
              borderRadius: 14, padding: '18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <ShieldAlert size={16} color={ORANGE} />
                <p style={{ fontSize: 13, fontWeight: 900, color: ORANGE, margin: 0 }}>
                  Seller Rejected — Your Final Decision
                </p>
              </div>
              <p style={{ fontSize: 13, color: 'var(--drawer-t1)', margin: '0 0 16px', lineHeight: 1.65, fontWeight: 500 }}>
                The seller has rejected this complaint. Override to approve it for the client, or confirm the rejection.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button className="ct-btn ct-btn--success" disabled={acting}
                  onClick={() => act(() => adminComplaintApi.overrideToApproved(complaint.id), '✅ Override approved')}>
                  {acting ? <Loader2 size={14} className="ct-spin" /> : <CheckCircle size={14} />}
                  Override → Approve
                </button>
                <button className="ct-btn ct-btn--primary-danger" disabled={acting}
                  onClick={() => act(() => adminComplaintApi.confirmRejection(complaint.id), '❌ Rejection confirmed')}>
                  {acting ? <Loader2 size={14} className="ct-spin" /> : <XCircle size={14} />}
                  Confirm Rejection
                </button>
              </div>
            </div>
          )}

          {/* Already resolved */}
          {isResolved && (
            <div style={{
              background: complaint.status === 'approved' ? 'rgba(25,143,65,.07)' : 'rgba(239,68,68,.07)',
              border: `1px solid ${complaint.status === 'approved' ? 'rgba(25,143,65,.25)' : 'rgba(239,68,68,.25)'}`,
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              {complaint.status === 'approved'
                ? <CheckCircle size={18} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
                : <XCircle    size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              }
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: complaint.status === 'approved' ? GREEN : '#ef4444', margin: '0 0 4px' }}>
                  {complaint.status === 'approved' ? 'Approved (Final)' : 'Rejected (Final)'}
                </p>
                {complaint.rejection_reason && (
                  <p style={{ fontSize: 13, color: 'var(--drawer-t1)', margin: 0, lineHeight: 1.65, fontWeight: 500 }}>
                    {complaint.rejection_reason}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isResolved && !isSellerRejected && (
          <div className="ct-drawer-footer">
            <button className="ct-btn ct-btn--danger" style={{ flex: 1 }} disabled={acting}
              onClick={() => setRejectModal(true)}>
              <XCircle size={15} /> Reject
            </button>
            <button className="ct-btn ct-btn--success" style={{ flex: 1 }} disabled={acting}
              onClick={() => act(() => adminComplaintApi.approve(complaint.id), '✅ Complaint approved')}>
              {acting ? <Loader2 size={15} className="ct-spin" /> : <CheckCircle size={15} />}
              {acting ? 'Working…' : 'Approve'}
            </button>
          </div>
        )}
      </aside>

      <RejectModal
        complaintId={complaint.id}
        isOpen={rejectModal}
        onClose={() => setRejectModal(false)}
        onRejected={() => { onRefresh(); onClose() }}
      />

      {toast && <div className="ct-toast">{toast}</div>}
    </>
  )
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function ComplaintTableRow({ complaint, onSelect }: {
  complaint: Complaint; onSelect: (c: Complaint) => void
}) {
  const needsAction = complaint.status === 'seller_rejected_pending_admin'
  return (
    <tr className={needsAction ? 'ct-row--alert' : ''} onClick={() => onSelect(complaint)}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--t1)' }}>
            #{complaint.id}
          </span>
          {needsAction && (
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <AlertTriangle size={12} color={ORANGE} />
            </span>
          )}
        </div>
      </td>
      <td>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>
          {complaint.user?.name ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>{complaint.user?.email ?? ''}</div>
      </td>
      <td>
        <span style={{ fontSize: 12, color: 'var(--t2)' }}>
          {COMPLAINT_TYPE_LABELS[complaint.complaint_type]}
        </span>
      </td>
      <td>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--t3)', background: 'var(--bg3)', padding: '3px 8px', borderRadius: 5, border: '1px solid var(--bd)' }}>
          #{complaint.order?.order_number ?? complaint.order_id}
        </span>
      </td>
      <td>
        <span style={{ fontSize: 12, color: 'var(--t2)' }}>{complaint.seller?.name ?? '—'}</span>
      </td>
      <td>
        <StatusBadge status={complaint.status} />
      </td>
      <td>
        <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>
          {timeAgo(complaint.created_at)}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <button className="ct-btn-view" onClick={e => { e.stopPropagation(); onSelect(complaint) }}>
          <Eye size={12} /> View <ChevronRight size={10} />
        </button>
      </td>
    </tr>
  )
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[40, 140, 120, 90, 100, 80, 60, 60].map((w, i) => (
        <td key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
          <div className="ct-skeleton" style={{ height: 14, width: w, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminComplaintsPage() {
  const [complaints,     setComplaints]     = useState<Complaint[]>([])
  const [stats,          setStats]          = useState<any>(null)
  const [loading,        setLoading]        = useState(true)
  const [selected,       setSelected]       = useState<Complaint | null>(null)
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate,   setFilterToDate]   = useState('')
  const [filterSearch,   setFilterSearch]   = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterStatus)   params.status    = filterStatus
      if (filterFromDate) params.from_date = filterFromDate
      if (filterToDate)   params.to_date   = filterToDate
      if (filterSearch)   params.search    = filterSearch

      const [listRes, statsRes] = await Promise.all([
        adminComplaintApi.getAll(params),
        adminComplaintApi.stats(),
      ])
      const raw = listRes.data?.data ?? listRes.data ?? []
      setComplaints(Array.isArray(raw) ? raw : [])
      setStats(statsRes.data)
    } catch { setComplaints([]) }
    finally { setLoading(false) }
  }, [filterStatus, filterFromDate, filterToDate, filterSearch])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSelectFresh = async (c: Complaint) => {
    try { const res = await adminComplaintApi.getOne(c.id); setSelected(res.data) }
    catch { setSelected(c) }
  }

  const hasFilters = filterStatus || filterSearch || filterFromDate || filterToDate

  const statItems = stats ? [
    { label: 'Total',       value: stats.total,           color: '#8891a4', icon: <FileText size={18} />,     alert: false },
    { label: 'Pending',     value: stats.pending,         color: '#f59e0b', icon: <Clock size={18} />,        alert: false },
    { label: 'Reviewing',   value: stats.reviewing,       color: '#3b82f6', icon: <Search size={18} />,       alert: false },
    { label: 'Needs Admin', value: stats.seller_rejected, color: ORANGE,    icon: <ShieldAlert size={18} />,  alert: true  },
    { label: 'Approved',    value: stats.approved,        color: GREEN,     icon: <CheckCircle size={18} />,  alert: false },
    { label: 'Rejected',    value: stats.rejected,        color: '#ef4444', icon: <XCircle size={18} />,      alert: false },
  ] : []

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div className="ct-root" style={{
        padding: '28px 32px', minHeight: '100vh',
        background: 'var(--bg)', animation: 'ct-fade-up 0.5s cubic-bezier(.22,1,.36,1) both',
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 14,
              background: 'rgba(219,20,46,.1)', border: '1px solid rgba(219,20,46,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldAlert size={22} color={RED} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--t1)', margin: 0, lineHeight: 1.2 }}>
                Complaint Management
              </h1>
              <p style={{ fontSize: 13, color: 'var(--t2)', margin: '4px 0 0', fontWeight: 500 }}>
                Review and resolve customer complaints
                {stats?.seller_rejected > 0 && (
                  <span style={{ marginLeft: 10, color: ORANGE, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle size={12} /> {stats.seller_rejected} awaiting your decision
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={fetchAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
              background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 10,
              color: 'var(--t2)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as any).style.color = 'var(--t1)'; (e.currentTarget as any).style.background = 'var(--bg3)' }}
            onMouseLeave={e => { (e.currentTarget as any).style.color = 'var(--t2)'; (e.currentTarget as any).style.background = 'var(--bg2)' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* ── Stats ── */}
        {stats && (
          <div className="ct-stagger" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
            gap: 12, marginBottom: 24,
          }}>
            {statItems.map(s => <StatCard key={s.label} {...s} />)}
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className="ct-filter-bar" style={{ marginBottom: 16 }}>
          {/* Search */}
          <div style={{ flex: '1 1 220px' }}>
            <label className="ct-label"><Search size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="var(--t3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input className="ct-input" type="text" placeholder="Customer, email, order #…"
                value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                style={{ paddingLeft: 34 }} />
            </div>
          </div>
          {/* Status */}
          <div style={{ flex: '0 0 185px' }}>
            <label className="ct-label"><Filter size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />Status</label>
            <select className="ct-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="seller_rejected_pending_admin">Awaiting Admin</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          {/* Date range */}
          {[
            { label: 'From', value: filterFromDate, set: setFilterFromDate },
            { label: 'To',   value: filterToDate,   set: setFilterToDate   },
          ].map(f => (
            <div key={f.label} style={{ flex: '0 0 152px' }}>
              <label className="ct-label"><CalendarDays size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />{f.label}</label>
              <input className="ct-input" type="date" value={f.value} onChange={e => f.set(e.target.value)} />
            </div>
          ))}
          {/* Reset */}
          {hasFilters && (
            <button className="ct-btn ct-btn--ghost" style={{ alignSelf: 'flex-end', gap: 6 }}
              onClick={() => { setFilterStatus(''); setFilterFromDate(''); setFilterToDate(''); setFilterSearch('') }}>
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="ct-table-wrap">
          {loading ? (
            <table className="ct-table">
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--bd)' }}>
                  {['ID', 'Customer', 'Type', 'Order', 'Seller', 'Status', 'Date', ''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
            </table>
          ) : complaints.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bg3)', border: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FileText size={24} color="var(--t3)" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>
                {hasFilters ? 'No results found' : 'No complaints yet'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--t2)' }}>
                {hasFilters ? 'Try adjusting your filters.' : 'All clear — no complaints to review.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ct-table">
                <thead>
                  <tr>
                    {['ID', 'Customer', 'Type', 'Order', 'Seller', 'Status', 'Date', ''].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {complaints.map(c => (
                    <ComplaintTableRow key={c.id} complaint={c} onSelect={handleSelectFresh} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && complaints.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600, margin: '10px 0 0', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
            <TrendingUp size={12} /> {complaints.length} complaint{complaints.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <ComplaintDrawer complaint={selected} onClose={() => setSelected(null)} onRefresh={fetchAll} />
    </>
  )
}