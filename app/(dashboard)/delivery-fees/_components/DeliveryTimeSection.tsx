'use client'

// "Delivery time": admin-editable rules behind the delivery dates customers see (and the seller
// reminder timing for made-to-order products). Business days = working days minus holidays.
// Pickup / transit delays are internal: customers only see the resulting estimate.

import { useEffect, useState } from 'react'
import { deliveryTimeApi, type DeliveryTimeSettings } from '@/lib/deliveryTimeApi'
import { Btn, card, input, Notice } from '../../sponsoring/_components/ui'
import BrandLoader from '@/components/brand/BrandLoader'

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 5 }
const hint: React.CSSProperties = { fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }

const DAYS: { iso: number; label: string }[] = [
  { iso: 1, label: 'Mon' }, { iso: 2, label: 'Tue' }, { iso: 3, label: 'Wed' }, { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' }, { iso: 6, label: 'Sat' }, { iso: 7, label: 'Sun' },
]

export default function DeliveryTimeSection() {
  const [data, setData] = useState<DeliveryTimeSettings | null>(null)
  const [form, setForm] = useState<DeliveryTimeSettings | null>(null)
  const [newDate, setNewDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    deliveryTimeApi.get().then(d => { setData(d); setForm(d) }).catch(e => setMsg({ tone: 'error', text: e.message }))
  }, [])

  if (!form) {
    return <section style={card}>{msg ? <Notice tone="error">{msg.text}</Notice> : <BrandLoader variant="section" minHeight={120} />}</section>
  }

  const num = (v: string) => Math.max(0, Math.min(30, parseInt(v, 10) || 0))
  const patch = (p: Partial<DeliveryTimeSettings>) => setForm(f => f && ({ ...f, ...p }))
  const maxBelowMin = form.pickup_delay_max_business_days < form.pickup_delay_min_business_days
  const invalid = maxBelowMin || form.working_days.length === 0
  const dirty = JSON.stringify(form) !== JSON.stringify(data)

  const addHoliday = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || form.holidays.includes(newDate)) return
    patch({ holidays: [...form.holidays, newDate].sort() })
    setNewDate('')
  }

  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      const saved = await deliveryTimeApi.save(form)
      setData(saved); setForm(saved)
      setMsg({ tone: 'ok', text: 'Delivery time saved. The storefront uses it right away.' })
    } catch (e: any) {
      setMsg({ tone: 'error', text: e.message })
    } finally { setBusy(false) }
  }

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Delivery time (estimate shown to customers)</h2>
        <p style={{ ...hint, marginTop: 4 }}>
          Estimated delivery = order day (+ preparation days for made-to-order products) + pickup delay + transit, counted in business days
          (working days minus holidays, Africa/Tunis). Customers only see the resulting dates, never these delays.
        </p>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <label style={lbl}>Pickup delay, minimum (business days)
          <input type="number" min={0} max={30} value={form.pickup_delay_min_business_days}
            onChange={e => patch({ pickup_delay_min_business_days: num(e.target.value) })} style={input} />
        </label>
        <label style={lbl}>Pickup delay, maximum (business days)
          <input type="number" min={0} max={30} value={form.pickup_delay_max_business_days}
            onChange={e => patch({ pickup_delay_max_business_days: num(e.target.value) })} style={input} aria-invalid={maxBelowMin || undefined} />
        </label>
        <label style={lbl}>Transit (business days)
          <input type="number" min={0} max={30} value={form.transit_business_days}
            onChange={e => patch({ transit_business_days: num(e.target.value) })} style={input} />
        </label>
        <label style={lbl}>Order cut-off time (Africa/Tunis)
          <input type="time" value={form.order_cutoff_time} onChange={e => patch({ order_cutoff_time: e.target.value || '23:59' })} style={input} />
          <span style={hint}>Orders after it count as next-day orders.</span>
        </label>
      </div>

      <div style={lbl}>
        Working days (the delivery company does not pick up or deliver on the others)
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DAYS.map(d => {
            const on = form.working_days.includes(d.iso)
            return (
              <label key={d.iso} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: on ? 'rgba(25,143,65,.12)' : 'rgba(255,255,255,.03)', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={on}
                  onChange={e => patch({ working_days: (e.target.checked ? [...form.working_days, d.iso] : form.working_days.filter(x => x !== d.iso)).sort() })} />
                {d.label}
              </label>
            )
          })}
        </div>
      </div>

      <div style={lbl}>
        Holidays (non-working dates)
        <span style={hint}>Pre-filled with the fixed Tunisian public holidays (Jan 1, Mar 20, Apr 9, May 1, Jul 25, Aug 13, Oct 15, Dec 17). Islamic holidays move every year: add them here.</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...input, width: 180 }} aria-label="Holiday date to add" />
          <Btn onClick={addHoliday} disabled={!newDate}>Add holiday</Btn>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {form.holidays.length === 0 && <span style={hint}>No holiday.</span>}
          {form.holidays.map(h => (
            <span key={h} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 10px', borderRadius: 999, border: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {h}
              <button type="button" onClick={() => patch({ holidays: form.holidays.filter(x => x !== h) })} aria-label={`Remove holiday ${h}`}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 4px' }}>×</button>
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn tone="gold" onClick={save} loading={busy} disabled={invalid || !dirty}>Save delivery time</Btn>
        <Btn onClick={() => setForm(data)} disabled={!dirty}>Reset</Btn>
        {invalid && <span style={{ ...hint, alignSelf: 'center', color: '#f87171' }}>Maximum pickup delay must be ≥ minimum, and at least one working day is required.</span>}
      </div>
    </section>
  )
}
