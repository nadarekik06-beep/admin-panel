'use client'

// Demandes de paiement: manual WhatsApp payments (ad-wallet top-ups, plan upgrades).
// List with filters + search, detail with seller info, "contact on WhatsApp", approve
// (amount received / method / reference) or reject (reason). Each request is decided once.

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { money } from '@/lib/adsAdminApi'
import {
  METHOD_LABELS, notifyPendingChanged, paymentRequestsApi, STATUS_LABELS, TYPE_LABELS,
  type AdminPaymentRequest, type PaymentMethod,
} from '@/lib/paymentRequestsApi'
import { Btn, card, input, Notice, Stat } from '../sponsoring/_components/ui'
import { PaymentsShell, RequestStatusChip } from './_components/shell'

const td: React.CSSProperties = { padding: '9px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, verticalAlign: 'top' }
const th: React.CSSProperties = { padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left' }
const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const what = (r: AdminPaymentRequest) =>
  r.type === 'wallet_topup'
    ? money(r.amount_received ?? r.amount)
    : `${r.current_plan?.name ?? '—'} → ${r.requested_plan?.name ?? '—'} · ${money(r.amount_received ?? r.amount)}${r.billing_period === 'yearly' ? ' / an' : ' / mois'}`

function RequestsInner() {
  const params = useSearchParams()
  const [filters, setFilters] = useState({ type: '', status: 'pending', date_from: '', date_to: '', search: '' })
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AdminPaymentRequest[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<number | null>(Number(params.get('id')) || null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(() => paymentRequestsApi.list({ ...filters, page })
    .then(r => { setRows(r.data); setMeta(r.meta); setCounts(r.counts ?? {}) })
    .catch(e => setMsg({ tone: 'error', text: e.message })), [filters, page])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  const onError = useCallback((text: string) => setMsg({ tone: 'error', text }), [])
  const onDecided = useCallback((text: string) => { setMsg({ tone: 'ok', text }); load(); notifyPendingChanged() }, [load])

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setPage(1); setFilters(f => ({ ...f, [k]: e.target.value })) }

  return (
    <PaymentsShell title="Demandes de paiement">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Stat label="Recharges en attente" value={counts.wallet_topup ?? 0} tone={(counts.wallet_topup ?? 0) > 0 ? '#f59e0b' : undefined} />
        <Stat label="Changements de plan en attente" value={counts.plan_upgrade ?? 0} tone={(counts.plan_upgrade ?? 0) > 0 ? '#f59e0b' : undefined} />
        <Stat label="Résultats (filtres)" value={meta.total} />
      </div>

      <section style={{ ...card, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <label style={lbl}>Recherche
          <input placeholder="Référence, boutique, vendeur, téléphone…" value={filters.search} onChange={set('search')} style={input} />
        </label>
        <label style={lbl}>Type
          <select value={filters.type} onChange={set('type')} style={input}>
            <option value="">Tous</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label style={lbl}>Statut
          <select value={filters.status} onChange={set('status')} style={input}>
            <option value="">Tous</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label style={lbl}>Du<input type="date" value={filters.date_from} onChange={set('date_from')} style={input} /></label>
        <label style={lbl}>Au<input type="date" value={filters.date_to} onChange={set('date_to')} style={input} /></label>
      </section>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: selected ? 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))' : '1fr', alignItems: 'start' }}>
        <section style={{ ...card, overflowX: 'auto' }}>
          {!rows.length ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Aucune demande.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr><th style={th}>Référence</th><th style={th}>Vendeur</th><th style={th}>Demande</th><th style={th}>Date</th><th style={th}>Statut</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r.id)} style={{ cursor: 'pointer', background: selected === r.id ? 'rgba(219,20,46,.08)' : undefined }}>
                    <td style={td}><code style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{r.reference}</code>{r.source === 'admin' && <><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>action directe</span></>}</td>
                    <td style={td}>
                      <b style={{ color: 'var(--text-primary)' }}>{r.seller.store_name ?? '—'}</b><br />
                      <span style={{ fontSize: 11.5 }}>{r.seller.name} · {r.seller.phone ?? '—'}</span>
                    </td>
                    <td style={td}>{TYPE_LABELS[r.type]}<br /><b style={{ color: 'var(--text-primary)' }}>{what(r)}</b></td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                    <td style={td}><RequestStatusChip status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {meta.last_page > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <Btn disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</Btn>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Page {meta.current_page} / {meta.last_page}</span>
              <Btn disabled={page >= meta.last_page} onClick={() => setPage(p => p + 1)}>›</Btn>
            </div>
          )}
        </section>

        {selected && (
          <RequestDetail key={selected} id={selected} onClose={() => setSelected(null)} onDecided={onDecided} onError={onError} />
        )}
      </div>
    </PaymentsShell>
  )
}

function RequestDetail({ id, onClose, onDecided, onError }: {
  id: number; onClose: () => void; onDecided: (text: string) => void; onError: (text: string) => void
}) {
  const [r, setR] = useState<AdminPaymentRequest | null>(null)
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('d17')
  const [txRef, setTxRef] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => paymentRequestsApi.get(id).then(x => { setR(x); setAmount(String(x.amount)) }).catch(e => onError(e.message)), [id, onError])
  useEffect(() => { load() }, [load])

  if (!r) return <section style={card}><p style={{ color: 'var(--text-muted)', margin: 0 }}>Chargement…</p></section>

  const decide = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return                                   // double click
    setBusy(true)
    try {
      const x = mode === 'approve'
        ? await paymentRequestsApi.approve(r.id, { payment_method: method, amount_received: Number(amount), transaction_reference: txRef || undefined, note: note || undefined })
        : await paymentRequestsApi.reject(r.id, reason.trim())
      setR(x); setMode(null)
      onDecided(x.status === 'approved'
        ? (x.type === 'wallet_topup' ? `${x.reference} approuvée — ${money(x.amount_received)} crédités sur le portefeuille.` : `${x.reference} approuvée — plan ${x.requested_plan?.name} activé.`)
        : `${x.reference} refusée.`)
    } catch (err: any) {
      onError(err.message)
      if (err.status === 409) load()                  // decided meanwhile (other admin / other tab)
    } finally { setBusy(false) }
  }

  const row = (k: string, v: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '4px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{k}</span><span style={{ color: 'var(--text-primary)', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}><code>{r.reference}</code> · {TYPE_LABELS[r.type]}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>Créée le {when(r.created_at)}{r.source === 'admin' ? ' · action directe admin' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><RequestStatusChip status={r.status} /><Btn onClick={onClose}>✕</Btn></div>
      </div>

      <div>
        {row('Boutique', r.seller.store_name ?? '—')}
        {row('Vendeur', <><Link href={`/sellers?view=${r.seller.id}`} style={{ color: 'inherit' }}>{r.seller.name}</Link> · ID {r.seller.id}</>)}
        {row('Email', r.seller.email ?? '—')}
        {row('Téléphone', r.seller.phone ?? '—')}
        {row('Solde pub. à la demande', money(r.seller.wallet_balance))}
        {r.type === 'wallet_topup'
          ? row('Montant demandé', <b>{money(r.amount)}</b>)
          : <>{row('Plan actuel → demandé', <b>{r.current_plan?.name} → {r.requested_plan?.name}</b>)}{row('Prix', <b>{money(r.amount)} ({r.billing_period === 'yearly' ? 'annuel' : 'mensuel'})</b>)}</>}
        {r.status === 'approved' && <>{row('Montant reçu', <b style={{ color: '#4ade80' }}>{money(r.amount_received)}</b>)}{row('Moyen', r.payment_method ? METHOD_LABELS[r.payment_method] : '—')}{row('Réf. transaction', r.transaction_reference ?? '—')}</>}
        {r.status === 'rejected' && row('Motif du refus', <span style={{ color: '#f87171' }}>{r.rejection_reason}</span>)}
        {r.admin_note && row('Note', r.admin_note)}
        {r.decided_by && row('Traitée par', `${r.decided_by.name} · ${when(r.decided_at)}`)}
      </div>

      {r.contact_url && (
        <a href={r.contact_url} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, textDecoration: 'none',
          background: '#25D3661f', border: '1px solid #25D36666', color: '#4ade80', fontSize: 13, fontWeight: 800,
        }}><MessageCircle size={15} />Contacter le vendeur sur WhatsApp</a>
      )}

      {r.message && (
        <details>
          <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}>Message WhatsApp du vendeur</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 10, padding: 10, margin: '6px 0 0', fontFamily: 'inherit' }}>{r.message}</pre>
        </details>
      )}

      {r.status === 'pending' && !mode && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn tone="green" onClick={() => setMode('approve')}>{r.type === 'wallet_topup' ? 'Approuver la recharge' : 'Approuver le changement de plan'}</Btn>
          <Btn tone="red" onClick={() => setMode('reject')}>Refuser</Btn>
        </div>
      )}

      {mode === 'approve' && (
        <form onSubmit={decide} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', padding: 12, borderRadius: 12, border: '1px solid #4ade8055' }}>
          <label style={lbl}>Montant reçu (DT)
            <input required type="number" min={r.type === 'wallet_topup' ? '0.001' : '0'} step="0.001" value={amount} onChange={e => setAmount(e.target.value)} style={input} />
          </label>
          <label style={lbl}>Moyen de paiement
            <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} style={input}>
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
            </select>
          </label>
          <label style={lbl}>Réf. transaction (optionnel)<input maxLength={100} value={txRef} onChange={e => setTxRef(e.target.value)} style={input} /></label>
          <label style={{ ...lbl, gridColumn: '1 / -1' }}>Note (optionnel)<input maxLength={1000} value={note} onChange={e => setNote(e.target.value)} style={input} /></label>
          <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {r.type === 'wallet_topup'
              ? 'Le montant reçu est crédité en argent réel (pas en crédit offert). Les campagnes en pause faute de solde reprennent automatiquement.'
              : `Le vendeur passe au plan ${r.requested_plan?.name} dès aujourd'hui (${r.billing_period === 'yearly' ? '1 an' : '30 jours'}), avec ses avantages et son crédit publicitaire mensuel.`}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn type="submit" tone="green" disabled={busy || amount === ''}>{busy ? 'Validation…' : 'Confirmer l’approbation'}</Btn>
            <Btn onClick={() => setMode(null)} disabled={busy}>Annuler</Btn>
          </div>
        </form>
      )}

      {mode === 'reject' && (
        <form onSubmit={decide} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, border: '1px solid #f8717155' }}>
          <label style={lbl}>Motif du refus (envoyé au vendeur)
            <textarea required minLength={3} maxLength={1000} rows={3} value={reason} onChange={e => setReason(e.target.value)} style={{ ...input, resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn type="submit" tone="red" disabled={busy || reason.trim().length < 3}>{busy ? 'Envoi…' : 'Confirmer le refus'}</Btn>
            <Btn onClick={() => setMode(null)} disabled={busy}>Annuler</Btn>
          </div>
        </form>
      )}

      {!!r.logs?.length && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Historique</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {r.logs.map((l, i) => (
              <li key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                <b style={{ color: 'var(--text-primary)' }}>{{ created: 'Créée', cancelled: 'Annulée', approved: 'Approuvée', rejected: 'Refusée' }[l.action] ?? l.action}</b>
                {' · '}{l.actor ? `${l.actor.name} (${l.actor_role})` : l.actor_role}{' · '}{when(l.created_at)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default function PaymentRequestsPage() {
  return <Suspense fallback={null}><RequestsInner /></Suspense>
}
