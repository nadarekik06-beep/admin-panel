'use client'

/**
 * app/admin/complaints/page.tsx  (Admin Panel — port 3001)
 *
 * Full complaint management for admins.
 * Admin can: view all complaints, filter, approve, reject with reason.
 *
 * Uses: adminComplaintApi from lib/complaintApi.ts
 * Auth: admin_token cookie / admin_user localStorage (same pattern as existing admin panel)
 */

import { useState, useEffect, useCallback } from 'react'
import { adminComplaintApi } from '@/lib/complaintApi'
import type { Complaint } from '@/types/complaint'
import { STATUS_CONFIG, COMPLAINT_TYPE_LABELS } from '@/types/complaint'

const RED   = '#db142e'
const GREEN = '#198f41'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(n) + ' DT'
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Complaint['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {status === 'pending'   && '⏳'}
      {status === 'reviewing' && '🔍'}
      {status === 'approved'  && '✅'}
      {status === 'rejected'  && '❌'}
      {' '}{cfg.label}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1.5px solid #f1f5f9',
      padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}18`, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 24, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 0' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({
  complaintId, isOpen, onClose, onRejected,
}: {
  complaintId: number; isOpen: boolean; onClose: () => void; onRejected: () => void;
}) {
  const [reason,  setReason]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { if (isOpen) { setReason(''); setError('') } }, [isOpen])

  if (!isOpen) return null

  const handleReject = async () => {
    if (reason.trim().length < 10) {
      setError('Please provide a rejection reason (at least 10 characters).')
      return
    }
    setSaving(true)
    try {
      await adminComplaintApi.reject(complaintId, reason.trim())
      onRejected()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to reject complaint.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)', zIndex: 10000,
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 500,
        background: '#fff', borderRadius: 20, padding: '28px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.2)', zIndex: 10001,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12,
            background: 'rgba(239,68,68,0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            ❌
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Reject Complaint
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
              The client will be notified with your reason.
            </p>
          </div>
        </div>

        <label style={{ fontSize: 13, fontWeight: 700, color: '#374151',
          display: 'block', marginBottom: 6 }}>
          Rejection Reason <span style={{ color: RED }}>*</span>
        </label>
        <textarea
          value={reason}
          onChange={e => { setReason(e.target.value); setError('') }}
          rows={4}
          placeholder="Explain clearly why this complaint cannot be approved. This message will be sent to the client."
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
            border: `1.5px solid ${error ? RED : '#e5e7eb'}`, fontFamily: 'inherit',
            lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {error && (
          <p style={{ fontSize: 12, color: RED, fontWeight: 600, margin: '6px 0 0' }}>
            ⚠ {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: '10px 22px', border: '1.5px solid #e5e7eb', borderRadius: 10,
              background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleReject} disabled={saving}
            style={{ padding: '10px 22px', background: saving ? '#94a3b8' : '#ef4444',
              color: '#fff', fontSize: 13, fontWeight: 800, border: 'none',
              borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit' }}>
            {saving ? 'Rejecting…' : '❌ Confirm Rejection'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Complaint Detail Drawer ───────────────────────────────────────────────────

function ComplaintDrawer({
  complaint, onClose, onRefresh,
}: {
  complaint: Complaint | null; onClose: () => void; onRefresh: () => void;
}) {
  const [rejectModal, setRejectModal] = useState(false)
  const [approving,   setApproving]   = useState(false)
  const [toast,       setToast]       = useState('')

  if (!complaint) return null

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      await adminComplaintApi.approve(complaint.id)
      showToast('✅ Complaint approved. Client has been notified.')
      onRefresh()
      onClose()
    } catch (err: any) {
      showToast('❌ ' + (err?.response?.data?.message ?? 'Failed to approve.'))
    } finally {
      setApproving(false)
    }
  }

  const isResolved = complaint.status === 'approved' || complaint.status === 'rejected'
  const cfg = STATUS_CONFIG[complaint.status]

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 9000,
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 560,
        background: '#fff',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.15)',
        zIndex: 9001,
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.25s ease',
      }}>
        {/* Drawer header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Complaint #{complaint.id}
            </h2>
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={complaint.status} />
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: '50%',
              border: '1.5px solid #e5e7eb', background: '#f8fafc',
              cursor: 'pointer', fontSize: 16, color: '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>

        {/* Drawer body */}
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex',
          flexDirection: 'column', gap: 20 }}>

          {/* Parties */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
                Client
              </p>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                {complaint.user?.name ?? '—'}
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                {complaint.user?.email ?? '—'}
              </p>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
                Seller
              </p>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                {complaint.seller?.name ?? '—'}
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                {complaint.seller?.email ?? '—'}
              </p>
            </div>
          </div>

          {/* Order info */}
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
              Order
            </p>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                #{complaint.order?.order_number ?? complaint.order_id}
              </span>
              {complaint.order?.total_amount != null && (
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  {fmt(complaint.order.total_amount)}
                </span>
              )}
              {complaint.order?.status && (
                <span style={{ fontSize: 12, fontWeight: 700,
                  color: complaint.order.status === 'delivered' ? GREEN : '#64748b',
                  textTransform: 'capitalize' }}>
                  {complaint.order.status}
                </span>
              )}
            </div>
          </div>

          {/* Complaint type + description */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
              Complaint Details
            </p>
            <div style={{ background: `${cfg.bg}`, border: `1.5px solid ${cfg.color}30`,
              borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: cfg.color,
                margin: '0 0 8px' }}>
                {COMPLAINT_TYPE_LABELS[complaint.complaint_type]}
                {complaint.complaint_type === 'other' && complaint.other_reason
                  ? ` — ${complaint.other_reason}` : ''}
              </p>
              <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.7 }}>
                {complaint.description}
              </p>
            </div>
          </div>

          {/* Proof image */}
          {complaint.image_url && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                Proof Photo
              </p>
              <a href={complaint.image_url} target="_blank" rel="noreferrer">
                <img src={complaint.image_url} alt="Proof"
                  style={{ width: '100%', maxHeight: 260, objectFit: 'contain',
                    borderRadius: 12, border: '1.5px solid #e5e7eb',
                    background: '#f8fafc', cursor: 'zoom-in' }} />
              </a>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0', fontWeight: 600 }}>
                Click image to open full size
              </p>
            </div>
          )}

          {/* Seller note */}
          {complaint.seller_note && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                Seller Response
              </p>
              <div style={{ background: 'rgba(30,64,175,0.06)',
                border: '1.5px solid rgba(30,64,175,0.2)',
                borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.7 }}>
                  {complaint.seller_note}
                </p>
                {complaint.reviewed_at && (
                  <p style={{ fontSize: 11, color: '#3b82f6', margin: '8px 0 0', fontWeight: 600 }}>
                    Responded: {new Date(complaint.reviewed_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* If already resolved — show the decision */}
          {isResolved && (
            <div style={{
              background: complaint.status === 'approved'
                ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1.5px solid ${complaint.status === 'approved'
                ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              borderRadius: 12, padding: '14px 16px',
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, margin: '0 0 6px',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: complaint.status === 'approved' ? '#10b981' : '#ef4444' }}>
                {complaint.status === 'approved' ? '✅ Admin Decision — Approved' : '❌ Admin Decision — Rejected'}
              </p>
              {complaint.rejection_reason && (
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.7 }}>
                  {complaint.rejection_reason}
                </p>
              )}
              {complaint.resolved_at && (
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0', fontWeight: 600 }}>
                  Resolved: {new Date(complaint.resolved_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
            </div>
          )}

          <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, margin: 0 }}>
            Filed: {new Date(complaint.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>

        {/* Action footer — only when not yet resolved */}
        {!isResolved && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex', gap: 10,
            position: 'sticky', bottom: 0, background: '#fff',
          }}>
            <button
              onClick={() => setRejectModal(true)}
              disabled={approving}
              style={{ flex: 1, padding: '12px', background: 'rgba(239,68,68,0.08)',
                color: '#ef4444', border: '1.5px solid rgba(239,68,68,0.3)',
                borderRadius: 10, fontSize: 13, fontWeight: 800,
                cursor: approving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              ❌ Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={approving}
              style={{ flex: 1, padding: '12px',
                background: approving ? '#94a3b8' : GREEN,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 800,
                cursor: approving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {approving ? (
                <>
                  <span style={{ display: 'inline-block', width: 13, height: 13,
                    border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Approving…
                </>
              ) : '✅ Approve'}
            </button>
          </div>
        )}
      </div>

      {/* Reject modal */}
      <RejectModal
        complaintId={complaint.id}
        isOpen={rejectModal}
        onClose={() => setRejectModal(false)}
        onRejected={() => { onRefresh(); onClose() }}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#111', color: '#fff', padding: '10px 22px',
          borderRadius: 999, fontSize: 13, fontWeight: 700,
          boxShadow: '0 8px 28px rgba(0,0,0,0.25)', zIndex: 99999,
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

// ── Complaint Table Row ───────────────────────────────────────────────────────

function ComplaintTableRow({
  complaint, onSelect,
}: {
  complaint: Complaint; onSelect: (c: Complaint) => void;
}) {
  const cfg = STATUS_CONFIG[complaint.status]
  return (
    <tr
      onClick={() => onSelect(complaint)}
      style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={td}><span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>#{complaint.id}</span></td>
      <td style={td}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
          {complaint.user?.name ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{complaint.user?.email ?? ''}</div>
      </td>
      <td style={td}>
        <div style={{ fontSize: 13, color: '#374151' }}>
          {COMPLAINT_TYPE_LABELS[complaint.complaint_type]}
        </div>
      </td>
      <td style={td}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
          #{complaint.order?.order_number ?? complaint.order_id}
        </span>
      </td>
      <td style={td}>
        <div style={{ fontSize: 13, color: '#374151' }}>{complaint.seller?.name ?? '—'}</div>
      </td>
      <td style={td}><StatusBadge status={complaint.status} /></td>
      <td style={td}>
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
          {new Date(complaint.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </span>
      </td>
      <td style={{ ...td, textAlign: 'right' }}>
        <button
          onClick={e => { e.stopPropagation(); onSelect(complaint) }}
          style={{ padding: '6px 14px', background: '#f8fafc', color: '#374151',
            border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 12,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          View →
        </button>
      </td>
    </tr>
  )
}
const td: React.CSSProperties = {
  padding: '14px 16px', fontSize: 13,
  borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle',
}

// ── Main Admin Page ───────────────────────────────────────────────────────────

export default function AdminComplaintsPage() {
  const [complaints,   setComplaints]   = useState<Complaint[]>([])
  const [stats,        setStats]        = useState<any>(null)
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<Complaint | null>(null)

  // Filters
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
    } catch {
      setComplaints([])
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterFromDate, filterToDate, filterSearch])

  useEffect(() => { fetchAll() }, [fetchAll])

  // When a complaint is selected from the drawer, re-fetch for fresh data
  const handleSelectFresh = async (c: Complaint) => {
    try {
      const res = await adminComplaintApi.getOne(c.id)
      setSelected(res.data)
    } catch {
      setSelected(c)
    }
  }

  const statItems = stats ? [
    { label: 'Total',      value: stats.total,     color: '#64748b', icon: '📋' },
    { label: 'Pending',    value: stats.pending,   color: '#f59e0b', icon: '⏳' },
    { label: 'Reviewing',  value: stats.reviewing, color: '#3b82f6', icon: '🔍' },
    { label: 'Approved',   value: stats.approved,  color: '#10b981', icon: '✅' },
    { label: 'Rejected',   value: stats.rejected,  color: '#ef4444', icon: '❌' },
  ] : []

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none} }
      `}</style>

      <div style={{ fontFamily: "'DM Sans', sans-serif", padding: '28px 32px',
        minHeight: '100vh', background: '#f9fafb', animation: 'fadeUp 0.4s ease both' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14,
            background: 'rgba(220,38,38,0.08)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            🚨
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Complaint Management
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, fontWeight: 500 }}>
              Review and resolve all customer complaints
            </p>
          </div>
        </div>

        {/* ── Stats row ── */}
        {stats && (
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))',
            gap: 14, marginBottom: 28 }}>
            {statItems.map(s => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        )}

        {/* ── Filters bar ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f1f5f9',
          padding: '16px 20px', marginBottom: 20,
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {/* Search */}
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: 6 }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Customer name, email, order #…"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 14px', borderRadius: 9,
                border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {/* Status filter */}
          <div style={{ flex: '0 0 160px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: 6 }}>
              Status
            </label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', padding: '9px 14px', borderRadius: 9,
                border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none',
                fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* From date */}
          <div style={{ flex: '0 0 150px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: 6 }}>
              From
            </label>
            <input type="date" value={filterFromDate}
              onChange={e => setFilterFromDate(e.target.value)}
              style={{ width: '100%', padding: '9px 14px', borderRadius: 9,
                border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {/* To date */}
          <div style={{ flex: '0 0 150px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: 6 }}>
              To
            </label>
            <input type="date" value={filterToDate}
              onChange={e => setFilterToDate(e.target.value)}
              style={{ width: '100%', padding: '9px 14px', borderRadius: 9,
                border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {/* Reset */}
          <button
            onClick={() => {
              setFilterStatus(''); setFilterFromDate('');
              setFilterToDate(''); setFilterSearch('');
            }}
            style={{ padding: '9px 18px', border: '1.5px solid #e5e7eb',
              borderRadius: 9, background: '#fff', color: '#64748b',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              alignSelf: 'flex-end' }}>
            Reset
          </button>
        </div>

        {/* ── Complaints table ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f1f5f9',
          overflow: 'hidden' }}>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ width: 28, height: 28, border: `3px solid #f1f5f9`,
                borderTopColor: RED, borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                Loading complaints…
              </p>
            </div>
          ) : complaints.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚨</div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                No complaints found
              </p>
              <p style={{ fontSize: 13 }}>
                {filterStatus || filterSearch ? 'Try adjusting your filters.' : 'All clear — no complaints yet.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                    {['ID', 'Customer', 'Type', 'Order', 'Seller', 'Status', 'Date', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 11,
                        fontWeight: 800, color: '#94a3b8', textAlign: 'left',
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {complaints.map(c => (
                    <ComplaintTableRow
                      key={c.id}
                      complaint={c}
                      onSelect={handleSelectFresh}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Complaint count */}
        {!loading && complaints.length > 0 && (
          <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600,
            margin: '12px 0 0', textAlign: 'right' }}>
            Showing {complaints.length} complaint{complaints.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Detail drawer */}
      <ComplaintDrawer
        complaint={selected}
        onClose={() => setSelected(null)}
        onRefresh={fetchAll}
      />
    </>
  )
}