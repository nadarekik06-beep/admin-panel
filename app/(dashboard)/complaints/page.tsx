'use client'

/**
 * Returns & refunds moderation (admin panel). The detail drawer
 * (ReturnDrawer) carries every step: decision, pick-up, reception, refund,
 * and the Return Slip PDF for the delivery company. ?id= opens one
 * (notification bell / e-mails).
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle, CheckCircle, XCircle, Clock, Search,
  Eye, RefreshCw, ChevronRight, FileText, RotateCcw,
  ShieldAlert, User, Store, Package, Image as ImageIcon,
  CalendarDays, MessageSquare, X, AlertCircle, TrendingUp, Filter, ArrowUpRight,
} from 'lucide-react'
import { adminComplaintApi } from '@/lib/complaintApi'
import type { Complaint } from '@/types/complaint'
import { COMPLAINT_TYPE_LABELS, STATUS_CONFIG } from '@/types/complaint'
import ReturnDrawer, { ReturnStatusBadge } from './ReturnDrawer'

import BrandLoader from '@/components/brand/BrandLoader'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import { RefreshCover } from '@/components/brand/BrandLoader'
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
  @keyframes ct-pulse-ring{ 0%{box-shadow:0 0 0 0 rgba(249,115,22,.45)} 70%{box-shadow:0 0 0 8px rgba(249,115,22,0)} 100%{box-shadow:0 0 0 0 rgba(249,115,22,0)} }
  @keyframes ct-shimmer   { from{transform:translateX(-100%)} to{transform:translateX(200%)} }

  .ct-animate-fade-up { animation: ct-fade-up 0.45s cubic-bezier(.22,1,.36,1) both; }
  .ct-animate-slide-in{ animation: ct-slide-in 0.3s cubic-bezier(.22,1,.36,1) both; }
  .ct-animate-slide-up{ animation: ct-slide-up 0.25s cubic-bezier(.22,1,.36,1) both; }

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

/** Reads ?id=<id> and opens that return. */
function OpenFromQuery({ onOpen }: { onOpen: (id: number) => void }) {
  const id = Number(useSearchParams().get('id'))
  useEffect(() => { if (id > 0) onOpen(id) }, [id, onOpen])
  return null
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function ComplaintTableRow({ complaint, onSelect }: {
  complaint: Complaint; onSelect: (c: Complaint) => void
}) {
  const needsAction = ['seller_accepted', 'escalated', 'returned_to_seller'].includes(complaint.status)
  return (
    <tr className={needsAction ? 'ct-row--alert' : ''} onClick={() => onSelect(complaint)}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--t1)' }}>
            {complaint.reference ?? `#${complaint.id}`}
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
        <ReturnStatusBadge status={complaint.status} />
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
  // holds the navigation loader until the first load is done
  const firstLoad = usePageLoading(loading)
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

  const openById = useCallback(async (id: number) => {
    try { const res = await adminComplaintApi.getOne(id); setSelected(res.data) } catch { /* gone */ }
  }, [])

  /** After a step: the list and the open return both reload. */
  const selectedId = selected?.id
  const refreshAll = useCallback(() => {
    fetchAll()
    if (selectedId) adminComplaintApi.getOne(selectedId).then(r => setSelected(r.data)).catch(() => {})
  }, [fetchAll, selectedId])

  const hasFilters = filterStatus || filterSearch || filterFromDate || filterToDate

  const statItems = stats ? [
    { label: 'Total',          value: stats.total,       color: '#8891a4', icon: <FileText size={18} />,    alert: false },
    { label: 'Your decision',  value: stats.needs_admin, color: ORANGE,    icon: <ShieldAlert size={18} />, alert: true  },
    { label: 'With seller',    value: stats.with_seller, color: '#f59e0b', icon: <Clock size={18} />,       alert: false },
    { label: 'To schedule',    value: stats.to_schedule, color: '#38bdf8', icon: <Search size={18} />,      alert: true  },
    { label: 'In transit',     value: stats.in_transit,  color: '#818cf8', icon: <Package size={18} />,     alert: false },
    { label: 'To refund',      value: stats.to_refund,   color: '#2dd4bf', icon: <AlertCircle size={18} />, alert: true  },
    { label: 'Refunded',       value: stats.refunded,    color: GREEN,     icon: <CheckCircle size={18} />, alert: false },
    { label: 'Closed',         value: stats.closed,      color: '#ef4444', icon: <XCircle size={18} />,     alert: false },
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
                Returns &amp; Refunds
              </h1>
              <p style={{ fontSize: 13, color: 'var(--t2)', margin: '4px 0 0', fontWeight: 500 }}>
                Decide, schedule pick-ups, confirm receptions and refund
                {stats?.needs_admin > 0 && (
                  <span style={{ marginLeft: 10, color: ORANGE, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle size={12} /> {stats.needs_admin} awaiting your decision
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
              <input className="ct-input" type="text" placeholder="Return ref, customer, email, order #…"
                value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                style={{ paddingLeft: 34 }} />
            </div>
          </div>
          {/* Status */}
          <div style={{ flex: '0 0 185px' }}>
            <label className="ct-label"><Filter size={9} style={{ verticalAlign: 'middle', marginRight: 4 }} />Status</label>
            <select className="ct-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="seller_accepted,escalated">Needs your decision</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
          <div style={{ position: 'relative' }}>
            <RefreshCover active={loading} />
            {firstLoad ? (
              <table className="ct-table">
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--bd)' }}>
                    {['Return', 'Customer', 'Reason', 'Order', 'Seller', 'Status', 'Date', ''].map(h => (
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
                  {hasFilters ? 'No results found' : 'No returns yet'}
                </p>
                <p style={{ fontSize: 13, color: 'var(--t2)' }}>
                  {hasFilters ? 'Try adjusting your filters.' : 'All clear — no returns to review.'}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ct-table">
                  <thead>
                    <tr>
                      {['Return', 'Customer', 'Reason', 'Order', 'Seller', 'Status', 'Date', ''].map(h => (
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
        </div>

        {!loading && complaints.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600, margin: '10px 0 0', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
            <TrendingUp size={12} /> {complaints.length} return{complaints.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <Suspense fallback={null}><OpenFromQuery onOpen={openById} /></Suspense>
      {/* inside .ct-root: the drawer and its modals use the page's CSS variables */}
      <div className="ct-root">
        <ReturnDrawer key={selected?.id ?? 'closed'} complaint={selected} onClose={() => setSelected(null)} onRefresh={refreshAll} />
      </div>
    </>
  )
}