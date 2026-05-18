// admin-panel/app/finance/FinancePage.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Package,
  CheckCircle, Clock, AlertCircle, RefreshCw, Search,
} from 'lucide-react'
import api from '@/lib/axios'
import { format } from 'date-fns'

function fmt(v: number | string) {
  return `${Number(v).toFixed(3)} DT`
}

const PAYOUT_COLORS: Record<string, string> = {
  pending:   '#f59e0b',
  ready:     '#3b82f6',
  paid:      '#10b981',
  cancelled: '#ef4444',
}

function PayoutBadge({ status }: { status: string }) {
  const color = PAYOUT_COLORS[status] ?? '#94a3b8'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
      background: `${color}18`, color, border: `1px solid ${color}30`,
      textTransform: 'capitalize',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {status}
    </span>
  )
}

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

type Tab = 'overview' | 'orders' | 'sellers' | 'settlements'

export default function FinancePage() {
  const [tab,         setTab]         = useState<Tab>('overview')
  const [period,      setPeriod]      = useState('month')
  const [overview,    setOverview]    = useState<any>(null)
  const [orders,      setOrders]      = useState<any>(null)
  const [sellers,     setSellers]     = useState<any>(null)
  const [settlements, setSettlements] = useState<any>(null)
  const [loading,     setLoading]     = useState(true)
  const [confirming,  setConfirming]  = useState<number | null>(null)

  const [search,       setSearch]       = useState('')
  const [payoutFilter, setPayoutFilter] = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')

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
  }, [search, dateFrom, dateTo])

  const fetchSettlements = useCallback(async () => {
    const res = await api.get('/admin/settlements')
    setSettlements(res.data.data)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'overview')    await fetchOverview()
      if (tab === 'orders')      await fetchOrders()
      if (tab === 'sellers')     await fetchSellers()
      if (tab === 'settlements') await fetchSettlements()
    } finally {
      setLoading(false)
    }
  }, [tab, fetchOverview, fetchOrders, fetchSellers, fetchSettlements])

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

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',    label: '📊 Overview'   },
    { key: 'orders',      label: '📦 Orders'      },
    { key: 'sellers',     label: '🏪 Sellers'     },
    { key: 'settlements', label: '✅ Settlements' },
  ]

  // ── Fixed: single `right` boolean param, no unused `label` param ──────────
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#64748b' }}>
          Loading…
        </div>
      ) : (
        <>
          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && overview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Period selector */}
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

              {/* KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <KpiCard label="Gross Revenue"   value={fmt(overview.kpis.gross_revenue)}         color="#94a3b8" icon={DollarSign}  />
                <KpiCard label="Platform Profit" value={fmt(overview.kpis.total_platform_profit)} color="#10b981" icon={TrendingUp}  />
                <KpiCard label="Commissions"     value={fmt(overview.kpis.total_commission)}      color="#db142e" icon={TrendingDown} />
                <KpiCard label="Delivery Fees"   value={fmt(overview.kpis.total_delivery_fees)}   color="#3b82f6" icon={Package}      />
                <KpiCard label="Seller Payouts"  value={fmt(overview.kpis.total_seller_payouts)}  color="#a78bfa" icon={DollarSign}  />
                <KpiCard label="Orders"          value={String(overview.kpis.orders_count)}       color="#f59e0b" icon={Package}      />
              </div>

              {/* Payout summary */}
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

              {/* Daily collections table */}
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
                          <th style={th(true)}>Delivery Fees</th>
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

              {/* Filters */}
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

              {/* Table */}
              <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th()}>Order</th>
                        <th style={th()}>Seller</th>
                        <th style={th(true)}>Gross</th>
                        <th style={th(true)}>Commission</th>
                        <th style={th(true)}>Delivery Fee</th>
                        <th style={th(true)}>Platform</th>
                        <th style={th(true)}>Seller Net</th>
                        <th style={th(true)}>Payout</th>
                        <th style={th(true)}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orders?.data ?? []).map((row: any) => (
                        <tr key={row.id}>
                          <td style={{ ...td(), fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9', fontSize: 11 }}>{row.order_number}</td>
                          <td style={td()}>
                            <p style={{ fontWeight: 700, color: '#f1f5f9', margin: 0, fontSize: 12 }}>{row.seller_name}</p>
                            <p style={{ color: '#64748b', margin: 0, fontSize: 10 }}>{row.seller_email}</p>
                          </td>
                          <td style={{ ...td(true), color: '#94a3b8' }}>{fmt(row.subtotal)}</td>
                          <td style={{ ...td(true), color: '#db142e', fontWeight: 700 }}>{fmt(row.commission_amount)}</td>
                          <td style={{ ...td(true), color: '#3b82f6' }}>{fmt(row.delivery_fee)}</td>
                          <td style={{ ...td(true), color: '#10b981', fontWeight: 700 }}>{fmt(row.platform_profit)}</td>
                          <td style={{ ...td(true), color: '#a78bfa', fontWeight: 800 }}>{fmt(row.seller_net_amount)}</td>
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
                        </td>
                        <td style={{ ...td(true), color: '#94a3b8' }}>{row.orders_count}</td>
                        <td style={{ ...td(true), color: '#94a3b8' }}>{fmt(row.gross_revenue)}</td>
                        <td style={{ ...td(true), color: '#db142e', fontWeight: 700 }}>{fmt(row.total_commission)}</td>
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
                      </tr>
                    </thead>
                    <tbody>
                      {(settlements?.data ?? []).map((row: any) => (
                        <tr key={row.id}>
                          <td style={{ ...td(), fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9', fontSize: 11 }}>{row.batch_reference}</td>
                          <td style={{ ...td(), color: '#f1f5f9', fontWeight: 600 }}>{row.seller_name}</td>
                          <td style={{ ...td(true), color: '#94a3b8', fontFamily: 'monospace' }}>{row.batch_date}</td>
                          <td style={{ ...td(true), color: '#94a3b8' }}>{row.orders_count}</td>
                          <td style={{ ...td(true), color: '#a78bfa', fontWeight: 800 }}>{fmt(row.total_seller_payout)}</td>
                          <td style={{ ...td(true), color: '#10b981', fontWeight: 700 }}>{fmt(row.total_platform_profit)}</td>
                          <td style={{ ...td(true) }}><PayoutBadge status={row.status} /></td>
                          <td style={{ ...td(true), color: '#64748b', fontSize: 11 }}>
                            {row.paid_at ? format(new Date(row.paid_at), 'MMM d, yyyy') : '—'}
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
  )
}