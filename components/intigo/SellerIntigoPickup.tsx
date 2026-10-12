'use client'

/**
 * Seller detail: which of the Intigo account's pickup addresses is this seller's.
 * Pickup addresses can only be created in the Intigo dashboard; "Load from
 * Intigo" lists them (read-only call) so the admin picks the matching one.
 * Without an index the seller's parcels are never sent (admin notified).
 */

import { useState } from 'react'
import { Truck, Download } from 'lucide-react'
import { intigoApi, type PickupAddress } from '@/lib/intigoApi'

export default function SellerIntigoPickup({ sellerId, index, label, onSaved }: {
  sellerId: number
  index: number | null | undefined
  label: string | null | undefined
  onSaved: (index: number | null, label: string | null) => void
}) {
  const [addresses, setAddresses] = useState<PickupAddress[] | null>(null)
  const [mode, setMode] = useState<string | null>(null)
  const [picked, setPicked] = useState<string>(index != null ? String(index) : '')
  const [manual, setManual] = useState<string>(index != null ? String(index) : '')
  const [busy, setBusy] = useState<'load' | 'save' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = async () => {
    setBusy('load'); setMsg(null)
    try {
      const res = await intigoApi.pickupAddresses()
      setAddresses(res.data); setMode(res.mode)
    } catch (e: any) { setMsg({ ok: false, text: e.message }) } finally { setBusy(null) }
  }

  const save = async (value: string) => {
    const idx = value.trim() === '' ? null : Number(value)
    if (idx !== null && (!Number.isInteger(idx) || idx < 0)) { setMsg({ ok: false, text: 'The index is a whole number ≥ 0.' }); return }
    const chosen = addresses?.find(a => a.index === idx)
    setBusy('save'); setMsg(null)
    try {
      const res = await intigoApi.setSellerPickup(sellerId, idx, chosen?.label ?? (idx === index ? label : null))
      setMsg({ ok: true, text: res.message ?? 'Saved.' })
      onSaved(res.data.intigo_pickup_index, res.data.intigo_pickup_label)
    } catch (e: any) { setMsg({ ok: false, text: e.message }) } finally { setBusy(null) }
  }

  const box: React.CSSProperties = { background: '#111a2e', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }
  const btn = (primary = false): React.CSSProperties => ({ ...box, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 700, background: primary ? 'rgba(25,143,65,0.25)' : '#111a2e', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: busy ? 0.6 : 1 })

  return (
    <div className="col-span-2" style={{ padding: 12, borderRadius: 12, background: 'rgba(96,165,250,0.06)', border: `1px solid ${index == null ? 'rgba(239,68,68,0.4)' : 'rgba(96,165,250,0.25)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa' }}>
        <Truck size={12} /> Intigo pickup index
        <span style={{ textTransform: 'none', letterSpacing: 0, color: index == null ? '#f87171' : '#4ade80' }}>
          · {index == null ? 'not set: parcels are not sent' : `#${index}${label ? ` (${label})` : ''}`}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '6px 0 8px', lineHeight: 1.45 }}>
        Create the seller&apos;s address in the Intigo dashboard first; put the seller name and phone at the start of the address text.
        Then load the list and pick it. Failed deliveries come back to this address.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={btn()} disabled={busy !== null} onClick={load}>
          <Download size={12} /> {busy === 'load' ? 'Loading…' : 'Load from Intigo'}
        </button>
        {addresses && (
          <>
            <select value={picked} onChange={e => setPicked(e.target.value)} style={{ ...box, maxWidth: 360 }}>
              <option value="">— No pickup address —</option>
              {addresses.map(a => (
                <option key={a.index} value={String(a.index)}>
                  #{a.index} · {a.label}{a.used_by.length ? ` (used by ${a.used_by.map(u => u.name).join(', ')})` : ''}
                </option>
              ))}
            </select>
            <button type="button" style={btn(true)} disabled={busy !== null} onClick={() => save(picked)}>Save</button>
          </>
        )}
        {!addresses && (
          <>
            <input value={manual} onChange={e => setManual(e.target.value.replace(/\D/g, ''))} placeholder="index" inputMode="numeric" style={{ ...box, width: 80 }} aria-label="Pickup index" />
            <button type="button" style={btn(true)} disabled={busy !== null} onClick={() => save(manual)}>Save index</button>
          </>
        )}
      </div>
      {mode === 'fake' && <p style={{ fontSize: 11, color: '#f59e0b', margin: '6px 0 0' }}>Fake mode: these are sample addresses, not your Intigo account&apos;s.</p>}
      {msg && <p style={{ fontSize: 11.5, margin: '6px 0 0', fontWeight: 700, color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</p>}
    </div>
  )
}
