'use client'

/**
 * Seller pickup address fields for admin forms, same order and rules as the
 * storefront component (Intigo's "Nouvelle adresse"):
 *   1. Adresse complète  2. Zone (Délégation/Secteur)  3. Map pin (required)
 *   then contact, phone, postal code, notes for the courier.
 * Controlled: the parent runs validatePickupAddress() before submitting.
 */

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle, Crosshair, LocateFixed, MapPinned } from 'lucide-react'
import ZoneCombobox from './ZoneCombobox'
import type { MapFocus } from './PickupMap'
import { sellerPickupApi } from '@/lib/sellerPickupApi'
import {
  distanceKm, GEO_MAX_ACCURACY_M, inTunisia, PICKUP_MESSAGES,
  type PickupAddressValue, type PickupErrors,
} from '@/lib/pickupAddress'

const PickupMap = dynamic(() => import('./PickupMap'), {
  ssr: false,
  loading: () => <div className="h-[300px] rounded-xl bg-bg-primary border border-border" />,
})

const ZOOM: Record<string, number> = { secteur: 16, delegation: 14, gouvernorat: 11 }
type Center = { latitude: number; longitude: number; precision: string; warn_km: number }

export default function PickupAddressFields({ value, onChange, errors = {}, disabled }: {
  value: PickupAddressValue
  onChange: (value: PickupAddressValue) => void
  errors?: PickupErrors
  disabled?: boolean
}) {
  const [fetched,  setFetched]  = useState<{ zoneId: number; center: Center | null } | null>(null)
  const [focus,    setFocus]    = useState<MapFocus | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const set = <K extends keyof PickupAddressValue>(key: K, v: PickupAddressValue[K]) => onChange({ ...value, [key]: v })

  // Zone picked → centre the map on it, the pin is then placed on the shop
  useEffect(() => {
    const zone = value.zone
    if (!zone) return
    let alive = true
    sellerPickupApi.zoneCenter(zone.id).then(c => {
      if (!alive) return
      setFetched({ zoneId: zone.id, center: c })
      if (c && (value.latitude == null || value.longitude == null
        || distanceKm(c.latitude, c.longitude, value.latitude, value.longitude) > c.warn_km)) {
        setFocus({ latitude: c.latitude, longitude: c.longitude, zoom: ZOOM[c.precision] ?? 14, key: `zone-${zone.id}` })
      }
    })
    return () => { alive = false }
  }, [value.zone?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const center = fetched && fetched.zoneId === value.zone?.id ? fetched.center : null
  const distance = useMemo(() => (
    center && value.latitude != null && value.longitude != null
      ? distanceKm(center.latitude, center.longitude, value.latitude, value.longitude)
      : null
  ), [center, value.latitude, value.longitude])
  const far = distance != null && center != null && distance > center.warn_km

  const myPosition = () => {
    setGeoError(null)
    if (!('geolocation' in navigator)) { setGeoError('Location unavailable. Place the marker on the map by hand.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        const { latitude, longitude, accuracy } = pos.coords
        if (!inTunisia(latitude, longitude)) { setGeoError(PICKUP_MESSAGES.pinOutside); return }
        if (!(accuracy > 0) || accuracy > GEO_MAX_ACCURACY_M) {
          setFocus({ latitude, longitude, zoom: 16, key: `me-${Date.now()}` })
          setGeoError(`Your position is too approximate (± ${Math.round(accuracy || 0)} m): the map is centred on it, click exactly on the shop to place the pin.`)
          return
        }
        onChange({ ...value, latitude: Number(latitude.toFixed(7)), longitude: Number(longitude.toFixed(7)) })
        setFocus({ latitude, longitude, zoom: 17, key: `me-${Date.now()}` })
      },
      err => {
        setLocating(false)
        setGeoError(err.code === err.PERMISSION_DENIED
          ? 'Location access denied. Place the marker on the map by hand.'
          : 'Location unavailable. Place the marker on the map by hand.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const input = (err?: string) =>
    `w-full bg-bg-primary border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple disabled:opacity-60 ${err ? 'border-accent-red' : 'border-border'}`
  const lbl = 'block text-sm font-semibold text-text-secondary mb-1.5'
  const Err = ({ k }: { k: keyof PickupErrors }) =>
    errors[k] ? <p role="alert" className="text-xs text-accent-red font-semibold mt-1.5">{errors[k]}</p> : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={lbl} htmlFor="adm-pk-adresse">Full address *</label>
        <input id="adm-pk-adresse" dir="auto" disabled={disabled} maxLength={200}
          placeholder="e.g. 12 Rue des Fleurs, Imm. Jasmin, Apt 4"
          value={value.adresse_complete} onChange={e => set('adresse_complete', e.target.value)} className={input(errors.adresse_complete)} />
        <Err k="adresse_complete" />
      </div>

      <div>
        <label className={lbl}>Zone (Delegation/Sector) *</label>
        <ZoneCombobox value={value.zone} onChange={z => set('zone', z)} invalid={!!errors.zone} />
        <p className="text-xs text-text-muted mt-1.5">
          {value.zone ? <>Governorate : <b className="text-text-primary">{value.zone.gouvernorat}</b></> : 'Pick the delegation or sector from the list.'}
        </p>
        <Err k="zone" />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
          <span className={`${lbl} mb-0 flex items-center gap-1.5`}><MapPinned size={15} className="text-accent-red" /> Position on the map *</span>
          <button type="button" onClick={myPosition} disabled={disabled || locating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-accent-red border border-accent-red/40 bg-accent-red/10 disabled:opacity-60">
            <LocateFixed size={13} /> {locating ? 'Locating…' : 'My position'}
          </button>
        </div>
        <p className="text-xs text-text-muted mb-2">Zoom in until you see the street, then click exactly on the shop (you can also drag the pin).</p>
        <div className={errors.pin ? 'rounded-xl ring-2 ring-accent-red' : ''}>
          <PickupMap latitude={value.latitude} longitude={value.longitude} focus={focus} dark height={300}
            onChange={disabled ? undefined : (lat, lng) => { setGeoError(null); onChange({ ...value, latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) }) }}
            labels={{ loading: 'Loading the map…', failed: 'The map could not be loaded. Reload the page.' }} />
        </div>
        <p className="flex items-center gap-2 mt-2 text-xs text-text-muted">
          <Crosshair size={13} />
          {value.latitude != null && value.longitude != null
            ? <span>Coordinates : <b className="font-mono text-text-primary">{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</b></span>
            : <span>No marker placed yet.</span>}
        </p>
        {far && (
          <div role="status" className="flex gap-2 items-start mt-2 px-3 py-2 rounded-lg bg-accent-orange/10 border border-accent-orange/40">
            <AlertTriangle size={14} className="text-accent-orange shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-accent-orange">
              The marker is about {Math.round(distance!)} km from “{value.zone?.display_label}”. Check that it is on the premises.
            </p>
          </div>
        )}
        {geoError && <p role="alert" className="text-xs text-accent-red font-semibold mt-1.5">{geoError}</p>}
        <Err k="pin" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className={lbl} htmlFor="adm-pk-contact">Contact person *</label>
          <input id="adm-pk-contact" dir="auto" disabled={disabled} maxLength={191}
            value={value.contact_name} onChange={e => set('contact_name', e.target.value)} className={input(errors.contact_name)} />
          <Err k="contact_name" />
        </div>
        <div>
          <label className={lbl} htmlFor="adm-pk-phone">Phone *</label>
          <input id="adm-pk-phone" type="tel" dir="ltr" inputMode="tel" placeholder="22 123 456" disabled={disabled}
            value={value.phone} onChange={e => set('phone', e.target.value)} className={input(errors.phone)} />
          <Err k="phone" />
        </div>
        <div>
          <label className={lbl} htmlFor="adm-pk-postal">Postal code *</label>
          <input id="adm-pk-postal" dir="ltr" inputMode="numeric" placeholder="1000" maxLength={4} disabled={disabled}
            value={value.code_postal} onChange={e => set('code_postal', e.target.value.replace(/\D/g, '').slice(0, 4))} className={input(errors.code_postal)} />
          <Err k="code_postal" />
        </div>
        <div>
          <label className={lbl} htmlFor="adm-pk-notes">Notes for the courier</label>
          <input id="adm-pk-notes" dir="auto" placeholder="Opening hours, floor, landmark…" maxLength={500} disabled={disabled}
            value={value.indications} onChange={e => set('indications', e.target.value)} className={input(errors.indications)} />
          <Err k="indications" />
        </div>
      </div>
    </div>
  )
}
