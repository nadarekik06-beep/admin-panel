'use client'

// Campaign moderation: filter/search, open a campaign, pause (seller can't resume), resume,
// or reject with a reason (charges refunded, seller notified).

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { adsAdminApi, money, PLACEMENT_LABELS, type AdminCampaign, type AdminCampaignDetail } from '@/lib/adsAdminApi'
import { Btn, card, input, Notice, SponsoringShell, StatusChip } from '../_components/ui'

function CampaignsInner() {
  const params = useSearchParams()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AdminCampaign[]>([])
  const [lastPage, setLastPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(Number(params.get('open')) || null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    adsAdminApi.campaigns({ status, search, page })
      .then(r => { setRows(r.data); setLastPage(r.meta.last_page) })
      .catch(e => setError(e.message))
  }, [status, search, page])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 12 }
  const td: React.CSSProperties = { padding: '9px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, verticalAlign: 'middle' }

  return (
    <SponsoringShell title="Campaigns">
      {error && <Notice tone="error">{error}</Notice>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Search product or seller…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ ...input, maxWidth: 320 }} />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={{ ...input, maxWidth: 200 }}>
          <option value="">All statuses</option>
          {['active', 'paused', 'draft', 'completed', 'cancelled', 'rejected', 'expired'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <section style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead><tr><th style={th}>#</th><th style={th}>Product</th><th style={th}>Seller</th><th style={th}>Status</th><th style={th}>Budget / CPC</th><th style={th}>Spent</th><th style={th}>Clicks</th><th style={th}>Orders</th></tr></thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.id} onClick={() => setOpenId(c.id)} style={{ cursor: 'pointer' }}>
                <td style={td}>{c.id}</td>
                <td style={td}>{c.product?.name ?? '—'}</td>
                <td style={td}>{c.seller?.name}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.seller?.email}</span></td>
                <td style={td}><StatusChip status={c.status} reason={c.paused_reason} /></td>
                <td style={td}>{c.pricing_model === 'cpc' ? `${money(c.daily_budget)} · ${money(c.max_cpc)}` : 'Legacy prepaid'}</td>
                <td style={td}>{money(c.stats.spend)}</td>
                <td style={td}>{c.stats.clicks}</td>
                <td style={td}>{c.stats.orders}</td>
              </tr>
            ))}
            {!rows.length && <tr><td style={td} colSpan={8}>No campaigns.</td></tr>}
          </tbody>
        </table>
      </section>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Btn>
        <span style={{ color: 'var(--text-muted)', fontSize: 13, alignSelf: 'center' }}>Page {page} / {lastPage}</span>
        <Btn disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Btn>
      </div>

      {openId && <CampaignDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </SponsoringShell>
  )
}

function CampaignDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [c, setC] = useState<AdminCampaignDetail | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => { adsAdminApi.campaign(id).then(setC).catch(e => setMsg({ tone: 'error', text: e.message })) }, [id])

  const act = async (fn: () => Promise<AdminCampaignDetail>, text: string) => {
    setBusy(true); setMsg(null)
    try { setC(await fn()); setMsg({ tone: 'ok', text }); onChanged() }
    catch (e: any) { setMsg({ tone: 'error', text: e.message }) }
    finally { setBusy(false) }
  }

  const open = c && ['draft', 'active', 'paused'].includes(c.status)
  const row = (k: string, v: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{k}</span><span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{v}</span>
    </div>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60 }} />
      <aside role="dialog" aria-modal="true" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100%)', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', zIndex: 61, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Campaign #{id}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        {!c ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {c.product?.image_url && <img src={c.product.image_url} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }} />}
              <div>
                <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{c.product?.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 6px' }}>{c.seller?.name} · {c.seller?.email}</p>
                <StatusChip status={c.status} reason={c.paused_reason} />
              </div>
            </div>
            {c.ad_copy && <p style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)', margin: 0 }}>“{c.ad_copy}”</p>}
            {c.rejection_reason && <Notice tone="error">Rejected: {c.rejection_reason}</Notice>}
            <div style={card}>
              {row('Pricing', c.pricing_model === 'cpc' ? 'CPC' : 'Legacy prepaid')}
              {row('Daily budget / max CPC', `${money(c.daily_budget)} / ${money(c.max_cpc)}`)}
              {row('Spend (paid + credit)', `${money(c.summary.spend)} (${money(c.summary.paid_spend)} + ${money(c.summary.credit_spend)})`)}
              {row('Impressions / clicks', `${c.summary.impressions} / ${c.summary.clicks}`)}
              {row('Orders / sales', `${c.summary.orders} / ${money(c.summary.revenue)}`)}
              {row('ROAS', c.summary.roas != null ? `${c.summary.roas}×` : '—')}
              {row('Placements', c.placements ? c.placements.map(p => PLACEMENT_LABELS[p] ?? p).join(', ') : 'All')}
              {row('Readiness at launch', c.readiness_score ?? '—')}
              {row('Seller wallet', c.wallet ? `${money(c.wallet.balance)} + ${money(c.wallet.credit_balance)} credit` : '—')}
              {row('Ends', c.end_at ? new Date(c.end_at).toLocaleDateString('en-GB') : 'Until stopped')}
            </div>
            {open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {c.status === 'active' && <Btn tone="gold" disabled={busy} onClick={() => act(() => adsAdminApi.pause(c.id), 'Paused — the seller cannot resume it.')}>Pause</Btn>}
                  {c.status === 'paused' && <Btn tone="green" disabled={busy} onClick={() => act(() => adsAdminApi.resume(c.id), 'Resumed.')}>Resume</Btn>}
                </div>
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Reject (ends the campaign, refunds its charges, notifies the seller)
                  <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={255} rows={2} placeholder="Reason shown to the seller" style={{ ...input, marginTop: 6, resize: 'vertical' }} />
                </label>
                <div><Btn tone="red" disabled={busy || !reason.trim()} onClick={() => act(() => adsAdminApi.reject(c.id, reason.trim()), 'Rejected and refunded.')}>Reject campaign</Btn></div>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  )
}

export default function CampaignsPage() {
  return <Suspense fallback={null}><CampaignsInner /></Suspense>
}
