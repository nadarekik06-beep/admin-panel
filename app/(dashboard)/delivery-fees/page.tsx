'use client'

// Delivery & Fees: what the client pays per seller parcel, what the delivery
// company keeps, what a free-delivery seller pays, return / refused-parcel fees,
// and which checkout payment methods are on. Values apply to NEW orders only:
// every parcel keeps the amounts frozen at its checkout.

import { useEffect, useMemo, useState } from 'react'
import {
  deliverySettingsApi, toMillimes, fromMillimes,
  type DeliverySettingsPayload, type DeliverySettingsForm, type PaymentMethodKey,
} from '@/lib/deliverySettingsApi'
import { Btn, card, input, Notice, GREEN, RED, GOLD } from '../sponsoring/_components/ui'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import BrandLoader from '@/components/brand/BrandLoader'

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 5 }
const hint: React.CSSProperties = { fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }

const AMOUNTS: { key: Exclude<keyof DeliverySettingsForm, 'refused_parcel_fee_paid_by' | 'payment_methods'>; label: string; help: string }[] = [
  { key: 'client_delivery_fee', label: 'Client delivery fee (TND)', help: 'Cash the client pays per seller parcel (each seller in the cart = one pickup = one parcel).' },
  { key: 'agency_delivery_cost', label: 'Agency delivery cost (TND)', help: 'What the delivery company keeps per parcel, out of the cash it collects.' },
  { key: 'seller_free_delivery_contribution', label: 'Seller free-delivery contribution (TND)', help: 'Deducted from the seller payout per parcel when the seller offers free delivery.' },
  { key: 'return_shipping_fee', label: 'Return shipping fee (TND)', help: 'Return pick-up: paid by the seller when the item was wrong / defective, else deducted from the client refund.' },
  { key: 'refused_parcel_agency_fee', label: 'Refused parcel agency fee (TND)', help: 'What the delivery company charges for a parcel the client refused at the door (can be 0).' },
]

const METHODS: { key: PaymentMethodKey; label: string }[] = [
  { key: 'cod', label: 'Cash on delivery' },
  { key: 'card', label: 'Bank card (Stripe)' },
  { key: 'd17', label: 'D17' },
  { key: 'wallet', label: 'Wallet' },
]

const FIELD_LABELS: Record<string, string> = {
  client_delivery_fee: 'Client delivery fee',
  agency_delivery_cost: 'Agency delivery cost',
  seller_free_delivery_contribution: 'Seller free-delivery contribution',
  return_shipping_fee: 'Return shipping fee',
  refused_parcel_agency_fee: 'Refused parcel agency fee',
  refused_parcel_fee_paid_by: 'Refused parcel fee paid by',
  'payment_method.card': 'Payment: bank card',
  'payment_method.d17': 'Payment: D17',
  'payment_method.wallet': 'Payment: wallet',
}

function toForm(d: DeliverySettingsPayload): DeliverySettingsForm {
  const s = d.settings
  const t = (v: number) => fromMillimes(Math.round(v * 1000))
  return {
    client_delivery_fee: t(s.client_delivery_fee),
    agency_delivery_cost: t(s.agency_delivery_cost),
    seller_free_delivery_contribution: t(s.seller_free_delivery_contribution),
    return_shipping_fee: t(s.return_shipping_fee),
    refused_parcel_agency_fee: t(s.refused_parcel_agency_fee),
    refused_parcel_fee_paid_by: s.refused_parcel_fee_paid_by,
    payment_methods: { ...d.payment_methods },
  }
}

