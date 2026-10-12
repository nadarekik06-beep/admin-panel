'use client'

// Delivery & Fees: per parcel size (S / L / XL), what the client pays, what
// Intigo charges to deliver and to bring a parcel back, and what a
// free-delivery seller pays; the after-sale return fee, the "customer may open
// the parcel" switch and the checkout payment methods. Values apply to NEW
// orders only: every parcel keeps the amounts frozen at its checkout.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  deliverySettingsApi, toMillimes, fromMillimes, PARCEL_SIZES, SIZE_FIELDS,
  type DeliverySettingsPayload, type DeliverySettingsForm, type PaymentMethodKey, type ParcelSize, type SizeField,
} from '@/lib/deliverySettingsApi'
import { Btn, card, input, Notice, GREEN, RED, GOLD } from '../sponsoring/_components/ui'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import BrandLoader from '@/components/brand/BrandLoader'

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 5 }
const hint: React.CSSProperties = { fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }
const th: React.CSSProperties = { textAlign: 'start', padding: '8px 8px', fontSize: 11.5, fontWeight: 800, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'bottom' }
const td: React.CSSProperties = { padding: '8px 8px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }

const SIZE_INFO: Record<ParcelSize, string> = {
  S: 'Small (Intigo package_size 1): clothes, jewelry, cosmetics',
  L: 'Large (package_size 4): shoes, bags, small appliances',
  XL: 'Extra large (package_size 5): furniture, large appliances, carpets',
}

const COLUMNS: { key: SizeField; label: string; help: string }[] = [
  { key: 'client_fee', label: 'Client fee', help: 'What the client pays for this parcel at checkout.' },
  { key: 'agency_cost', label: 'Intigo delivery cost', help: 'What Intigo keeps per delivered parcel.' },
  { key: 'return_fee', label: 'Intigo return fee', help: 'Charged when the parcel comes back (refused / not delivered).' },
  { key: 'seller_contribution', label: 'Seller contribution', help: 'Taken from the seller payout when the seller offers free delivery.' },
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
  return_shipping_fee: 'After-sale return fee',
  refused_parcel_agency_fee: 'Refused parcel agency fee',
  refused_parcel_fee_paid_by: 'Return fee of a refused parcel paid by',
  intigo_can_open: 'Customer may open the parcel',
  'payment_method.card': 'Payment: bank card',
  'payment_method.d17': 'Payment: D17',
  'payment_method.wallet': 'Payment: wallet',
}
const fieldLabel = (f: string) => {
  const m = /^(S|L|XL)\.(\w+)$/.exec(f)
  if (m) return `${m[1]} · ${COLUMNS.find(c => c.key === m[2])?.label ?? m[2]}`
  return FIELD_LABELS[f] ?? f
}

function toForm(d: DeliverySettingsPayload): DeliverySettingsForm {
  const t = (v: number) => fromMillimes(Math.round(v * 1000))
  const sizes = {} as DeliverySettingsForm['sizes']
  for (const s of PARCEL_SIZES) {
    const r = d.sizes[s]
    sizes[s] = { client_fee: t(r.client_fee), agency_cost: t(r.agency_cost), return_fee: t(r.return_fee), seller_contribution: t(r.seller_contribution) }
  }
  return {
    sizes,
    return_shipping_fee: t(d.settings.return_shipping_fee),
    refused_parcel_fee_paid_by: d.settings.refused_parcel_fee_paid_by,
    intigo_can_open: !!d.settings.intigo_can_open,
    payment_methods: { ...d.payment_methods },
  }
}

function MarginCell({ millimes }: { millimes: number | null }) {
  const tone = millimes === null ? 'var(--text-muted)' : millimes < 0 ? RED : GREEN
  return <span style={{ fontWeight: 900, color: tone }}>{millimes === null ? '—' : `${fromMillimes(millimes)}`}</span>
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

  // Live margins per size from what is typed (integer millimes, no float math)
  const live = useMemo(() => {
    if (!form) return null
    const invalid: string[] = []
    const margins = {} as Record<ParcelSize, { normal: number | null; free: number | null }>
    for (const s of PARCEL_SIZES) {
      const m = (k: SizeField) => toMillimes(form.sizes[s][k])
      for (const k of SIZE_FIELDS) if (m(k) === null) invalid.push(`${s}.${k}`)
      const client = m('client_fee'), agency = m('agency_cost'), contrib = m('seller_contribution')
      margins[s] = {
        normal: client !== null && agency !== null ? client - agency : null,
        free: contrib !== null && agency !== null ? contrib - agency : null,
      }
    }
    if (toMillimes(form.return_shipping_fee) === null) invalid.push('return_shipping_fee')
    return { margins, invalid }
  }, [form])

  const setRate = (s: ParcelSize, k: SizeField, v: string) =>
    setForm(f => (f ? { ...f, sizes: { ...f.sizes, [s]: { ...f.sizes[s], [k]: v } } } : f))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !live || live.invalid.length) return
    setBusy(true); setMsg(null)
    try {
      const clean = (v: string) => v.trim().replace(',', '.')
      const sizes = {} as DeliverySettingsForm['sizes']
      for (const s of PARCEL_SIZES) {
        sizes[s] = { client_fee: clean(form.sizes[s].client_fee), agency_cost: clean(form.sizes[s].agency_cost), return_fee: clean(form.sizes[s].return_fee), seller_contribution: clean(form.sizes[s].seller_contribution) }
      }
      const res = await deliverySettingsApi.save({ ...form, sizes, return_shipping_fee: clean(form.return_shipping_fee) })
      setData(res.data); setForm(toForm(res.data))
      setMsg({ tone: 'ok', text: res.message })
    } catch (err: any) { setMsg({ tone: 'error', text: err.message }) } finally { setBusy(false) }
  }

  const losing = live ? PARCEL_SIZES.filter(s => (live.margins[s].normal ?? 0) < 0 || (live.margins[s].free ?? 0) < 0) : []

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Delivery &amp; Fees</h1>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Delivery company: Intigo{data ? ` (${data.intigo.mode === 'live' ? 'live' : 'fake mode: no real parcels'})` : ''} · <Link href="/intigo" style={{ color: GOLD, fontWeight: 700 }}>Intigo page</Link>.
          Each seller in an order ships one parcel; its size is the largest of its products (S / L / XL) and sets every amount below.
          Changes apply to new orders only: existing orders, payouts and reports keep the amounts frozen at checkout.
        </p>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {!form || !data ? <section style={card}><BrandLoader variant="section" minHeight={220} /></section> : (
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Prices per parcel size (TND)</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={th}>Size</th>
                    {COLUMNS.map(c => <th key={c.key} style={th} title={c.help}>{c.label}<div style={{ ...hint, fontWeight: 500, fontSize: 10.5 }}>{c.help}</div></th>)}
                    <th style={th}>Margin · normal<div style={{ ...hint, fontSize: 10.5 }}>client fee − Intigo cost</div></th>
                    <th style={th}>Margin · free delivery<div style={{ ...hint, fontSize: 10.5 }}>seller contribution − Intigo cost</div></th>
                  </tr>
                </thead>
                <tbody>
                  {PARCEL_SIZES.map(s => (
                    <tr key={s}>
                      <td style={td}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>{s}</div>
                        <div style={{ ...hint, fontSize: 10.5, maxWidth: 170 }}>{SIZE_INFO[s]}</div>
                      </td>
                      {COLUMNS.map(c => {
                        const bad = live?.invalid.includes(`${s}.${c.key}`)
                        return (
                          <td key={c.key} style={td}>
                            <input required inputMode="decimal" value={form.sizes[s][c.key]} aria-label={`${s} ${c.label}`}
                              onChange={e => setRate(s, c.key, e.target.value)} aria-invalid={bad || undefined}
                              style={{ ...input, width: 110, borderColor: bad ? RED : undefined }} />
                          </td>
                        )
                      })}
                      <td style={td}><MarginCell millimes={live?.margins[s].normal ?? null} /></td>
                      <td style={td}><MarginCell millimes={live?.margins[s].free ?? null} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!!live?.invalid.length && <span style={{ ...hint, color: RED }}>Every amount must be ≥ 0 with at most 3 decimals.</span>}
            {losing.length > 0 && (
              <Notice tone="error">Size {losing.join(', ')}: some parcels lose money (negative margin). You can still save.</Notice>
            )}
          </section>

          <section style={{ ...card, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <label style={lbl}>Return fee of a refused parcel paid by
              <select value={form.refused_parcel_fee_paid_by} onChange={e => setForm(f => f && ({ ...f, refused_parcel_fee_paid_by: e.target.value as 'platform' | 'seller' }))} style={input}>
                <option value="platform">Platform (delivery loss in finance)</option>
                <option value="seller">Seller (deducted from the next settlement)</option>
              </select>
              <span style={hint}>The Intigo return fee of the parcel&apos;s size. A refused parcel never generates a payout or a commission.</span>
            </label>
            <label style={lbl}>After-sale return fee (TND)
              <input required inputMode="decimal" value={form.return_shipping_fee}
                onChange={e => setForm(f => f && ({ ...f, return_shipping_fee: e.target.value }))}
                style={{ ...input, borderColor: live?.invalid.includes('return_shipping_fee') ? RED : undefined }} />
              <span style={hint}>Complaint returns (booked by hand in the Intigo dashboard): paid by the seller when the item was wrong / defective, else deducted from the client refund.</span>
            </label>
            <label style={{ ...lbl, flexDirection: 'row', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.intigo_can_open} onChange={e => setForm(f => f && ({ ...f, intigo_can_open: e.target.checked }))} style={{ marginTop: 3 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: 'var(--text-primary)' }}>Customer may open the parcel before paying</span>
                <span style={hint}>Sent with every new Intigo parcel (can_open). Off by default.</span>
              </span>
            </label>
          </section>

          <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Checkout payment methods</h2>
            <p style={hint}>A method that is off shows “Coming soon” at checkout and is refused by the API. Cash on delivery is always on (Intigo parcels are COD only).</p>
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
                        <td style={{ padding: '6px 8px' }}>{fieldLabel(h.field)}</td>
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
