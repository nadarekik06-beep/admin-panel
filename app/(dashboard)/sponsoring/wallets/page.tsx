'use client'

// Ad wallets: pending manual top-ups (confirm once / reject), seller wallets, ledger and
// manual adjustments (balance and/or free credit, with a note).

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { adsAdminApi, money, type TopUp, type WalletRow, type WalletTx } from '@/lib/adsAdminApi'
import { Btn, card, input, Notice, SponsoringShell } from '../_components/ui'

function WalletsInner() {
  const params = useSearchParams()
  const [pending, setPending] = useState<TopUp[]>([])
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<WalletRow[]>([])
  const [selected, setSelected] = useState<number | null>(Number(params.get('seller')) || null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const loadPending = useCallback(() => adsAdminApi.topUps('pending').then(r => setPending(r.data)).catch(e => setMsg({ tone: 'error', text: e.message })), [])
  useEffect(() => { loadPending() }, [loadPending])
  useEffect(() => {
    const t = setTimeout(() => adsAdminApi.wallets(search).then(r => setRows(r.data)).catch(e => setMsg({ tone: 'error', text: e.message })), 250)
    return () => clearTimeout(t)
  }, [search])

  const settle = async (id: number, confirm: boolean) => {
    const note = window.prompt(confirm ? 'Confirm this transfer? Optional note:' : 'Reject this top-up? Optional note:') ?? undefined
    if (note === undefined) return
    try {
      await (confirm ? adsAdminApi.confirmTopUp(id, note || undefined) : adsAdminApi.rejectTopUp(id, note || undefined))
      setMsg({ tone: 'ok', text: confirm ? 'Top-up confirmed — the wallet was credited.' : 'Top-up rejected.' })
      loadPending()
    } catch (e: any) { setMsg({ tone: 'error', text: e.message }) }
  }

  const td: React.CSSProperties = { padding: '9px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }

  return (
    <SponsoringShell title="Wallets & top-ups">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <section style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>Pending manual top-ups</h2>
        {!pending.length ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Nothing to confirm.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {pending.map(t => (
                  <tr key={t.id}>
                    <td style={td}>#{t.id}</td>
                    <td style={td}>{t.seller?.name}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.seller?.email}</span></td>
                    <td style={td}><b style={{ color: 'var(--text-primary)' }}>{money(t.amount)}</b></td>
                    <td style={td}>{t.gateway} · ref <code>{t.reference ?? '—'}</code></td>
                    <td style={td}>{new Date(t.created_at).toLocaleString('en-GB')}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <Btn tone="green" onClick={() => settle(t.id, true)}>Confirm</Btn>{' '}
                      <Btn tone="red" onClick={() => settle(t.id, false)}>Reject</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
        <section style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>Sellers</h2>
          <input placeholder="Search seller name or e-mail…" value={search} onChange={e => setSearch(e.target.value)} style={input} />
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <tbody>
              {rows.map(r => (
                <tr key={r.seller.id} onClick={() => setSelected(r.seller.id)} style={{ cursor: 'pointer', background: selected === r.seller.id ? 'rgba(219,20,46,.08)' : undefined }}>
                  <td style={td}>{r.seller.name}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.seller.email}</span></td>
                  <td style={td}>{money(r.balance)}</td>
                  <td style={td}>{money(r.credit_balance)} credit</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {selected && <WalletDetail sellerId={selected} onMessage={setMsg} />}
      </div>
    </SponsoringShell>
  )
}

function WalletDetail({ sellerId, onMessage }: { sellerId: number; onMessage: (m: { tone: 'ok' | 'error'; text: string }) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof adsAdminApi.wallet>> | null>(null)
  const [balance, setBalance] = useState('')
  const [credit, setCredit] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => adsAdminApi.wallet(sellerId).then(setData).catch(e => onMessage({ tone: 'error', text: e.message })), [sellerId, onMessage])
  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await adsAdminApi.adjust(sellerId, { balance_delta: balance ? Number(balance) : undefined, credit_delta: credit ? Number(credit) : undefined, note })
      onMessage({ tone: 'ok', text: 'Wallet adjusted.' })
      setBalance(''); setCredit(''); setNote('')
      load()
    } catch (err: any) { onMessage({ tone: 'error', text: err.message }) } finally { setBusy(false) }
  }

  const td: React.CSSProperties = { padding: '7px 6px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12.5 }
  if (!data) return <section style={card}><p style={{ color: 'var(--text-muted)' }}>Loading…</p></section>

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{data.seller.name}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{data.seller.email}</p>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Balance <b style={{ color: 'var(--text-primary)' }}>{money(data.wallet.balance)}</b> · credit <b style={{ color: 'var(--text-primary)' }}>{money(data.wallet.credit_balance)}</b>
        {data.wallet.credit_expires_at && ` (expires ${new Date(data.wallet.credit_expires_at).toLocaleDateString('en-GB')})`}
      </p>

      <form onSubmit={submit} style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
        <input type="number" step="0.001" placeholder="Balance ± DT" value={balance} onChange={e => setBalance(e.target.value)} style={input} aria-label="Balance change" />
        <input type="number" step="0.001" placeholder="Credit ± DT" value={credit} onChange={e => setCredit(e.target.value)} style={input} aria-label="Credit change" />
        <input required placeholder="Note (required)" value={note} onChange={e => setNote(e.target.value)} style={{ ...input, gridColumn: '1 / -1' }} />
        <div><Btn type="submit" tone="gold" disabled={busy || (!balance && !credit) || !note.trim()}>Apply adjustment</Btn></div>
      </form>

      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {data.transactions.map((t: WalletTx) => (
              <tr key={t.id}>
                <td style={td}>{t.type.replace(/_/g, ' ')}{t.clicks ? ` · ${t.clicks} clicks` : ''}{t.note ? ` · ${t.note}` : ''}</td>
                <td style={td}>{t.date ?? new Date(t.created_at).toLocaleDateString('en-GB')}</td>
                <td style={{ ...td, color: t.amount < 0 ? '#f87171' : '#4ade80', textAlign: 'right', whiteSpace: 'nowrap' }}>{t.amount > 0 ? '+' : ''}{money(t.amount)}</td>
              </tr>
            ))}
            {!data.transactions.length && <tr><td style={td}>No transactions.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function WalletsPage() {
  return <Suspense fallback={null}><WalletsInner /></Suspense>
}
