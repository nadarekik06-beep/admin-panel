'use client'

// Intigo: setup checklist, parcels whose send failed or that need a human,
// sends still pending, and the latest requests / carrier events.
// Per-parcel actions (retry, cancel, size) live in the order drawer.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { intigoApi, type IntigoOverview, type IntigoParcelRow } from '@/lib/intigoApi'
import { Btn, card, Notice, GREEN, RED, GOLD } from '../sponsoring/_components/ui'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import BrandLoader from '@/components/brand/BrandLoader'

const hint: React.CSSProperties = { fontSize: 11.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }
const th: React.CSSProperties = { textAlign: 'start', padding: '6px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }
const td: React.CSSProperties = { padding: '6px 8px', fontSize: 12.5, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {ok ? <CheckCircle2 size={16} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={16} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        {detail && <div style={hint}>{detail}</div>}
      </div>
    </div>
  )
}

function ParcelTable({ rows, empty, retry, busy }: { rows: IntigoParcelRow[]; empty: string; retry?: (id: number) => void; busy: number | null }) {
  if (rows.length === 0) return <p style={hint}>{empty}</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
        <thead><tr>{['Order', 'Seller', 'Status', 'Size', 'Intigo', 'Reason', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.seller_order_id}>
              <td style={td}><Link href={`/orders?order=${r.order_id}`} style={{ color: GOLD, fontWeight: 800, fontFamily: 'monospace' }}>{r.order_number}-S{r.seller_order_id}</Link></td>
              <td style={td}>{r.seller}</td>
              <td style={td}>{r.status}</td>
              <td style={td}>{r.parcel_size}</td>
              <td style={td}><span style={{ fontFamily: 'monospace' }}>{r.intigo_nid ?? '—'}</span><div style={hint}>{r.intigo_sync_status ?? ''}{r.intigo_status_label ? ` · ${r.intigo_status_label}` : ''}{r.attempts ? ` · ${r.attempts} attempt(s)` : ''}</div></td>
              <td style={{ ...td, color: '#fca5a5', maxWidth: 360 }}>{r.intigo_attention ?? r.intigo_error ?? '—'}</td>
              <td style={td}>
                {retry && r.status === 'confirmed' && (
                  <Btn onClick={() => retry(r.seller_order_id)} loading={busy === r.seller_order_id} disabled={busy !== null}>Retry send</Btn>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function IntigoPage() {
  const [data, setData] = useState<IntigoOverview | null>(null)
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [openLog, setOpenLog] = useState<{ id: number; body: string } | null>(null)
  usePageLoading(!data && msg?.tone !== 'error')

  const load = useCallback(() => {
    intigoApi.overview(errorsOnly).then(setData).catch(e => setMsg({ tone: 'error', text: e.message }))
  }, [errorsOnly])
  useEffect(() => { load() }, [load])

  const retry = async (id: number) => {
    if (!window.confirm('Send this parcel to Intigo now? (The no-duplicate rules still apply.)')) return
    setBusy(id); setMsg(null)
    try {
      const res = await intigoApi.retry(id)
      setMsg({ tone: 'ok', text: res.message ?? 'Done.' })
    } catch (e: any) { setMsg({ tone: 'error', text: e.message }) } finally { setBusy(null); load() }
  }

  const showLog = async (id: number) => {
    if (openLog?.id === id) { setOpenLog(null); return }
    try {
      const log = await intigoApi.log(id)
      setOpenLog({ id, body: JSON.stringify({ request: log.request, response: log.response }, null, 2) })
    } catch (e: any) { setMsg({ tone: 'error', text: e.message }) }
  }

  const s = data?.setup

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1150, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Intigo</h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Parcels are created when a seller marks a confirmed order as prepared. Prices: <Link href="/delivery-fees" style={{ color: GOLD, fontWeight: 700 }}>Delivery &amp; Fees</Link>.
            Retry / cancel / size per parcel: in the order drawer.
          </p>
        </div>
        <Btn onClick={load}><RefreshCw size={13} /> Refresh</Btn>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {!data || !s ? <section style={card}><BrandLoader variant="section" minHeight={220} /></section> : (
        <>
          {data.mode === 'fake' && (
            <Notice tone="info">Fake mode: no request reaches Intigo, parcels get “FAKE-…” references. Test statuses with <code>php artisan intigo:simulate-webhook FAKE-12 5000</code>. Set INTIGO_MODE=live to go live.</Notice>
          )}

          <section style={{ ...card, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <Check ok={s.api_key_set} label="API key (INTIGO_API_KEY)" detail="Check it with php artisan intigo:ping (read-only)." />
            <Check ok={s.webhook_secret_set} label="Webhook secret (INTIGO_WEBHOOK_SECRET)" detail={<>Intigo → Configuration → Webhook: <code style={{ wordBreak: 'break-all' }}>{s.webhook_url}</code></>} />
            <Check ok={s.regions_synced} label="Governorates & delegations" detail={`${s.cities} governorates, ${s.districts} delegations (php artisan intigo:sync-regions)`} />
            <Check ok={s.platform_pickup_index !== null && s.platform_pickup_index !== ''} label="CHOOSE'Tounsi pickup index" detail="INTIGO_PLATFORM_PICKUP_INDEX, for the platform's own products." />
            <Check ok={s.active_sellers > 0 && s.sellers_with_pickup >= s.active_sellers} label="Sellers' pickup addresses"
              detail={<>{s.sellers_with_pickup} / {s.active_sellers} active sellers have an Intigo pickup index (set it on the <Link href="/sellers" style={{ color: GOLD }}>seller page</Link>).</>} />
            <Check ok label={`Customer may open parcels: ${s.can_open ? 'yes' : 'no'}`} detail="Changed on the Delivery & Fees page." />
          </section>

          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: RED, margin: 0 }}>Failed sends ({data.failed.length})</h2>
            <p style={hint}>Never retried automatically (validation, API key, balance…). Fix the cause, then Retry send.</p>
            <ParcelTable rows={data.failed} empty="No failed send." retry={retry} busy={busy} />
          </section>

          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: GOLD, margin: 0 }}>Needs attention ({data.attention.length})</h2>
            <p style={hint}>Cancelled by Intigo, cancellation refused past pickup, status that could not be applied… Dismiss it from the order drawer once handled.</p>
            <ParcelTable rows={data.attention} empty="Nothing to check." busy={busy} />
          </section>

          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Sends in progress ({data.pending.length})</h2>
            <p style={hint}>Queued or retrying after a timeout / Intigo error (needs php artisan queue:work). intigo:sync-statuses re-queues stuck ones.</p>
            <ParcelTable rows={data.pending} empty="None." busy={busy} />
          </section>

          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Recent requests</h2>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={errorsOnly} onChange={e => setErrorsOnly(e.target.checked)} /> Errors only
              </label>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead><tr>{['When', 'Mode', 'Request', 'HTTP', 'ms', 'Parcel', 'Error'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.logs.map(l => (
                    <tr key={l.id} onClick={() => showLog(l.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                      <td style={td}>{l.mode}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11.5 }}>{l.method} {l.endpoint}</td>
                      <td style={{ ...td, fontWeight: 800, color: l.http_status && l.http_status < 300 ? GREEN : RED }}>{l.http_status ?? '—'}</td>
                      <td style={td}>{l.duration_ms ?? '—'}</td>
                      <td style={td}>{l.seller_order_id ?? '—'}</td>
                      <td style={{ ...td, color: '#fca5a5' }}>{l.error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {openLog && <pre style={{ margin: 0, maxHeight: 360, overflow: 'auto', fontSize: 11, background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 12, color: 'var(--text-primary)' }}>{openLog.body}</pre>}
            <p style={hint}>Click a row to see the request and answer (the API key is never stored).</p>
          </section>

          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Recent carrier events</h2>
            {data.events.length === 0 ? <p style={hint}>No webhook or poll received yet.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead><tr>{['When', 'Parcel', 'Status', 'Source', 'Result'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.events.map(e => (
                      <tr key={e.id}>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString()}</td>
                        <td style={{ ...td, fontFamily: 'monospace' }}>{e.nid}</td>
                        <td style={td}>{e.old_status ?? '—'} → <strong>{e.new_status}</strong> {e.status_label}</td>
                        <td style={td}>{e.source}</td>
                        <td style={{ ...td, color: e.processed_at ? 'var(--text-muted)' : GOLD }}>{e.result ?? (e.processed_at ? '' : 'not processed yet')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
