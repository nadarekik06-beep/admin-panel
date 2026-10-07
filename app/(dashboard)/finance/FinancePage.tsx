// admin-panel/app/finance/FinancePage.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Package,
  CheckCircle, Clock, AlertCircle, RefreshCw, Search,
  Plus, X, Eye,
} from 'lucide-react'
import api from '@/lib/axios'
import { format } from 'date-fns'
import { fmt, SHIPPING_PAYER, PayoutBadge } from './financeShared'
import FinanceOrderDrawer from './FinanceOrderDrawer'

import BrandLoader from '@/components/brand/BrandLoader'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import { RefreshCover } from '@/components/brand/BrandLoader'
function KpiCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string; sub?: string; color: string; icon: any
}) {
  return (
    <div style={{
      background: '#161b27', border: `1px solid ${color}30`,
      borderRadius: 16, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}18`, border: `1px solid ${color}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 900, color: color ?? '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ─── Create Settlement Modal ──────────────────────────────────────────────────

interface Seller { seller_id: number; seller_name: string; seller_email: string }

function CreateSettlementModal({
  sellers,
  onClose,
  onCreated,
}: {
  sellers: Seller[]
  onClose: () => void
  onCreated: () => void
}) {
  const [sellerId,  setSellerId]  = useState('')
  const [batchDate, setBatchDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes,     setNotes]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async () => {
    if (!sellerId || !batchDate) {
      setError('Seller and date are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/admin/settlements/create', {
        seller_id:  parseInt(sellerId),
        batch_date: batchDate,
        notes:      notes || undefined,
      })
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create settlement.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '10px 14px', fontSize: 13, color: '#f1f5f9', outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)', zIndex: 200,
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 201, width: '100%', maxWidth: 480,
        background: '#0f1623', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
              Create Settlement Batch
            </p>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              Groups all ready orders for a seller into one payout
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13, fontWeight: 600,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Seller picker */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', display: 'block', marginBottom: 8 }}>
              Seller *
            </label>
            <select value={sellerId} onChange={e => setSellerId(e.target.value)} style={inputStyle}>
              <option value="" style={{ background: '#0f1623', color: '#64748b' }}>— Select a seller —</option>
              {sellers.map(s => (
                <option key={s.seller_id} value={s.seller_id} style={{ background: '#0f1623', color: '#f1f5f9' }}>
                  {s.seller_name} ({s.seller_email})
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', display: 'block', marginBottom: 8 }}>
              Settlement Date *
            </label>
            <input
              type="date"
              value={batchDate}
              onChange={e => setBatchDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', display: 'block', marginBottom: 8 }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. May 2026 payout"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Info box */}
          <div style={{
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10, padding: '10px 14px',
          }}>
            <p style={{ fontSize: 12, color: '#93c5fd', margin: 0, fontWeight: 500 }}>
              ℹ All orders with status <strong>&quot;Ready&quot;</strong> for the selected seller will be grouped into this batch automatically. Only orders with confirmed cash receipt are included.
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading || !sellerId || !batchDate} style={{
              flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
              background: loading || !sellerId || !batchDate
                ? 'rgba(16,185,129,0.3)'
                : 'linear-gradient(135deg,#10b981,#059669)',
              color: '#fff', fontSize: 13, fontWeight: 800,
              cursor: loading || !sellerId || !batchDate ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading && <BrandLoader variant="inline" size={14} />}
              {loading ? 'Creating…' : '✓ Create Settlement Batch'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}

type Tab = 'overview' | 'orders' | 'sellers' | 'settlements'

export default function FinancePage() {
  const [tab,         setTab]         = useState<Tab>('overview')
  const [period,      setPeriod]      = useState('month')
  const [overview,    setOverview]    = useState<any>(null)
  const [orders,      setOrders]      = useState<any>(null)
  const [sellers,     setSellers]     = useState<any>(null)
  const [settlements, setSettlements] = useState<any>(null)
  const [loading,     setLoading]     = useState(true)
  // holds the navigation loader until the first load is done
  const firstLoad = usePageLoading(loading)
  const [confirming,  setConfirming]  = useState<number | null>(null)
  const [cancelling,  setCancelling]  = useState<number | null>(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [detailRow,   setDetailRow]   = useState<any>(null)
  const [sellersList, setSellersList] = useState<Seller[]>([])

  const [search,           setSearch]           = useState('')
  const [payoutFilter,     setPayoutFilter]      = useState('')
  const [dateFrom,         setDateFrom]          = useState('')
  const [dateTo,           setDateTo]            = useState('')
  const [settlementSearch, setSettlementSearch]  = useState('')

  const fetchOverview = useCallback(async () => {
    const res = await api.get('/admin/finance/overview', { params: { period } })
    setOverview(res.data.data)
  }, [period])

  const fetchOrders = useCallback(async () => {
    const res = await api.get('/admin/finance/orders', {
      params: {
        search:        search       || undefined,
        payout_status: payoutFilter || undefined,
        date_from:     dateFrom     || undefined,
        date_to:       dateTo       || undefined,
      },
    })
    setOrders(res.data.data)
  }, [search, payoutFilter, dateFrom, dateTo])

  const fetchSellers = useCallback(async () => {
    const res = await api.get('/admin/finance/sellers', {
      params: {
        search:    search    || undefined,
        date_from: dateFrom  || undefined,
        date_to:   dateTo    || undefined,
      },
    })
    setSellers(res.data.data)
    // Keep a flat list for the settlement modal seller picker
    setSellersList(
      (res.data.data?.data ?? []).map((s: any) => ({
        seller_id:    s.seller_id,
        seller_name:  s.seller_name,
        seller_email: s.seller_email,
      }))
    )
  }, [search, dateFrom, dateTo])

  const fetchSettlements = useCallback(async () => {
    const res = await api.get('/admin/settlements', {
      params: { search: settlementSearch || undefined },
    })
    setSettlements(res.data.data)
  }, [settlementSearch])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'overview')    await fetchOverview()
      if (tab === 'orders')      await fetchOrders()
      if (tab === 'sellers')     await fetchSellers()
      if (tab === 'settlements') {
        await fetchSettlements()
        // Also load sellers list for the create modal (needed even if sellers tab wasn't visited)
        if (sellersList.length === 0) {
          const res = await api.get('/admin/finance/sellers')
          setSellersList(
            (res.data.data?.data ?? []).map((s: any) => ({
              seller_id:    s.seller_id,
              seller_name:  s.seller_name,
              seller_email: s.seller_email,
            }))
          )
        }
      }
    } finally {
      setLoading(false)
    }
  }, [tab, fetchOverview, fetchOrders, fetchSellers, fetchSettlements, sellersList.length])

  useEffect(() => { load() }, [load])

  const handleConfirmMoney = async (id: number) => {
    setConfirming(id)
    try {
      await api.post(`/admin/finance/confirm-money/${id}`)
      await fetchOrders()
    } finally {
      setConfirming(null)
    }
  }

  const handleConfirmBatch = async (id: number) => {
    if (!confirm('Mark this batch as PAID? This cannot be undone.')) return
    setConfirming(id)
    try {
      await api.post(`/admin/settlements/${id}/confirm`)
      await fetchSettlements()
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Confirmation failed.')
    } finally {
      setConfirming(null)
    }
  }

  const handleCancelBatch = async (id: number) => {
    if (!confirm('Cancel this batch? Orders will return to the ready queue.')) return
    setCancelling(id)
    try {
      await api.post(`/admin/settlements/${id}/cancel`)
      await fetchSettlements()
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Cancellation failed.')
    } finally {
      setCancelling(null)
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',    label: '📊 Overview'   },
    { key: 'orders',      label: '📦 Orders'      },
    { key: 'sellers',     label: '🏪 Sellers'     },
    { key: 'settlements', label: '✅ Settlements' },
  ]

  const th = (right = false): React.CSSProperties => ({
    padding: '9px 14px', fontSize: 9, fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    color: '#475569', background: 'rgba(255,255,255,0.04)',
    textAlign: right ? 'right' : 'left',
  })

  const td = (right = false): React.CSSProperties => ({
    padding: '12px 14px', fontSize: 12,
    textAlign: right ? 'right' : 'left',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Create settlement modal */}
      {showCreate && (
        <CreateSettlementModal
          sellers={sellersList}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            await fetchSettlements()
            await fetchSellers()
          }}
        />
      )}

      {/* Seller-order details drawer (Orders tab) — fetched lazily on open */}
      {detailRow && (
        <FinanceOrderDrawer
          sellerOrderId={detailRow.id}
          orderNumber={detailRow.order_number}
          onClose={() => setDetailRow(null)}
        />
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Finance
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            Commission tracking, settlement management & seller payouts
          </p>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer', fontSize: 12,
        }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', borderRadius: 9, border: 'none',
            background: tab === t.key ? '#db142e' : 'transparent',
            color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.45)',
            fontSize: 12, fontWeight: tab === t.key ? 800 : 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <RefreshCover active={loading} />
        {firstLoad ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#64748b' }}>
            Loading…
          </div>
        ) : (
          <>
            {/* ── OVERVIEW TAB ── */}
            {tab === 'overview' && overview && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
  
                <div style={{ display: 'flex', gap: 6 }}>
                  {['today', 'week', 'month', 'all'].map(p => (
                    <button key={p} onClick={() => setPeriod(p)} style={{
                      padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                      background: period === p ? 'rgba(219,20,46,0.15)' : 'transparent',
                      color: period === p ? '#db142e' : '#64748b',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      textTransform: 'capitalize',
                    }}>
                      {p}
                    </button>
                  ))}
                </div>
  
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <KpiCard label="Gross Revenue"   value={fmt(overview.kpis.gross_revenue)}         color="#94a3b8" icon={DollarSign}  />
                  <KpiCard label="Platform Profit" value={fmt(overview.kpis.total_platform_profit)} color="#10b981" icon={TrendingUp}
                    sub="Commission + shipping collected − paid to agency" />
                  <KpiCard label="Commissions"     value={fmt(overview.kpis.total_commission)}      color="#db142e" icon={TrendingDown} />
                  <KpiCard label="Shipping · Customers" value={fmt(overview.kpis.total_delivery_fees)} color="#3b82f6" icon={Package}
                    sub="Delivery fees paid at checkout" />
                  <KpiCard label="Shipping · Sellers" value={fmt(overview.kpis.total_seller_shipping ?? 0)} color="#f59e0b" icon={Package}
                    sub="Free-shipping orders, deducted from payouts" />
                  <KpiCard label="Paid to Agency"  value={fmt(overview.kpis.total_shipping_cost ?? 0)} color="#ef4444" icon={TrendingDown}
                    sub={`Net shipping: ${fmt(Number(overview.kpis.total_delivery_fees ?? 0) + Number(overview.kpis.total_seller_shipping ?? 0) - Number(overview.kpis.total_shipping_cost ?? 0))}`} />
                  <KpiCard label="Seller Payouts"  value={fmt(overview.kpis.total_seller_payouts)}  color="#a78bfa" icon={DollarSign}  />
                  <KpiCard label="Orders"          value={String(overview.kpis.orders_count)}       color="#f59e0b" icon={Package}      />
                  {/* Paid click charges only; free plan credit is not revenue */}
                  <KpiCard label="Ad Revenue"      value={fmt(overview.kpis.ad_revenue ?? 0)} color="#22c55e" icon={TrendingUp}
                    sub={`Plan credit used: ${fmt(overview.kpis.ad_credit_spent ?? 0)}`} />
                  {/* Cash in: approved ad-wallet top-ups (WhatsApp / transfers) and plan payments */}
                  <KpiCard label="Ad Top-ups Received" value={fmt(overview.kpis.ad_top_ups_received ?? 0)} color="#10b981" icon={DollarSign}
                    sub={`${overview.kpis.ad_top_ups_count ?? 0} approved top-up(s) — real money`} />
                  <KpiCard label="Subscription Revenue" value={fmt(overview.kpis.subscription_revenue ?? 0)} color="#8b5cf6" icon={DollarSign}
                    sub="Plan payments received" />
                </div>
  
                <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Payout Queue</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                    {[
                      { key: 'pending', label: 'Awaiting Delivery', icon: Clock,       color: '#f59e0b' },
                      { key: 'ready',   label: 'Ready to Settle',   icon: AlertCircle, color: '#3b82f6' },
                      { key: 'paid',    label: 'Paid Out',          icon: CheckCircle, color: '#10b981' },
                    ].map((item, i) => {
                      const d    = overview.payout_summary[item.key]
                      const Icon = item.icon
                      return (
                        <div key={item.key} style={{
                          padding: '16px 20px',
                          borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Icon size={13} color={item.color} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {item.label}
                            </span>
                          </div>
                          <p style={{ fontSize: 18, fontWeight: 900, color: item.color, margin: '0 0 2px' }}>
                            {fmt(d?.amount ?? 0)}
                          </p>
                          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{d?.count ?? 0} orders</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
  
                {overview.daily_collections?.length > 0 && (
                  <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Daily Collections (last 7 days)</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={th()}>Date</th>
                            <th style={th(true)}>Orders</th>
                            <th style={th(true)}>Gross</th>
                            <th style={th(true)}>Commission</th>
                            <th style={th(true)}>Shipping · Customers</th>
                            <th style={th(true)}>Shipping · Sellers</th>
                            <th style={th(true)}>Paid to Agency</th>
                            <th style={th(true)}>Platform Profit</th>
                            <th style={th(true)}>Seller Payouts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.daily_collections.map((row: any) => (
                            <tr key={row.collection_date}>
                              <td style={{ ...td(), fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>
                                {format(new Date(row.collection_date), 'MMM d, yyyy')}
                              </td>
                              <td style={{ ...td(true), color: '#94a3b8' }}>{row.orders}</td>
                              <td style={{ ...td(true), color: '#94a3b8' }}>{fmt(row.gross)}</td>
                              <td style={{ ...td(true), color: '#db142e', fontWeight: 700 }}>{fmt(row.commission)}</td>
                              <td style={{ ...td(true), color: '#3b82f6', fontWeight: 700 }}>{fmt(row.delivery_fees)}</td>
                              <td style={{ ...td(true), color: '#f59e0b', fontWeight: 700 }}>{fmt(row.seller_shipping ?? 0)}</td>
                              <td style={{ ...td(true), color: '#ef4444', fontWeight: 700 }}>−{fmt(row.shipping_cost ?? 0)}</td>
                              <td style={{ ...td(true), color: '#10b981', fontWeight: 800 }}>{fmt(row.platform_profit)}</td>
                              <td style={{ ...td(true), color: '#a78bfa', fontWeight: 700 }}>{fmt(row.seller_payouts)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
  
            {/* ── ORDERS TAB ── */}
            {tab === 'orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Order number or seller…"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '8px 12px 8px 30px', fontSize: 12, color: '#f1f5f9', outline: 'none' }}
                    />
                  </div>
                  <select
                    value={payoutFilter}
                    onChange={e => setPayoutFilter(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#f1f5f9', outline: 'none' }}
                  >
                    <option value="">All Payouts</option>
                    <option value="pending">Pending</option>
                    <option value="ready">Ready</option>
                    <option value="paid">Paid</option>
                  </select>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#64748b', outline: 'none' }} />
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#64748b', outline: 'none' }} />
                </div>
  
                <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th()}>Order</th>
                          <th style={th()}>Seller</th>
                          <th style={th(true)}>Gross</th>
                          <th style={th(true)}>Commission</th>
                          <th style={th(true)}>Shipping</th>
                          <th style={th(true)}>Platform</th>
                          <th style={th(true)}>Seller Net</th>
                          <th style={th(true)}>Payout</th>
                          <th style={th(true)}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orders?.data ?? []).map((row: any) => (
                          <tr key={row.id}>
                            <td style={td()}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9', fontSize: 11 }}>{row.order_number}</span>
                                <button
                                  onClick={() => setDetailRow(row)}
                                  title="View order details"
                                  aria-label={`View details of order ${row.order_number}`}
                                  style={{
                                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#94a3b8', cursor: 'pointer',
                                  }}
                                >
                                  <Eye size={13} />
                                </button>
                              </div>
                              {row.items_count != null && (
                                <span style={{
                                  display: 'inline-block', marginTop: 4,
                                  fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                                  background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                }}>
                                  {row.items_count} {Number(row.items_count) === 1 ? 'item' : 'items'}
                                </span>
                              )}
                            </td>
                            <td style={td()}>
                              <p style={{ fontWeight: 700, color: '#f1f5f9', margin: 0, fontSize: 12 }}>{row.seller_name}</p>
                              <p style={{ color: '#64748b', margin: 0, fontSize: 10 }}>{row.seller_email}</p>
                              {row.seller_phone && (
                                <p style={{ color: '#475569', margin: 0, fontSize: 10 }}>{row.seller_phone}</p>
                              )}
                            </td>
                            <td style={{ ...td(true), color: '#94a3b8' }}>{fmt(row.subtotal)}</td>
                            <td style={{ ...td(true), color: '#db142e', fontWeight: 700 }}>{fmt(row.commission_amount)}</td>
                            <td style={{ ...td(true) }}>
                              {Number(row.shipping_cost ?? 0) > 0 ? (() => {
                                const payer = SHIPPING_PAYER[row.shipping_paid_by] ?? SHIPPING_PAYER.customer
                                const collected = Number(row.delivery_fee ?? 0) + Number(row.seller_shipping_charge ?? 0)
                                return (
                                  <>
                                    <p style={{ margin: 0, color: '#ef4444', fontWeight: 700 }}>−{fmt(row.shipping_cost)} agency</p>
                                    <p style={{ margin: 0, fontSize: 10, color: payer.color, fontWeight: 700 }}>
                                      {payer.label}{collected > 0 ? ` +${fmt(collected)}` : ''}
                                    </p>
                                  </>
                                )
                              })() : Number(row.delivery_fee ?? 0) > 0
                                ? <span style={{ color: '#3b82f6' }}>{fmt(row.delivery_fee)}</span>
                                : <span style={{ color: '#475569' }}>—</span>}
                            </td>
                            <td style={{ ...td(true), color: '#10b981', fontWeight: 700 }}>{fmt(row.platform_profit)}</td>
                            <td style={{ ...td(true), color: '#a78bfa', fontWeight: 800 }}>
                              {fmt(row.seller_net_amount)}
                              {Number(row.seller_shipping_charge ?? 0) > 0 && (
                                <p style={{ margin: 0, fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>after −{fmt(row.seller_shipping_charge)} shipping</p>
                              )}
                            </td>
                            <td style={{ ...td(true) }}><PayoutBadge status={row.payout_status} /></td>
                            <td style={{ ...td(true) }}>
                              {row.payout_status === 'pending' && row.status === 'delivered' && (
                                <button
                                  onClick={() => handleConfirmMoney(row.id)}
                                  disabled={confirming === row.id}
                                  style={{
                                    padding: '5px 10px', borderRadius: 7, border: 'none',
                                    background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                                    color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                    opacity: confirming === row.id ? 0.5 : 1,
                                  }}
                                >
                                  {confirming === row.id ? '…' : '✓ Cash In'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
  
            {/* ── SELLERS TAB ── */}
            {tab === 'sellers' && (
              <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th()}>Seller</th>
                        <th style={th(true)}>Orders</th>
                        <th style={th(true)}>Gross Revenue</th>
                        <th style={th(true)}>Commission</th>
                        <th style={th(true)}>Shipping (paid by seller)</th>
                        <th style={th(true)}>Total Net</th>
                        <th style={th(true)}>Paid Out</th>
                        <th style={th(true)}>Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sellers?.data ?? []).map((row: any) => (
                        <tr key={row.seller_id}>
                          <td style={td()}>
                            <p style={{ fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{row.seller_name}</p>
                            <p style={{ color: '#64748b', margin: 0, fontSize: 10 }}>{row.seller_email}</p>
                            {row.seller_phone && (
                              <p style={{ color: '#475569', margin: 0, fontSize: 10 }}>{row.seller_phone}</p>
                            )}
                          </td>
                          <td style={{ ...td(true), color: '#94a3b8' }}>{row.orders_count}</td>
                          <td style={{ ...td(true), color: '#94a3b8' }}>{fmt(row.gross_revenue)}</td>
                          <td style={{ ...td(true), color: '#db142e', fontWeight: 700 }}>{fmt(row.total_commission)}</td>
                          <td style={{ ...td(true), color: '#f59e0b', fontWeight: 700 }}>{Number(row.total_shipping ?? 0) > 0 ? `−${fmt(row.total_shipping)}` : '—'}</td>
                          <td style={{ ...td(true), color: '#a78bfa', fontWeight: 800 }}>{fmt(row.total_net)}</td>
                          <td style={{ ...td(true), color: '#10b981', fontWeight: 700 }}>{fmt(row.total_paid_out)}</td>
                          <td style={{ ...td(true), color: '#f59e0b' }}>{fmt(row.pending_payout)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
  
            {/* ── SETTLEMENTS TAB ── */}
            {tab === 'settlements' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
  
                {/* Toolbar with search + Create button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      value={settlementSearch}
                      onChange={e => setSettlementSearch(e.target.value)}
                      placeholder="Search by seller name or phone…"
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
                        padding: '8px 12px 8px 30px', fontSize: 12, color: '#f1f5f9', outline: 'none',
                      }}
                    />
                  </div>
                  <button
                    onClick={() => setShowCreate(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 18px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg,#10b981,#059669)',
                      color: '#fff', fontSize: 12, fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <Plus size={14} /> Create Settlement
                  </button>
                </div>
  
                <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th()}>Reference</th>
                          <th style={th()}>Seller</th>
                          <th style={th(true)}>Date</th>
                          <th style={th(true)}>Orders</th>
                          <th style={th(true)}>Seller Payout</th>
                          <th style={th(true)}>Platform Profit</th>
                          <th style={th(true)}>Status</th>
                          <th style={th(true)}>Paid At</th>
                          <th style={th(true)}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(settlements?.data ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ padding: '48px 20px', textAlign: 'center', color: '#475569' }}>
                              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: '#64748b' }}>No settlements yet</p>
                              <p style={{ fontSize: 11, margin: 0 }}>Click &quot;Create Settlement&quot; above to pay a seller.</p>
                            </td>
                          </tr>
                        ) : (settlements?.data ?? []).map((row: any) => (
                          <tr key={row.id}>
                            <td style={{ ...td(), fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9', fontSize: 11 }}>
                              {row.batch_reference}
                            </td>
                            <td style={{ ...td(), color: '#f1f5f9', fontWeight: 600 }}>
                              <p style={{ margin: 0, fontWeight: 700 }}>{row.seller_name}</p>
                              <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>{row.seller_email}</p>
                              {row.seller_phone && (
                                <p style={{ margin: 0, fontSize: 10, color: '#475569' }}>{row.seller_phone}</p>
                              )}
                            </td>
                            <td style={{ ...td(true), color: '#94a3b8', fontFamily: 'monospace' }}>{row.batch_date}</td>
                            <td style={{ ...td(true), color: '#94a3b8' }}>{row.orders_count}</td>
                            <td style={{ ...td(true), color: '#a78bfa', fontWeight: 800 }}>{fmt(row.total_seller_payout)}</td>
                            <td style={{ ...td(true), color: '#10b981', fontWeight: 700 }}>{fmt(row.total_platform_profit)}</td>
                            <td style={{ ...td(true) }}><PayoutBadge status={row.status} /></td>
                            <td style={{ ...td(true), color: '#64748b', fontSize: 11 }}>
                              {row.paid_at ? format(new Date(row.paid_at), 'MMM d, yyyy') : '—'}
                            </td>
                            {/* Confirm / Cancel — only for draft batches */}
                            <td style={{ ...td(true) }}>
                              {row.status === 'draft' && (
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => handleConfirmBatch(row.id)}
                                    disabled={confirming === row.id}
                                    style={{
                                      padding: '5px 10px', borderRadius: 7, border: 'none',
                                      background: 'linear-gradient(135deg,#10b981,#059669)',
                                      color: '#fff', fontSize: 10, fontWeight: 700,
                                      cursor: confirming === row.id ? 'not-allowed' : 'pointer',
                                      opacity: confirming === row.id ? 0.5 : 1,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {confirming === row.id ? '…' : '✓ Confirm Paid'}
                                  </button>
                                  <button
                                    onClick={() => handleCancelBatch(row.id)}
                                    disabled={cancelling === row.id}
                                    style={{
                                      padding: '5px 10px', borderRadius: 7,
                                      border: '1px solid rgba(239,68,68,0.3)',
                                      background: 'rgba(239,68,68,0.15)',
                                      color: '#ef4444', fontSize: 10, fontWeight: 700,
                                      cursor: cancelling === row.id ? 'not-allowed' : 'pointer',
                                      opacity: cancelling === row.id ? 0.5 : 1,
                                    }}
                                  >
                                    {cancelling === row.id ? '…' : '✕ Cancel'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}