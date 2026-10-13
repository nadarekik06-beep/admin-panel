'use client'

/**
 * "Adresse de pickup" card: the seller's pickup address laid out in the order
 * of Intigo's "Nouvelle adresse" form (Adresse complète, Zone, map), then
 * contact, phone, postal code, notes. Every field has a Copy button so it can
 * be pasted into Intigo without typing.
 *
 * Actions: "Adresse vérifiée" → "Créer dans Intigo" (API) or "Pickup créé dans
 * Intigo" (typed by hand + its index). Edit form, change history (old → new).
 * Used on /sellers/[id] and the seller application review.
 */

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, History, MapPinned, Pencil, Save, ShieldCheck, Truck, X,
} from 'lucide-react'
import { format } from 'date-fns'
import BrandLoader from '@/components/brand/BrandLoader'
import ZoneCombobox, { ZoneBadge } from './ZoneCombobox'
import {
  PICKUP_STATUS, sellerPickupApi,
  type PickupCard, type PickupChange, type PickupInput, type PickupResponse, type ZoneOption,
} from '@/lib/sellerPickupApi'

const PickupMap = dynamic(() => import('./PickupMap'), {
  ssr: false,
  loading: () => <div className="h-[300px] rounded-xl bg-bg-primary border border-border" />,
})

const FIELD_LABELS: Record<string, string> = {
  adresse_complete: 'Adresse complète',
  intigo_zone_id:   'Zone',
  latitude:         'Latitude',
  longitude:        'Longitude',
  contact_name:     'Contact',
  phone:            'Téléphone',
  code_postal:      'Code postal',
  indications:      'Indications',
}

function formatPhone(p?: string | null) {
  return p && /^\d{8}$/.test(p) ? `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}` : (p ?? '')
}

function CopyButton({ value, label }: { value?: string | number | null; label: string }) {
  const [done, setDone] = useState(false)
  const text = value == null ? '' : String(value)
  return (
    <button type="button" disabled={!text} aria-label={`Copy ${label}`} title={`Copy ${label}`}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text) } catch {
          const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
          document.execCommand('copy'); ta.remove()
        }
        setDone(true); setTimeout(() => setDone(false), 1500)
      }}
      className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-30 ${
        done ? 'border-accent-green text-accent-green' : 'border-border text-text-secondary hover:text-text-primary hover:border-border-light'}`}>
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function Row({ n, label, value, copy, children, mono }: {
  n?: number; label: string; value?: string | number | null; copy?: string | number | null; children?: React.ReactNode; mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-b-0">
      <div className="w-40 shrink-0 pt-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {n ? <span className="text-accent-purple-light mr-1">{n}.</span> : null}{label}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        {children ?? <p className={`text-sm break-words ${value ? 'text-text-primary' : 'text-text-muted'} ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>}
      </div>
      <CopyButton value={copy !== undefined ? copy : value} label={label} />
    </div>
  )
}

export function PickupStatusBadge({ status }: { status: PickupCard['status'] }) {
  const s = PICKUP_STATUS[status]
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ color: s.color, background: s.bg }}>{s.label}</span>
}

function diffValue(field: string, values: Record<string, string | number | null> | null): string {
  if (!values) return '—'
  if (field === 'intigo_zone_id') return String(values.zone_label ?? values.intigo_zone_id ?? '—')
  const v = values[field]
  return v == null || v === '' ? '—' : String(v)
}

