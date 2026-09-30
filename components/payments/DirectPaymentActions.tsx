'use client'

/**
 * Direct admin actions for a seller, without a WhatsApp request:
 *   "Recharger le portefeuille" — money received → ad wallet credited as real money
 *   "Changer de plan"           — paid plan + duration → plan switched with its benefits
 * Both create the same records and logs as an approved payment request.
 */

import { useEffect, useState } from 'react'
import { plansApi } from '@/lib/api/subscriptions'
import type { Plan } from '@/types/subscriptions'
import { METHOD_LABELS, notifyPendingChanged, paymentRequestsApi, type PaymentMethod } from '@/lib/paymentRequestsApi'

const box: React.CSSProperties = { border: '1px solid var(--border-subtle, #2a2f38)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }
const field: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-subtle, #2a2f38)', background: 'var(--bg-secondary, #16191f)',
  color: 'var(--text-primary, #fcfdfd)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #9ca3af)', display: 'flex', flexDirection: 'column', gap: 4 }
const title: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #fcfdfd)', margin: 0 }

function SubmitBtn({ children, disabled, tone }: { children: React.ReactNode; disabled?: boolean; tone: string }) {
  return (
    <button type="submit" disabled={disabled} style={{
      padding: '8px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, background: `${tone}1a`, border: `1px solid ${tone}55`, color: tone,
    }}>{children}</button>
  )
}

function MethodSelect({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as PaymentMethod)} style={field}>
      {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
    </select>
  )
}

export default function DirectPaymentActions({ sellerId, onDone }: { sellerId: number; onDone?: (message: string) => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Top-up
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('d17')
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [busyTop, setBusyTop] = useState(false)

  // Plan
  const [plans, setPlans] = useState<Plan[]>([])
  const [plan, setPlan] = useState('')
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [price, setPrice] = useState('')
  const [pMethod, setPMethod] = useState<PaymentMethod>('d17')
  const [pRef, setPRef] = useState('')
  const [pNote, setPNote] = useState('')
  const [busyPlan, setBusyPlan] = useState(false)

  useEffect(() => {
    plansApi.list().then(p => setPlans(p.plans.filter(x => x.is_active && !x.archived_at && x.price_monthly > 0))).catch(() => {})
  }, [])

  const selected = plans.find(p => p.slug === plan)
  useEffect(() => {
    if (!selected) return
    setPrice(String(period === 'yearly' && selected.price_yearly != null ? selected.price_yearly : selected.price_monthly))
  }, [selected, period])

  const done = (text: string) => { setMsg({ ok: true, text }); notifyPendingChanged(); onDone?.(text) }

  const topUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busyTop) return
    if (!window.confirm(`Créditer ${amount} DT (argent réel) sur le portefeuille publicitaire de ce vendeur ?`)) return
    setBusyTop(true); setMsg(null)
    try {
      const r = await paymentRequestsApi.directTopUp({ seller_id: sellerId, amount: Number(amount), payment_method: method, transaction_reference: ref || undefined, note: note || undefined })
      setAmount(''); setRef(''); setNote('')
      done(`Portefeuille rechargé (${r.reference}).`)
    } catch (err: any) { setMsg({ ok: false, text: err.message }) } finally { setBusyTop(false) }
  }

  const changePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busyPlan || !selected) return
    if (!window.confirm(`Passer ce vendeur au plan ${selected.name} (${period === 'yearly' ? 'annuel' : 'mensuel'}) pour ${price} DT ?`)) return
    setBusyPlan(true); setMsg(null)
    try {
      const r = await paymentRequestsApi.directPlanChange({
        seller_id: sellerId, plan, billing_period: period, amount: Number(price), payment_method: pMethod,
        transaction_reference: pRef || undefined, note: pNote || undefined,
      })
      setPRef(''); setPNote('')
      done(`Plan ${selected.name} activé (${r.reference}).`)
    } catch (err: any) { setMsg({ ok: false, text: err.message }) } finally { setBusyPlan(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {msg && <p role={msg.ok ? 'status' : 'alert'} style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</p>}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
        <form onSubmit={topUp} style={box}>
          <p style={title}>Recharger le portefeuille</p>
          <label style={label}>Montant reçu (DT)
            <input required type="number" min="0.001" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} style={field} />
          </label>
          <label style={label}>Moyen de paiement<MethodSelect value={method} onChange={setMethod} /></label>
          <label style={label}>Référence de transaction<input maxLength={100} value={ref} onChange={e => setRef(e.target.value)} style={field} /></label>
          <label style={label}>Note<input maxLength={1000} value={note} onChange={e => setNote(e.target.value)} style={field} /></label>
          <div><SubmitBtn tone="#4ade80" disabled={busyTop || !(Number(amount) > 0)}>{busyTop ? 'Enregistrement…' : 'Recharger'}</SubmitBtn></div>
        </form>

        <form onSubmit={changePlan} style={box}>
          <p style={title}>Changer de plan</p>
          <label style={label}>Plan
            <select required value={plan} onChange={e => setPlan(e.target.value)} style={field}>
              <option value="">Choisir…</option>
              {plans.map(p => <option key={p.slug} value={p.slug}>{p.name} — {p.price_monthly} DT/mois</option>)}
            </select>
          </label>
          <label style={label}>Durée
            <select value={period} onChange={e => setPeriod(e.target.value as 'monthly' | 'yearly')} style={field}>
              <option value="monthly">Mensuel (30 jours)</option>
              <option value="yearly" disabled={selected ? selected.price_yearly == null : false}>Annuel (1 an)</option>
            </select>
          </label>
          <label style={label}>Montant reçu (DT)<input required type="number" min="0" step="0.001" value={price} onChange={e => setPrice(e.target.value)} style={field} /></label>
          <label style={label}>Moyen de paiement<MethodSelect value={pMethod} onChange={setPMethod} /></label>
          <label style={label}>Référence de transaction<input maxLength={100} value={pRef} onChange={e => setPRef(e.target.value)} style={field} /></label>
          <label style={label}>Note<input maxLength={1000} value={pNote} onChange={e => setPNote(e.target.value)} style={field} /></label>
          <div><SubmitBtn tone="#f59e0b" disabled={busyPlan || !selected || price === ''}>{busyPlan ? 'Enregistrement…' : 'Changer de plan'}</SubmitBtn></div>
        </form>
      </div>
    </div>
  )
}
