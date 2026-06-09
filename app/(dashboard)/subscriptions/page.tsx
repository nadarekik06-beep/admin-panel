'use client'

/**
 * Admin panel — Subscription Management Page
 * File: app/subscriptions/page.tsx  (inside your admin Next.js app at localhost:3001)
 *
 * Shows all seller subscriptions with:
 *   - Plan and status badges
 *   - Billing cycle info and days remaining
 *   - Pending downgrade indicators
 *   - Force plan change modal
 *   - Suspend / reinstate actions
 */

import { useEffect, useState, useCallback } from 'react'
import { Search, Crown, Flame, Leaf, Clock, AlertTriangle, CheckCircle, PauseCircle, Play, ArrowRight, X, Loader2, Calendar } from 'lucide-react'
import api from '@/lib/axios'
import { format } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SellerSub {
  id:                    number
  user_id:               number
  seller_name:           string
  seller_email:          string
  business_name:         string | null
  current_plan:          'free' | 'red' | 'black'
  pending_plan:          'free' | 'red' | 'black' | null
  status:                string
  status_label:          string
  billing_cycle_start:   string | null
  billing_cycle_end:     string | null
  days_remaining:        number
  grace_period_ends_at:  string | null
  has_pending_downgrade: boolean
  last_payment_at:       string | null
  suspended_at:          string | null
  admin_note:            string | null
  max_products:          number | null
}

interface PlanChange {
  from_plan:         string
  to_plan:           string
  change_type:       string
  change_type_label: string
  effective_at:      string
  reason:            string | null
  amount_charged:    number
  changed_by:        { id: number; name: string; role: string } | null
}

// ── Plan config ───────────────────────────────────────────────────────────────

const PLAN_CFG = {
  free:  { label: 'Green Pepper', color: '#198f41', bg: 'rgba(25,143,65,0.12)',   icon: Leaf  },
  red:   { label: 'Red Pepper',   color: '#db142e', bg: 'rgba(219,20,46,0.12)',   icon: Flame },
  black: { label: 'Black Pepper', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: Crown },
}