function HistoryTimeline({ history }: { history: PickupChange[] }) {
  if (!history.length) return <p className="text-xs text-text-muted">No change recorded.</p>
  return (
    <ol className="relative border-l border-border ml-2 space-y-4">
      {history.map(h => {
        const fields = h.changed_fields.filter(f => f !== 'longitude' || !h.changed_fields.includes('latitude'))
        return (
          <li key={h.id} className="ml-4">
            <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full" style={{ background: h.by_role === 'admin' ? '#7c3aed' : '#db142e' }} />
            <p className="text-xs text-text-secondary">
              <b className="text-text-primary">{format(new Date(h.at), 'dd MMM yyyy, HH:mm')}</b>
              {' · '}{h.by ?? 'unknown'} ({h.by_role}, {h.source === 'application' ? 'seller application' : h.source === 'settings' ? 'seller settings' : 'admin'})
              {h.pending_pickups > 0 && <span className="ml-2 text-accent-orange font-semibold">{h.pending_pickups} parcel(s) not collected yet</span>}
            </p>
            <div className="mt-1.5 space-y-1">
              {h.old === null ? (
                <p className="text-xs text-text-muted">First address: {diffValue('adresse_complete', h.new)} — {diffValue('intigo_zone_id', h.new)}</p>
              ) : fields.map(f => (
                <div key={f} className="text-xs grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-text-muted">{f === 'latitude' ? 'Position' : FIELD_LABELS[f] ?? f}</span>
                  <span className="break-words">
                    <span className="line-through text-red-400/80">{f === 'latitude' ? `${diffValue('latitude', h.old)}, ${diffValue('longitude', h.old)}` : diffValue(f, h.old)}</span>
                    <span className="text-text-muted mx-1.5">→</span>
                    <span className="text-emerald-300">{f === 'latitude' ? `${diffValue('latitude', h.new)}, ${diffValue('longitude', h.new)}` : diffValue(f, h.new)}</span>
                  </span>
                </div>
              ))}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ── Edit form (admin fixes the address, e.g. after a phone call) ─────────────
function EditForm({ card, onCancel, onSave }: { card: PickupCard; onCancel: () => void; onSave: (body: PickupInput) => Promise<void> }) {
  const [form, setForm] = useState({
    adresse_complete: card.adresse_complete ?? '', zone: (card.zone ?? null) as ZoneOption | null,
    latitude: card.latitude ?? null, longitude: card.longitude ?? null,
    contact_name: card.contact_name ?? '', phone: card.phone ?? '', code_postal: card.code_postal ?? '', indications: card.indications ?? '',
  })
  const [focus, setFocus] = useState<{ latitude: number; longitude: number; zoom: number; key: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickZone = async (z: ZoneOption | null) => {
    setForm(f => ({ ...f, zone: z }))
    if (!z) return
    const c = await sellerPickupApi.zoneCenter(z.id)
    if (c) setFocus({ latitude: c.latitude, longitude: c.longitude, zoom: c.precision === 'secteur' ? 16 : c.precision === 'delegation' ? 14 : 11, key: `z-${z.id}` })
  }

  const submit = async () => {
    setSaving(true); setError(null)
    try {
      await onSave({
        adresse_complete: form.adresse_complete, intigo_zone_id: form.zone?.id ?? null,
        latitude: form.latitude, longitude: form.longitude, contact_name: form.contact_name,
        phone: form.phone.replace(/\D/g, '').slice(-8), code_postal: form.code_postal, indications: form.indications || null,
      })
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  const input = 'w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple'
  const lbl = 'block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1'
  return (
    <div className="space-y-3">
      <div><label className={lbl}>1. Adresse complète</label>
        <input className={input} maxLength={200} value={form.adresse_complete} onChange={e => setForm(f => ({ ...f, adresse_complete: e.target.value }))} /></div>
      <div><label className={lbl}>2. Zone (Délégation/Secteur)</label>
        <ZoneCombobox value={form.zone} onChange={pickZone} /></div>
      <div>
        <label className={lbl}>3. Map (click to place the pin, drag to adjust)</label>
        <PickupMap latitude={form.latitude} longitude={form.longitude} focus={focus} dark height={300}
          onChange={(lat, lng) => setForm(f => ({ ...f, latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) }))}
          labels={{ loading: 'Loading the map…', failed: 'Map unavailable.' }} />
        <p className="text-xs text-text-muted mt-1 font-mono">{form.latitude != null ? `${form.latitude.toFixed(6)}, ${form.longitude?.toFixed(6)}` : 'No pin'}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={lbl}>Contact</label><input className={input} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
        <div><label className={lbl}>Téléphone</label><input className={input} inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        <div><label className={lbl}>Code postal</label><input className={input} inputMode="numeric" maxLength={4} value={form.code_postal} onChange={e => setForm(f => ({ ...f, code_postal: e.target.value.replace(/\D/g, '').slice(0, 4) }))} /></div>
        <div><label className={lbl}>Indications</label><input className={input} maxLength={500} value={form.indications} onChange={e => setForm(f => ({ ...f, indications: e.target.value }))} /></div>
      </div>
      {error && <p className="text-xs text-accent-red">{error}</p>}
      <p className="text-xs text-text-muted">Saving counts as verified, but Intigo must be updated afterwards (“Créer dans Intigo”).</p>
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-accent-purple disabled:opacity-60"><Save size={14} /> Save address</button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text-secondary"><X size={14} /> Cancel</button>
      </div>
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────
export default function PickupAddressCard({ sellerId, onStatus, showHistory = true }: {
  sellerId: number
  onStatus?: (card: PickupCard) => void
  showHistory?: boolean
}) {
  const [data,    setData]    = useState<PickupResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [editing, setEditing] = useState(false)
  const [manual,  setManual]  = useState<{ index: string; label: string } | null>(null)

  const apply = useCallback((res: { message?: string; data: PickupResponse }, ok = true) => {
    setData(res.data)
    onStatus?.(res.data.pickup)
    if (res.message) setMessage({ text: res.message, ok })
  }, [onStatus])

  useEffect(() => {
    setLoading(true)
    sellerPickupApi.get(sellerId)
      .then(res => apply(res))
      .catch(e => setMessage({ text: (e as Error).message, ok: false }))
      .finally(() => setLoading(false))
  }, [sellerId, apply])

  const run = async (key: string, fn: () => Promise<{ message?: string; data: PickupResponse }>): Promise<boolean> => {
    setBusy(key); setMessage(null)
    try { apply(await fn()); return true } catch (e) { setMessage({ text: (e as Error).message, ok: false }); return false }
    finally { setBusy(null) }
  }

  if (loading) return <div className="bg-bg-card border border-border rounded-xl p-6"><BrandLoader variant="section" minHeight={160} /></div>
  if (!data) return <div className="bg-bg-card border border-border rounded-xl p-6 text-sm text-accent-red">{message?.text ?? 'Could not load the pickup address.'}</div>

  const p = data.pickup
  const located = !!(p.zone && p.latitude != null && p.longitude != null && p.adresse_complete)
  const coords = p.latitude != null && p.longitude != null ? `${p.latitude}, ${p.longitude}` : null
  const viaApi = p.intigo_pickup_created_via === 'api' && p.intigo_pickup_index != null

  return (
    <section className="bg-bg-card border border-border rounded-xl overflow-hidden" aria-label="Adresse de pickup">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
        <Truck size={16} className="text-accent-purple-light" />
        <h2 className="font-semibold text-text-primary">Adresse de pickup</h2>
        <PickupStatusBadge status={p.status} />
        {p.intigo_pickup_index != null && (
          <span className="text-[11px] text-text-secondary">Intigo index <b className="text-text-primary">#{p.intigo_pickup_index}</b>{p.intigo_pickup_created_via ? ` (${p.intigo_pickup_created_via})` : ''}</span>
        )}
        <div className="flex-1" />
        {!editing && p.exists && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary"><Pencil size={12} /> Edit</button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Alerts */}
        {p.status === 'changed' && (
          <div className="flex gap-2 p-3 rounded-lg border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)' }}>
            <AlertTriangle size={16} className="text-accent-red shrink-0 mt-0.5" />
            <div className="text-sm text-text-primary">
              <b>Adresse de pickup modifiée : mettre à jour dans Intigo.</b>
              <p className="text-xs text-text-secondary mt-0.5">New Intigo parcels for this seller are held until the address is verified and created / updated in Intigo{p.last_address_change_at ? ` (changed ${format(new Date(p.last_address_change_at), 'dd MMM yyyy, HH:mm')})` : ''}.</p>
              {!!p.pending_pickups && <p className="text-xs font-semibold text-accent-orange mt-1">⚠ {p.pending_pickups} order(s) not collected yet: the courier may go to the old address.</p>}
            </div>
          </div>
        )}
        {p.status === 'needs_review' && (
          <div className="flex gap-2 p-3 rounded-lg border" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.35)' }}>
            <AlertTriangle size={16} className="text-accent-orange shrink-0 mt-0.5" />
            <div className="text-sm text-text-primary">
              <b>Needs review:</b> missing {p.missing.join(', ') || 'zone / map pin'}. Ask the seller to complete it in Settings, or edit it here.
              {p.legacy_snapshot && Object.keys(p.legacy_snapshot).length > 0 && (
                <p className="text-xs text-text-secondary mt-1">Old free-text address (not converted): {Object.entries(p.legacy_snapshot).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
              )}
            </div>
          </div>
        )}
        {p.pin_check?.far && (
          <div className="flex gap-2 p-3 rounded-lg border text-sm" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.35)' }}>
            <MapPinned size={16} className="text-accent-orange shrink-0 mt-0.5" />
            <span className="text-text-primary">The pin is {p.pin_check.distance_km} km from the zone centre (limit {p.pin_check.limit_km} km). Check it with the seller before creating it in Intigo.</span>
          </div>
        )}

        {editing ? (
          <EditForm card={p} onCancel={() => setEditing(false)} onSave={async body => {
            const res = await sellerPickupApi.update(sellerId, body)
            apply(res); setEditing(false)
          }} />
        ) : (
          <>
            {/* Intigo "Nouvelle adresse" order */}
            <div>
              <Row n={1} label="Adresse complète" value={p.adresse_complete} />
              {p.intigo_street_address && p.intigo_street_address !== p.adresse_complete && (
                <Row label="↳ with contact" value={p.intigo_street_address} copy={p.intigo_street_address} />
              )}
              <Row n={2} label="Zone" copy={p.zone?.display_label}>
                {p.zone ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-text-primary">{p.zone.display_label}</span>
                    <ZoneBadge type={p.zone.type} />
                  </div>
                ) : <p className="text-sm text-text-muted">—</p>}
              </Row>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2"><span className="text-accent-purple-light mr-1">3.</span>Map</p>
              {coords ? (
                <PickupMap latitude={p.latitude ?? null} longitude={p.longitude ?? null} dark height={280}
                  labels={{ loading: 'Loading the map…', failed: 'Map unavailable.' }} />
              ) : (
                <div className="h-24 rounded-xl border border-dashed border-border flex items-center justify-center text-xs text-text-muted">No map pin yet</div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {p.google_maps_url && (
                  <a href={p.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-cyan hover:underline">
                    <ExternalLink size={12} /> Open in Google Maps
                  </a>
                )}
              </div>
            </div>

            <div>
              <Row label="Latitude, longitude" value={coords} mono />
              <Row label="Latitude" value={p.latitude} mono />
              <Row label="Longitude" value={p.longitude} mono />
              <Row label="Contact" value={p.contact_name} />
              <Row label="Téléphone" value={formatPhone(p.phone)} copy={p.phone} mono />
              <Row label="Code postal" value={p.code_postal} mono />
              <Row label="Indications" value={p.indications} />
              <Row label="Gouvernorat" value={p.gouvernorat} />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" disabled={!located || busy !== null}
                onClick={() => run('verify', () => sellerPickupApi.verify(sellerId, !p.address_verified_by_admin))}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border disabled:opacity-40 ${
                  p.address_verified_by_admin ? 'border-accent-green text-accent-green' : 'border-border text-text-primary hover:border-accent-green'}`}>
                {busy === 'verify' ? <BrandLoader variant="inline" size={13} /> : p.address_verified_by_admin ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}
                {p.address_verified_by_admin ? 'Adresse vérifiée ✓' : 'Adresse vérifiée'}
              </button>
              <button type="button" disabled={!p.address_verified_by_admin || busy !== null}
                title={p.address_verified_by_admin ? '' : 'Verify the address first'}
                onClick={() => run('create', () => sellerPickupApi.createInIntigo(sellerId))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-accent-purple disabled:opacity-40">
                {busy === 'create' ? <BrandLoader variant="inline" size={13} /> : <Truck size={14} />}
                {viaApi ? 'Mettre à jour dans Intigo' : 'Créer dans Intigo'}
              </button>
              <button type="button" disabled={!p.address_verified_by_admin || busy !== null}
                onClick={() => setManual({ index: p.intigo_pickup_index != null ? String(p.intigo_pickup_index) : '', label: '' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-border text-text-secondary hover:text-text-primary disabled:opacity-40">
                <CheckCircle2 size={14} /> Pickup créé dans Intigo
              </button>
              {data.intigo_mode === 'fake' && <span className="text-[11px] text-accent-orange">Intigo fake mode: “Créer” is simulated, nothing is created at Intigo.</span>}
            </div>
            {manual && (
              <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-border bg-bg-primary">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">Intigo index</label>
                  <input inputMode="numeric" value={manual.index} onChange={e => setManual(m => m && ({ ...m, index: e.target.value.replace(/\D/g, '') }))}
                    className="w-28 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple" />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">Label (optional)</label>
                  <input value={manual.label} onChange={e => setManual(m => m && ({ ...m, label: e.target.value }))}
                    className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple" />
                </div>
                <button type="button" disabled={manual.index === '' || busy !== null}
                  onClick={() => run('manual', () => sellerPickupApi.markCreated(sellerId, Number(manual.index), manual.label)).then(ok => { if (ok) setManual(null) })}
                  className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-accent-green disabled:opacity-40">Confirm</button>
                <button type="button" onClick={() => setManual(null)} className="px-3 py-2 rounded-lg text-sm text-text-secondary border border-border">Cancel</button>
              </div>
            )}
            <p className="text-[11px] text-text-muted">
              {p.verified_at ? `Verified ${format(new Date(p.verified_at), 'dd MMM yyyy, HH:mm')}${p.verified_by ? ` by ${p.verified_by}` : ''}. ` : 'Not verified. '}
              {p.intigo_pickup_created_at ? `Created in Intigo ${format(new Date(p.intigo_pickup_created_at), 'dd MMM yyyy, HH:mm')}.` : 'Not created in Intigo.'}
              {' '}Intigo has no contact field on pickup addresses: the contact and phone are added to the address text.
            </p>
          </>
        )}

        {message && (
          <p role="status" className={`text-sm font-medium ${message.ok ? 'text-accent-green' : 'text-accent-red'}`}>{message.text}</p>
        )}

        {showHistory && (
          <div className="pt-2 border-t border-border">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted mb-3"><History size={13} /> Change history</p>
            <HistoryTimeline history={data.history} />
          </div>
        )}
      </div>
    </section>
  )
}
