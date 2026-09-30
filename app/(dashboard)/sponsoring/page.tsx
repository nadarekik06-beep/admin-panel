'use client'

// Sponsoring overview: ad revenue (real money vs plan credit), spend per day, CTR by placement,
// campaigns by status, top advertisers and fraud flags.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { adsAdminApi, money, PLACEMENT_LABELS, type AdsOverview } from '@/lib/adsAdminApi'
import { card, Notice, SponsoringShell, Stat, GOLD, GREEN } from './_components/ui'

export default function SponsoringOverviewPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<AdsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    adsAdminApi.overview(days).then(setData).catch(e => setError(e.message))
  }, [days])

  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 12 }
  const td: React.CSSProperties = { padding: '8px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }

  return (
    <SponsoringShell title="Sponsoring" actions={
      <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
        {[7, 30, 90, 365].map(d => <option key={d} value={d}>Last {d} days</option>)}
      </select>
    }>
      {error && <Notice tone="error">{error}</Notice>}
      {!data ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
        <>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Stat label="Ad revenue (paid)" value={money(data.revenue.paid)} tone={GREEN} hint={`All time ${money(data.all_time.paid)}`} />
            <Stat label="Plan credit spent" value={money(data.revenue.credit)} hint="Not revenue — free monthly credit" />
            <Stat label="Clicks" value={data.totals.clicks.toLocaleString()} hint={`${data.totals.impressions.toLocaleString()} impressions`} />
            <Stat label="Orders from ads" value={data.totals.orders.toLocaleString()} hint={`${money(data.totals.sales)} sales`} />
            <Stat label="Active campaigns" value={(data.campaigns.active ?? 0).toLocaleString()} hint={`${data.campaigns.paused ?? 0} paused`} />
            <Stat label="Pending top-ups" value={data.pending_top_ups} tone={data.pending_top_ups ? GOLD : undefined}
              hint={data.pending_top_ups ? <Link href="/sponsoring/wallets" style={{ color: GOLD }}>Review</Link> : 'None'} />
            <Stat label="Top-ups received" value={money(data.top_ups_received?.amount)} tone={GREEN}
              hint={`${data.top_ups_received?.count ?? 0} approved · all time ${money(data.top_ups_received_all_time?.amount)}`} />
            <Stat label="WhatsApp top-up requests" value={data.pending_payment_requests ?? 0} tone={data.pending_payment_requests ? GOLD : undefined}
              hint={data.pending_payment_requests ? <Link href="/payment-requests" style={{ color: GOLD }}>Review</Link> : 'None pending'} />
          </div>

          <section style={card}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>Click revenue per day</h2>
            {data.daily.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No clicks in this period.</p> : (
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={data.daily}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={50} />
                    <Tooltip contentStyle={{ background: '#16191f', border: '1px solid #2a2d35', borderRadius: 10, fontSize: 12 }} formatter={(v) => money(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="paid" name="Paid" stackId="a" fill={GREEN} />
                    <Bar dataKey="credit" name="Credit" stackId="a" fill={GOLD} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
            <section style={card}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>By placement</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Placement</th><th style={th}>Impr.</th><th style={th}>Clicks</th><th style={th}>CTR</th><th style={th}>Orders</th></tr></thead>
                  <tbody>
                    {data.by_placement.map(r => (
                      <tr key={r.placement}>
                        <td style={td}>{PLACEMENT_LABELS[r.placement] ?? r.placement}</td>
                        <td style={td}>{r.impressions.toLocaleString()}</td>
                        <td style={td}>{r.clicks.toLocaleString()}</td>
                        <td style={td}>{r.ctr != null ? `${(r.ctr * 100).toFixed(2)}%` : '—'}</td>
                        <td style={td}>{r.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={card}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>Top advertisers</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Seller</th><th style={th}>Spend</th><th style={th}>Paid</th></tr></thead>
                <tbody>
                  {data.top_advertisers.map(r => (
                    <tr key={r.seller_id}>
                      <td style={td}><Link href={`/sponsoring/wallets?seller=${r.seller_id}`} style={{ color: 'var(--text-primary)' }}>{r.name}</Link><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.email}</span></td>
                      <td style={td}>{money(r.spend)}</td>
                      <td style={td}>{money(r.paid)}</td>
                    </tr>
                  ))}
                  {!data.top_advertisers.length && <tr><td style={td} colSpan={3}>No spend yet.</td></tr>}
                </tbody>
              </table>
            </section>
          </div>

          <section style={card}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>Flags (last 7 days)</h2>
            {!data.flags.suspicious_ips.length && !data.flags.high_ctr.length && <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Nothing suspicious.</p>}
            {data.flags.suspicious_ips.map(f => (
              <p key={f.ip} style={{ fontSize: 13, color: '#fca5a5', margin: '4px 0' }}>
                IP {f.ip}… — {f.clicks} clicks on {f.campaigns} campaign(s), {f.rejected} not billed (duplicates, bots or bursts)
              </p>
            ))}
            {data.flags.high_ctr.map(f => (
              <p key={`${f.campaign_id}-${f.placement}`} style={{ fontSize: 13, color: '#fcd34d', margin: '4px 0' }}>
                <Link href={`/sponsoring/campaigns?open=${f.campaign_id}`} style={{ color: 'inherit' }}>Campaign #{f.campaign_id}</Link> ({f.seller}) — CTR {(f.ctr * 100).toFixed(1)}% on {PLACEMENT_LABELS[f.placement] ?? f.placement}, usual {(f.expected * 100).toFixed(1)}%
              </p>
            ))}
          </section>
        </>
      )}
    </SponsoringShell>
  )
}