const STATUS_CFG: Record<string, { color: string; bg: string }> = {
  active:        { color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  grace_period:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  canceled:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  expired:       { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  suspended:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  past_due:      { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: 'free' | 'red' | 'black' }) {
  const cfg = PLAN_CFG[plan]
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 800, border: `1px solid ${cfg.color}30`, whiteSpace: 'nowrap' }}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cfg = STATUS_CFG[status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, border: `1px solid ${cfg.color}25` }}>
      {label}
    </span>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-5 right-5 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={15} /> : <X size={15} />}
      {message}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [subs,        setSubs]        = useState<any>(null)
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [planFilter,  setPlanFilter]  = useState('')
  const [statusFilter,setStatusFilter]= useState('')
  const [page,        setPage]        = useState(1)
  const [toast,       setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Detail modal
  const [detailSub,   setDetailSub]   = useState<SellerSub | null>(null)
  const [history,     setHistory]     = useState<PlanChange[]>([])
  const [detailLoading,setDetailLoading]=useState(false)

  // Force plan modal
  const [forcePlanTarget,  setForcePlanTarget]  = useState<SellerSub | null>(null)
  const [forcePlan,        setForcePlan]        = useState<'free' | 'red' | 'black'>('free')
  const [forceReason,      setForceReason]      = useState('')
  const [forceLoading,     setForceLoading]     = useState(false)

  // Suspend modal
  const [suspendTarget, setSuspendTarget] = useState<SellerSub | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendLoading,setSuspendLoading]= useState(false)

  const fetchSubs = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page }
      if (search)       params.search = search
      if (planFilter)   params.plan   = planFilter
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/admin/subscriptions', { params })
      setSubs(res.data.data)
    } catch {}
    finally { setLoading(false) }
  }, [page, search, planFilter, statusFilter])

  useEffect(() => { const t = setTimeout(fetchSubs, 300); return () => clearTimeout(t) }, [fetchSubs])

  const openDetail = async (sub: SellerSub) => {
    setDetailSub(sub)
    setDetailLoading(true)
    try {
      const res = await api.get(`/admin/subscriptions/${sub.user_id}`)
      setDetailSub(res.data.data.subscription)
      setHistory(res.data.data.history)
    } catch {}
    finally { setDetailLoading(false) }
  }

  const handleForcePlan = async () => {
    if (!forcePlanTarget || !forceReason.trim()) return
    setForceLoading(true)
    try {
      await api.post(`/admin/subscriptions/${forcePlanTarget.user_id}/force-plan`, { plan: forcePlan, reason: forceReason })
      setToast({ message: `Plan changed to ${forcePlan} for ${forcePlanTarget.seller_name}.`, type: 'success' })
      setForcePlanTarget(null); setForcePlan('free'); setForceReason(''); fetchSubs()
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message ?? 'Failed to change plan.', type: 'error' })
    } finally { setForceLoading(false) }
  }

  const handleSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return
    setSuspendLoading(true)
    try {
      await api.post(`/admin/subscriptions/${suspendTarget.user_id}/suspend`, { reason: suspendReason })
      setToast({ message: `${suspendTarget.seller_name} suspended.`, type: 'success' })
      setSuspendTarget(null); setSuspendReason(''); fetchSubs()
    } catch { setToast({ message: 'Failed to suspend.', type: 'error' }) }
    finally { setSuspendLoading(false) }
  }

  const handleReinstate = async (sub: SellerSub) => {
    try {
      await api.post(`/admin/subscriptions/${sub.user_id}/reinstate`, { reason: 'Reinstated by admin' })
      setToast({ message: `${sub.seller_name} reinstated.`, type: 'success' })
      fetchSubs()
    } catch { setToast({ message: 'Failed to reinstate.', type: 'error' }) }
  }

  const cardBg  = '#0d1117'
  const border  = '#1e2128'
  const textMain= '#fcfdfd'
  const muted   = '#6b7280'

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Filters ── */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: muted }} />
            <input type="text" placeholder="Search sellers…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 9, border: `1px solid ${border}`, background: '#161b27', color: textMain, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }}
            style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${border}`, background: '#161b27', color: textMain, fontSize: 13, outline: 'none' }}>
            <option value="">All Plans</option>
            <option value="free">Green Pepper</option>
            <option value="red">Red Pepper</option>
            <option value="black">Black Pepper</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${border}`, background: '#161b27', color: textMain, fontSize: 13, outline: 'none' }}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="grace_period">Grace Period</option>
            <option value="canceled">Canceled</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: 14, color: textMain }}>Seller Subscriptions</h2>
          {subs?.total && <span style={{ fontSize: 11, color: muted }}>{subs.total} total</span>}
        </div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: 10 }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#db142e' }} />
            <span style={{ fontSize: 12, color: muted }}>Loading...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Seller', 'Plan', 'Status', 'Billing Cycle', 'Actions'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: (i >= 3 ? 'center' : 'left') as any, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: muted, borderBottom: `1px solid ${border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(subs?.data ?? []).length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '28px', textAlign: 'center' as const, color: muted, fontSize: 12 }}>No subscriptions found.</td></tr>
                ) : (subs?.data ?? []).map((sub: SellerSub) => (
                  <tr key={sub.id} style={{ borderBottom: `1px solid ${border}`, transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ margin: 0, fontWeight: 700, color: textMain }}>{sub.seller_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: muted }}>{sub.seller_email}</p>
                      {sub.business_name && <p style={{ margin: '1px 0 0', fontSize: 10, color: muted }}>{sub.business_name}</p>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <PlanBadge plan={sub.current_plan} />
                      {sub.has_pending_downgrade && sub.pending_plan && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <ArrowRight size={9} color="#f59e0b" />
                          <PlanBadge plan={sub.pending_plan} />
                          <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600 }}>scheduled</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={sub.status} label={sub.status_label} />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' as const }}>
                      {sub.billing_cycle_end ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', fontSize: 11, color: textMain }}>
                            <Calendar size={10} color={muted} /> {sub.billing_cycle_end}
                          </div>
                          <p style={{ margin: '3px 0 0', fontSize: 10, color: sub.days_remaining <= 3 ? '#f59e0b' : muted }}>
                            {sub.days_remaining}d left
                          </p>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: muted }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => openDetail(sub)} title="Details"
                          style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          Details
                        </button>
                        <button onClick={() => { setForcePlanTarget(sub); setForcePlan(sub.current_plan) }} title="Force Plan"
                          style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid rgba(219,20,46,0.3)`, background: 'rgba(219,20,46,0.1)', color: '#f87171', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          Force Plan
                        </button>
                        {sub.status === 'suspended' ? (
                          <button onClick={() => handleReinstate(sub)} title="Reinstate"
                            style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer' }}>
                            <Play size={11} />
                          </button>
                        ) : (
                          <button onClick={() => setSuspendTarget(sub)} title="Suspend"
                            style={{ padding: '5px 8px', borderRadius: 7, border: `1px solid rgba(239,68,68,0.3)`, background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}>
                            <PauseCircle size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {detailSub && (
        <div onClick={() => setDetailSub(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#0d1117', borderRadius: 18, border: `1px solid ${border}`, overflow: 'hidden', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: textMain }}>{detailSub.seller_name}</p>
              <button onClick={() => setDetailSub(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted }}><X size={16} /></button>
            </div>
            {detailLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#db142e' }} />
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                {/* Subscription info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {[
                    ['Current Plan', <PlanBadge plan={detailSub.current_plan} />],
                    ['Status', <StatusBadge status={detailSub.status} label={detailSub.status_label} />],
                    ['Billing Start', detailSub.billing_cycle_start ?? '—'],
                    ['Billing End', detailSub.billing_cycle_end ?? '—'],
                    ['Days Remaining', detailSub.days_remaining + 'd'],
                    ['Max Products', detailSub.max_products ?? 'Unlimited'],
                    ['Last Payment', detailSub.last_payment_at ? format(new Date(detailSub.last_payment_at), 'dd MMM yyyy') : '—'],
                    ['Pending Downgrade', detailSub.pending_plan ? <PlanBadge plan={detailSub.pending_plan} /> : '—'],
                  ].map(([label, val], i) => (
                    <div key={i} style={{ background: '#161b27', borderRadius: 8, padding: '10px 12px', border: `1px solid ${border}` }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: muted }}>{label as string}</p>
                      <div style={{ fontSize: 12, fontWeight: 600, color: textMain }}>{val as any}</div>
                    </div>
                  ))}
                </div>

                {/* Plan change history */}
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: textMain }}>Plan Change History</p>
                {history.length === 0 ? (
                  <p style={{ fontSize: 12, color: muted }}>No changes yet.</p>
                ) : history.map((h, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: '#161b27', border: `1px solid ${border}`, marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: h.change_type === 'upgrade' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ArrowRight size={11} color={h.change_type === 'upgrade' ? '#10b981' : '#ef4444'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const }}>
                        <PlanBadge plan={h.from_plan as any} />
                        <ArrowRight size={10} color={muted} />
                        <PlanBadge plan={h.to_plan as any} />
                        <span style={{ fontSize: 10, color: muted }}>({h.change_type_label})</span>
                      </div>
                      {h.reason && <p style={{ margin: '4px 0 0', fontSize: 11, color: muted }}>{h.reason}</p>}
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: muted }}>
                        {format(new Date(h.effective_at), 'dd MMM yyyy HH:mm')}
                        {h.changed_by && ` · by ${h.changed_by.name}`}
                        {h.amount_charged > 0 && ` · ${h.amount_charged} TND`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Force Plan Modal ── */}
      {forcePlanTarget && (
        <div onClick={() => setForcePlanTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#0d1117', borderRadius: 18, border: `1px solid rgba(219,20,46,0.3)`, overflow: 'hidden' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #db142e, #f59e0b)' }} />
            <div style={{ padding: 20 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 900, fontSize: 15, color: textMain }}>Force Plan Change</p>
              <p style={{ margin: '0 0 18px', fontSize: 12, color: muted }}>
                Immediate change for <strong style={{ color: textMain }}>{forcePlanTarget.seller_name}</strong>. Bypasses billing cycle.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: muted, marginBottom: 6 }}>New Plan</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['free', 'red', 'black'] as const).map(p => {
                    const cfg = PLAN_CFG[p]
                    const Icon = cfg.icon
                    return (
                      <button key={p} onClick={() => setForcePlan(p)} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: `2px solid ${forcePlan === p ? cfg.color : border}`, background: forcePlan === p ? cfg.bg : 'transparent', color: cfg.color, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
                        <Icon size={14} />
                        <span style={{ fontSize: 10, fontWeight: 800 }}>{cfg.label.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: muted, marginBottom: 6 }}>Reason (required)</label>
                <textarea
                  rows={3} placeholder="Why are you changing this seller's plan?"
                  value={forceReason} onChange={e => setForceReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${border}`, background: '#161b27', color: textMain, fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setForcePlanTarget(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                <button onClick={handleForcePlan} disabled={forceLoading || !forceReason.trim()}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #db142e, #a00f22)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: forceLoading || !forceReason.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: !forceReason.trim() ? 0.5 : 1 }}>
                  {forceLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  Confirm Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Suspend Modal ── */}
      {suspendTarget && (
        <div onClick={() => setSuspendTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: '#0d1117', borderRadius: 18, border: `1px solid rgba(239,68,68,0.3)`, overflow: 'hidden' }}>
            <div style={{ padding: 20 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 900, fontSize: 15, color: '#ef4444' }}>Suspend Subscription</p>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: muted }}>Immediately disables all premium features for <strong style={{ color: textMain }}>{suspendTarget.seller_name}</strong>.</p>
              <textarea rows={3} placeholder="Reason for suspension (required)"
                value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${border}`, background: '#161b27', color: textMain, fontSize: 12, outline: 'none', resize: 'none', marginBottom: 14, boxSizing: 'border-box' as const }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setSuspendTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                <button onClick={handleSuspend} disabled={suspendLoading || !suspendReason.trim()}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 800, cursor: !suspendReason.trim() ? 'not-allowed' : 'pointer', opacity: !suspendReason.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {suspendLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <PauseCircle size={13} />}
                  Suspend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}