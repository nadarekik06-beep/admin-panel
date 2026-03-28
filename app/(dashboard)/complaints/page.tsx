'use client'

/**
 * FILE: app/admin/complaints/page.tsx  (Admin Panel — port 3001)
 *
 * DARK MODE: All white/light colors converted to match the existing
 * dark admin theme (#0d0f14 backgrounds, #16191f cards, #1e2128 borders).
 * Zero logic changes — only color/style values were touched.
 */

import { useState, useEffect, useCallback } from 'react'
import { adminComplaintApi } from '@/lib/complaintApi'
import type { Complaint } from '@/types/complaint'
import { STATUS_CONFIG, COMPLAINT_TYPE_LABELS } from '@/types/complaint'

const RED    = '#db142e'
const GREEN  = '#198f41'
const ORANGE = '#f97316'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(n) + ' DT'
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Complaint['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
      textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {status === 'pending'                       && '⏳'}
      {status === 'reviewing'                     && '🔍'}
      {status === 'approved'                      && '✅'}
      {status === 'seller_rejected_pending_admin' && '⚠️'}
      {status === 'rejected'                      && '❌'}
      {' '}{cfg.label}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon, alert }: {
  label: string; value: number; color: string; icon: string; alert?: boolean
}) {
  return (
    <div style={{
      background: '#16191f',
      borderRadius: 16,
      border: alert && value > 0 ? `2px solid ${ORANGE}` : '1.5px solid #1e2128',
      padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: alert && value > 0 ? `0 0 0 4px rgba(249,115,22,0.1)` : 'none',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
        <p style={{
          fontSize: 10, fontWeight: 700, color: '#4b5563',
          textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 0',
        }}>
          {label}{alert && value > 0 ? ' ⚠️' : ''}
        </p>
      </div>
    </div>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ complaintId, isOpen, onClose, onRejected }: {
  complaintId: number; isOpen: boolean; onClose: () => void; onRejected: () => void;
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
      onRejected()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to reject complaint.')
    } finally { setSaving(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)', zIndex: 10000,
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 480, background: '#16191f', borderRadius: 20, padding: 28,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)', zIndex: 10001,
        border: '1px solid #1e2128',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: '#fcfdfd', margin: '0 0 8px' }}>Reject Complaint</h3>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>
          The client will be notified with your reason.
        </p>
        <textarea value={reason} onChange={e => { setReason(e.target.value); setError('') }}
          rows={4} placeholder="Clearly explain why this complaint cannot be approved…"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
            border: `1.5px solid ${error ? RED : '#1e2128'}`,
            background: '#0d0f14', color: '#fcfdfd',
            fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical',
            outline: 'none', boxSizing: 'border-box',
          }} />
        {error && <p style={{ fontSize: 12, color: RED, fontWeight: 600, margin: '6px 0 0' }}>⚠ {error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} disabled={saving}
            style={{
              padding: '10px 22px', border: '1.5px solid #1e2128', borderRadius: 10,
              background: '#0d0f14', color: '#c8cad0', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            Cancel
          </button>
          <button onClick={handleReject} disabled={saving}
            style={{
              padding: '10px 22px', background: saving ? '#374151' : '#ef4444',
              color: '#fff', fontSize: 13, fontWeight: 800, border: 'none',
              borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>
            {saving ? 'Rejecting…' : '❌ Confirm Rejection'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function ComplaintDrawer({ complaint, onClose, onRefresh }: {
  complaint: Complaint | null; onClose: () => void; onRefresh: () => void;
}) {
  const [rejectModal, setRejectModal] = useState(false)
  const [acting,      setActing]      = useState(false)
  const [toast,       setToast]       = useState('')

  if (!complaint) return null

  const isResolved       = ['approved','rejected'].includes(complaint.status)
  const isSellerRejected = complaint.status === 'seller_rejected_pending_admin'
  const cfg              = STATUS_CONFIG[complaint.status]

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const act = async (action: () => Promise<any>, successMsg: string) => {
    setActing(true)
    try {
      await action()
      showToast(successMsg)
      onRefresh()
      onClose()
    } catch (err: any) {
      showToast('❌ ' + (err?.response?.data?.message ?? 'Action failed.'))
    } finally { setActing(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 580,
        background: '#16191f', boxShadow: '-12px 0 48px rgba(0,0,0,0.4)',
        zIndex: 9001, overflowY: 'auto', display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.25s ease', border: '1px solid #1e2128',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #1e2128',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#16191f', zIndex: 1,
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: '#fcfdfd', margin: 0 }}>
              Complaint #{complaint.id}
            </h2>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={complaint.status} />
              {isSellerRejected && (
                <span style={{
                  fontSize: 11, fontWeight: 800, color: ORANGE,
                  background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)',
                  padding: '3px 10px', borderRadius: 999,
                }}>
                  Admin Action Required
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: '50%', border: '1.5px solid #1e2128',
              background: '#0d0f14', cursor: 'pointer', fontSize: 16, color: '#6b7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Parties */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Client', name: complaint.user?.name, email: complaint.user?.email },
              { label: 'Seller', name: complaint.seller?.name, email: complaint.seller?.email },
            ].map(p => (
              <div key={p.label} style={{ background: '#0d0f14', borderRadius: 12, padding: '14px 16px', border: '1px solid #1e2128' }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>{p.label}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#fcfdfd', margin: '0 0 2px' }}>{p.name ?? '—'}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{p.email ?? '—'}</p>
              </div>
            ))}
          </div>

          {/* Order */}
          <div style={{ background: '#0d0f14', borderRadius: 12, padding: '14px 16px', border: '1px solid #1e2128' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Order</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#fcfdfd', margin: '0 0 4px', fontFamily: 'monospace' }}>
              #{complaint.order?.order_number ?? complaint.order_id}
            </p>
            {complaint.order?.items?.map((item, i) => (
              <p key={i} style={{ fontSize: 12, color: '#6b7280', margin: '2px 0' }}>
                {item.product_name} × {item.quantity}
              </p>
            ))}
          </div>

          {/* Complaint details */}
          <div style={{ background: `${cfg.bg}`, border: `1.5px solid ${cfg.color}30`, borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: cfg.color, margin: '0 0 8px' }}>
              {COMPLAINT_TYPE_LABELS[complaint.complaint_type]}
              {complaint.complaint_type === 'other' && complaint.other_reason ? ` — ${complaint.other_reason}` : ''}
            </p>
            <p style={{ fontSize: 13, color: '#c8cad0', margin: 0, lineHeight: 1.7 }}>
              {complaint.description}
            </p>
          </div>

          {/* Proof image */}
          {complaint.image_url && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Proof Photo</p>
              <a href={complaint.image_url} target="_blank" rel="noreferrer">
                <img src={complaint.image_url} alt="Proof"
                  style={{
                    width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12,
                    border: '1.5px solid #1e2128', background: '#0d0f14', cursor: 'zoom-in',
                  }} />
              </a>
            </div>
          )}

          {/* Seller note + decision */}
          {complaint.seller_note && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                Seller Response
                {complaint.seller_decision && (
                  <span style={{ marginLeft: 8, color: complaint.seller_decision === 'approved' ? GREEN : ORANGE }}>
                    ({complaint.seller_decision === 'approved' ? '✅ Approved' : '⚠️ Rejected'})
                  </span>
                )}
              </p>
              <div style={{ background: 'rgba(30,64,175,0.08)', border: '1.5px solid rgba(30,64,175,0.2)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, color: '#c8cad0', margin: 0, lineHeight: 1.7 }}>{complaint.seller_note}</p>
                {complaint.rejection_reason && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(30,64,175,0.15)' }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: ORANGE, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Seller's Rejection Reason
                    </p>
                    <p style={{ fontSize: 13, color: '#c8cad0', margin: 0 }}>{complaint.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SELLER_REJECTED banner */}
          {isSellerRejected && (
            <div style={{
              background: 'rgba(249,115,22,0.08)', border: `2px solid rgba(249,115,22,0.4)`,
              borderRadius: 14, padding: '16px 18px',
            }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: ORANGE, margin: '0 0 8px' }}>
                ⚠️ Seller Rejected — Your Final Decision Required
              </p>
              <p style={{ fontSize: 13, color: '#c8cad0', margin: '0 0 14px', lineHeight: 1.6 }}>
                The seller has rejected this complaint. You can either confirm the rejection
                (client is notified as rejected) or override it (client is notified as approved).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => act(() => adminComplaintApi.overrideToApproved(complaint.id),
                    '✅ Seller rejection overridden — complaint approved.')}
                  disabled={acting}
                  style={{
                    padding: '12px', background: GREEN, color: '#fff', border: 'none',
                    borderRadius: 10, fontSize: 13, fontWeight: 800,
                    cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}>
                  ✅ Override → Approve
                </button>
                <button onClick={() => act(() => adminComplaintApi.confirmRejection(complaint.id),
                    '❌ Seller rejection confirmed — complaint rejected.')}
                  disabled={acting}
                  style={{
                    padding: '12px', background: '#ef4444', color: '#fff', border: 'none',
                    borderRadius: 10, fontSize: 13, fontWeight: 800,
                    cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}>
                  ❌ Confirm Rejection
                </button>
              </div>
            </div>
          )}

          {/* Already resolved */}
          {isResolved && (
            <div style={{
              background: complaint.status === 'approved' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1.5px solid ${complaint.status === 'approved' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              borderRadius: 12, padding: '14px 16px',
            }}>
              <p style={{
                fontSize: 12, fontWeight: 800, margin: '0 0 6px', textTransform: 'uppercase',
                letterSpacing: '0.07em', color: complaint.status === 'approved' ? '#10b981' : '#ef4444',
              }}>
                {complaint.status === 'approved' ? '✅ Approved (Final)' : '❌ Rejected (Final)'}
              </p>
              {complaint.rejection_reason && (
                <p style={{ fontSize: 13, color: '#c8cad0', margin: 0, lineHeight: 1.7 }}>
                  {complaint.rejection_reason}
                </p>
              )}
            </div>
          )}

          <p style={{ fontSize: 11, color: '#4b5563', fontWeight: 600, margin: 0 }}>
            Filed: {new Date(complaint.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>

        {/* Standard approve/reject footer */}
        {!isResolved && !isSellerRejected && (
          <div style={{
            padding: '16px 24px', borderTop: '1px solid #1e2128',
            display: 'flex', gap: 10, position: 'sticky', bottom: 0, background: '#16191f',
          }}>
            <button onClick={() => setRejectModal(true)} disabled={acting}
              style={{
                flex: 1, padding: 12, background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                border: '1.5px solid rgba(239,68,68,0.3)', borderRadius: 10, fontSize: 13,
                fontWeight: 800, cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
              ❌ Reject
            </button>
            <button onClick={() => act(() => adminComplaintApi.approve(complaint.id), '✅ Complaint approved.')}
              disabled={acting}
              style={{
                flex: 1, padding: 12, background: acting ? '#374151' : GREEN,
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800,
                cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
              {acting ? 'Working…' : '✅ Approve'}
            </button>
          </div>
        )}
      </div>

      <RejectModal
        complaintId={complaint.id}
        isOpen={rejectModal}
        onClose={() => setRejectModal(false)}
        onRejected={() => { onRefresh(); onClose() }}
      />

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#16191f', color: '#fcfdfd', padding: '10px 22px', borderRadius: 999,
          fontSize: 13, fontWeight: 700, zIndex: 99999,
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)', border: '1px solid #1e2128',
          animation: 'fadeUp 0.3s ease',
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from{transform:translateX(100%)}to{transform:translateX(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>
    </>
  )
}

// ── Table Row ─────────────────────────────────────────────────────────────────

function ComplaintTableRow({ complaint, onSelect }: { complaint: Complaint; onSelect: (c: Complaint) => void }) {
  const needsAction = complaint.status === 'seller_rejected_pending_admin'
  return (
    <tr
      onClick={() => onSelect(complaint)}
      style={{
        cursor: 'pointer', transition: 'background 0.15s ease',
        background: needsAction ? 'rgba(249,115,22,0.04)' : 'transparent',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = needsAction ? 'rgba(249,115,22,0.08)' : '#1e2128')}
      onMouseLeave={e => (e.currentTarget.style.background = needsAction ? 'rgba(249,115,22,0.04)' : 'transparent')}
    >
      <td style={{ padding: '13px 16px', borderBottom: '1px solid #1e2128' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#fcfdfd' }}>#{complaint.id}</span>
        {needsAction && <span style={{ marginLeft: 6, fontSize: 14 }}>⚠️</span>}
      </td>
      <td style={{ padding: '13px 16px', borderBottom: '1px solid #1e2128' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fcfdfd' }}>{complaint.user?.name ?? '—'}</div>
        <div style={{ fontSize: 11, color: '#4b5563' }}>{complaint.user?.email ?? ''}</div>
      </td>
      <td style={{ padding: '13px 16px', borderBottom: '1px solid #1e2128', fontSize: 13, color: '#c8cad0' }}>
        {COMPLAINT_TYPE_LABELS[complaint.complaint_type]}
      </td>
      <td style={{ padding: '13px 16px', borderBottom: '1px solid #1e2128' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>
          #{complaint.order?.order_number ?? complaint.order_id}
        </span>
      </td>
      <td style={{ padding: '13px 16px', borderBottom: '1px solid #1e2128', fontSize: 13, color: '#c8cad0' }}>
        {complaint.seller?.name ?? '—'}
      </td>
      <td style={{ padding: '13px 16px', borderBottom: '1px solid #1e2128' }}>
        <StatusBadge status={complaint.status} />
      </td>
      <td style={{ padding: '13px 16px', borderBottom: '1px solid #1e2128', fontSize: 11, color: '#4b5563', fontWeight: 600 }}>
        {new Date(complaint.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td style={{ padding: '13px 16px', borderBottom: '1px solid #1e2128', textAlign: 'right' }}>
        <button
          onClick={e => { e.stopPropagation(); onSelect(complaint) }}
          style={{
            padding: '6px 14px', background: '#0d0f14', color: '#c8cad0',
            border: '1.5px solid #1e2128', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          View →
        </button>
      </td>
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

  const statItems = stats ? [
    { label: 'Total',       value: stats.total,           color: '#6b7280', icon: '📋', alert: false },
    { label: 'Pending',     value: stats.pending,         color: '#f59e0b', icon: '⏳', alert: false },
    { label: 'Reviewing',   value: stats.reviewing,       color: '#3b82f6', icon: '🔍', alert: false },
    { label: 'Needs Admin', value: stats.seller_rejected, color: ORANGE,    icon: '⚠️', alert: true  },
    { label: 'Approved',    value: stats.approved,        color: '#10b981', icon: '✅', alert: false },
    { label: 'Rejected',    value: stats.rejected,        color: '#ef4444', icon: '❌', alert: false },
  ] : []

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none} }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        select option { background: #16191f; color: #fcfdfd; }
      `}</style>

      <div style={{
        fontFamily: "'DM Sans', sans-serif", padding: '28px 32px',
        minHeight: '100vh', background: '#0d0f14', animation: 'fadeUp 0.4s ease both',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: 'rgba(219,20,46,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>
            🚨
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fcfdfd', margin: 0 }}>Complaint Management</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0, fontWeight: 500 }}>
              Review and resolve all customer complaints
              {stats?.seller_rejected > 0 && (
                <span style={{ marginLeft: 10, color: ORANGE, fontWeight: 800 }}>
                  ⚠️ {stats.seller_rejected} awaiting your decision
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
            gap: 14, marginBottom: 28,
          }}>
            {statItems.map(s => <StatCard key={s.label} {...s} />)}
          </div>
        )}

        {/* Filters */}
        <div style={{
          background: '#16191f', borderRadius: 16, border: '1.5px solid #1e2128',
          padding: '16px 20px', marginBottom: 20,
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
        }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{
              fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase',
              letterSpacing: '0.06em', display: 'block', marginBottom: 6,
            }}>Search</label>
            <input
              type="text" placeholder="Customer name, email, order #…" value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 9,
                border: '1.5px solid #1e2128', background: '#0d0f14', color: '#fcfdfd',
                fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }} />
          </div>
          <div style={{ flex: '0 0 180px' }}>
            <label style={{
              fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase',
              letterSpacing: '0.06em', display: 'block', marginBottom: 6,
            }}>Status</label>
            <select
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 9,
                border: '1.5px solid #1e2128', background: '#0d0f14', color: '#fcfdfd',
                fontSize: 13, outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
              }}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="seller_rejected_pending_admin">⚠️ Awaiting Admin</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          {[
            { label: 'From', value: filterFromDate, set: setFilterFromDate },
            { label: 'To',   value: filterToDate,   set: setFilterToDate   },
          ].map(f => (
            <div key={f.label} style={{ flex: '0 0 150px' }}>
              <label style={{
                fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase',
                letterSpacing: '0.06em', display: 'block', marginBottom: 6,
              }}>{f.label}</label>
              <input
                type="date" value={f.value} onChange={e => f.set(e.target.value)}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 9,
                  border: '1.5px solid #1e2128', background: '#0d0f14', color: '#fcfdfd',
                  fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }} />
            </div>
          ))}
          <button
            onClick={() => { setFilterStatus(''); setFilterFromDate(''); setFilterToDate(''); setFilterSearch('') }}
            style={{
              padding: '9px 18px', border: '1.5px solid #1e2128', borderRadius: 9,
              background: '#0d0f14', color: '#6b7280', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-end',
            }}>
            Reset
          </button>
        </div>

        {/* Table */}
        <div style={{ background: '#16191f', borderRadius: 16, border: '1.5px solid #1e2128', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{
                width: 28, height: 28, border: '3px solid #1e2128', borderTopColor: RED,
                borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
              }} />
              <p style={{ color: '#4b5563', fontSize: 13, fontWeight: 600 }}>Loading complaints…</p>
            </div>
          ) : complaints.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚨</div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#fcfdfd', margin: '0 0 6px' }}>No complaints found</p>
              <p style={{ fontSize: 13 }}>{filterStatus || filterSearch ? 'Try adjusting your filters.' : 'All clear!'}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0d0f14', borderBottom: '1.5px solid #1e2128' }}>
                    {['ID', 'Customer', 'Type', 'Order', 'Seller', 'Status', 'Date', ''].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', fontSize: 10, fontWeight: 800,
                        color: '#4b5563', textAlign: 'left', textTransform: 'uppercase',
                        letterSpacing: '0.07em', whiteSpace: 'nowrap',
                      }}>{h}</th>
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
          <p style={{ fontSize: 12, color: '#4b5563', fontWeight: 600, margin: '12px 0 0', textAlign: 'right' }}>
            Showing {complaints.length} complaint{complaints.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <ComplaintDrawer complaint={selected} onClose={() => setSelected(null)} onRefresh={fetchAll} />
    </>
  )
}