function Margin({ label, millimes, formula }: { label: string; millimes: number | null; formula: string }) {
  const tone = millimes === null ? 'var(--text-muted)' : millimes < 0 ? RED : GREEN
  return (
    <div style={{ ...card, padding: 14, flex: '1 1 220px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 900, color: tone, margin: '6px 0 2px' }}>{millimes === null ? '—' : `${fromMillimes(millimes)} TND`}</p>
      <p style={hint}>{formula}</p>
    </div>
  )
}

export default function DeliveryFeesPage() {
  const [data, setData] = useState<DeliverySettingsPayload | null>(null)
  const [form, setForm] = useState<DeliverySettingsForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  usePageLoading(!data && msg?.tone !== 'error')

  useEffect(() => {
    deliverySettingsApi.get().then(d => { setData(d); setForm(toForm(d)) }).catch(e => setMsg({ tone: 'error', text: e.message }))
  }, [])

  // Live margins from what is typed (integer millimes, no float math)
  const live = useMemo(() => {
    if (!form) return null
    const m = (k: keyof DeliverySettingsForm) => toMillimes(String(form[k]))
    const client = m('client_delivery_fee'), agency = m('agency_delivery_cost'), contrib = m('seller_free_delivery_contribution')
    return {
      normal: client !== null && agency !== null ? client - agency : null,
      free: contrib !== null && agency !== null ? contrib - agency : null,
      invalid: AMOUNTS.filter(a => toMillimes(String(form[a.key])) === null).map(a => a.key),
    }
  }, [form])

  const setAmount = (k: (typeof AMOUNTS)[number]['key'], v: string) => setForm(f => (f ? { ...f, [k]: v } : f))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !live || live.invalid.length) return
    setBusy(true); setMsg(null)
    try {
      const normalized = { ...form }
      for (const a of AMOUNTS) normalized[a.key] = String(form[a.key]).trim().replace(',', '.')
      const res = await deliverySettingsApi.save(normalized)
      setData(res.data); setForm(toForm(res.data))
      setMsg({ tone: 'ok', text: res.message })
    } catch (err: any) { setMsg({ tone: 'error', text: err.message }) } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Delivery &amp; Fees</h1>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          One external delivery company. Each seller in an order ships one parcel with its own fee and cash-on-delivery amount.
          Changes apply to new orders only: existing orders, payouts and reports keep the amounts frozen at checkout.
        </p>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {!form || !data ? <section style={card}><BrandLoader variant="section" minHeight={220} /></section> : (
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Delivery pricing</h2>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {AMOUNTS.map(a => {
                const bad = live?.invalid.includes(a.key)
                return (
                  <label key={a.key} style={lbl}>{a.label}
                    <input
                      required inputMode="decimal" value={form[a.key]}
                      onChange={e => setAmount(a.key, e.target.value)}
                      aria-invalid={bad || undefined}
                      style={{ ...input, borderColor: bad ? RED : undefined }}
                    />
                    {bad ? <span style={{ ...hint, color: RED }}>Enter an amount ≥ 0 with at most 3 decimals.</span> : <span style={hint}>{a.help}</span>}
                  </label>
                )
              })}
              <label style={lbl}>Refused parcel fee paid by
                <select value={form.refused_parcel_fee_paid_by} onChange={e => setForm(f => f && ({ ...f, refused_parcel_fee_paid_by: e.target.value as 'platform' | 'seller' }))} style={input}>
                  <option value="platform">Platform (delivery loss in finance)</option>
                  <option value="seller">Seller (deducted from the next settlement)</option>
                </select>
                <span style={hint}>A refused parcel never generates a payout or a commission.</span>
              </label>
            </div>
          </section>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Margin label="Platform margin · normal parcel" millimes={live?.normal ?? null} formula="client delivery fee − agency cost" />
            <Margin label="Platform margin · free-delivery parcel" millimes={live?.free ?? null} formula="seller contribution − agency cost" />
          </div>
          {live && ((live.normal ?? 0) < 0 || (live.free ?? 0) < 0) && (
            <Notice tone="error">
              {(live.normal ?? 0) < 0 && <>Normal parcels lose {fromMillimes(-(live.normal ?? 0))} TND each. </>}
              {(live.free ?? 0) < 0 && <>Free-delivery parcels lose {fromMillimes(-(live.free ?? 0))} TND each. </>}
              You can still save.
            </Notice>
          )}

          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Checkout payment methods</h2>
            <p style={hint}>A method that is off shows “Coming soon” at checkout and is refused by the API. Cash on delivery is always on.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {METHODS.map(m => {
                const on = form.payment_methods[m.key]
                return (
                  <label key={m.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, cursor: m.key === 'cod' ? 'default' : 'pointer',
                    border: '1px solid var(--border-subtle)', background: on ? `${GREEN}14` : 'rgba(255,255,255,.03)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                  }}>
                    <input type="checkbox" checked={on} disabled={m.key === 'cod'}
                      onChange={e => setForm(f => f && ({ ...f, payment_methods: { ...f.payment_methods, [m.key]: e.target.checked } }))} />
                    {m.label}
                    <span style={{ fontSize: 11, fontWeight: 800, color: on ? GREEN : GOLD }}>{on ? 'On' : 'Coming soon'}</span>
                  </label>
                )
              })}
            </div>
          </section>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn type="submit" tone="gold" loading={busy} disabled={!!live?.invalid.length}>Save</Btn>
            <Btn onClick={() => setForm(toForm(data))}>Reset</Btn>
          </div>

          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Change history</h2>
            {data.history.length === 0 ? <p style={hint}>No change yet.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 560 }}>
                  <thead>
                    <tr style={{ textAlign: 'start', color: 'var(--text-muted)' }}>
                      {['When', 'Who', 'Setting', 'Old', 'New'].map(h => <th key={h} style={{ textAlign: 'start', padding: '6px 8px', fontWeight: 700, borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map(h => (
                      <tr key={h.id} style={{ color: 'var(--text-primary)' }}>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{new Date(h.created_at).toLocaleString()}</td>
                        <td style={{ padding: '6px 8px' }}>{h.changed_by_name ?? (h.changed_by ? `#${h.changed_by}` : 'system')}</td>
                        <td style={{ padding: '6px 8px' }}>{FIELD_LABELS[h.field] ?? h.field}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{h.old_value ?? '—'}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 800 }}>{h.new_value ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </form>
      )}
    </div>
  )
}
