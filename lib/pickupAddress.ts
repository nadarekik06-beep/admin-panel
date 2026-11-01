// Seller pickup address form rules, ported from the storefront
// (choosetounsi-frontend/lib/pickupAddress.ts) with the same messages.
// Backend: App\Services\Sellers\PickupAddressService::rules.

import type { ZoneOption } from '@/lib/sellerPickupApi'

export interface PickupAddressValue {
  adresse_complete: string
  zone: ZoneOption | null
  latitude: number | null
  longitude: number | null
  contact_name: string
  phone: string
  code_postal: string
  indications: string
}

export type PickupField = 'adresse_complete' | 'zone' | 'pin' | 'contact_name' | 'phone' | 'code_postal' | 'indications'
export type PickupErrors = Partial<Record<PickupField, string>>

/** Same wording as the storefront (pickupAddress.errors.*). */
export const PICKUP_MESSAGES = {
  adresse:        'Enter the full address (at least 5 characters).',
  adresseTooLong: 'Address too long (200 characters max).',
  zone:           'Pick a zone from the list.',
  pin:            'Place the marker on the map (or use “My position”).',
  pinOutside:     'The marker must be in Tunisia.',
  contact:        'Enter the contact person.',
  phone:          'Invalid Tunisian number. Enter 8 digits starting with 2, 4, 5 or 9.',
  postalCode:     'Postal code must be 4 digits.',
} as const

const TUNISIA_BOUNDS = { latMin: 30.0, latMax: 37.6, lngMin: 7.3, lngMax: 11.8 }

/** SAME polygon as the backend (App\Services\Intigo\ZoneGeocoder::TUNISIA_POLYGON) and the storefront. */
const TUNISIA_POLYGON: ReadonlyArray<readonly [number, number]> = [
  [37.10, 8.58], [37.60, 8.80], [37.65, 9.90], [37.45, 10.55], [37.25, 11.25], [36.70, 11.35],
  [36.40, 10.95], [36.05, 10.80], [35.75, 11.05], [35.55, 11.35], [35.05, 11.45], [34.55, 11.60],
  [34.15, 10.75], [33.95, 11.15], [33.55, 11.40], [33.20, 11.75], [32.60, 11.75], [31.90, 11.20],
  [31.30, 10.60], [30.60, 10.25], [30.18, 9.70], [30.18, 9.35], [30.60, 9.05], [31.40, 8.55],
  [32.30, 8.05], [33.10, 7.65], [33.75, 7.30], [34.30, 7.75], [34.60, 7.98], [34.90, 8.25],
  [35.40, 8.18], [35.95, 8.22], [36.50, 8.32], [36.85, 8.52],
]

/** "My position" is only used as the pin when the device knows it to this precision (metres). */
export const GEO_MAX_ACCURACY_M = 100

export const emptyPickupAddress = (): PickupAddressValue => ({
  adresse_complete: '', zone: null, latitude: null, longitude: null,
  contact_name: '', phone: '', code_postal: '', indications: '',
})

/** Tunisian mobile / landline: 8 digits starting with 2, 4, 5 or 9 (+216 / 00216 allowed). */
export function validateTunisianPhone(raw: string): { clean: string; valid: boolean } {
  const clean = raw.replace(/[\s\-.()]/g, '').replace(/^(\+216|00216)/, '')
  return { clean, valid: /^[2459][0-9]{7}$/.test(clean) }
}

export function inTunisia(lat: number | null, lng: number | null): boolean {
  const b = TUNISIA_BOUNDS
  if (lat == null || lng == null || lat < b.latMin || lat > b.latMax || lng < b.lngMin || lng > b.lngMax) return false
  let inside = false
  const p = TUNISIA_POLYGON
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [yi, xi] = p[i]
    const [yj, xj] = p[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Messages per field, empty when valid (same rules as the backend). */
export function validatePickupAddress(v: PickupAddressValue): PickupErrors {
  const e: PickupErrors = {}
  const street = v.adresse_complete.trim()
  if (street.length < 5)                         e.adresse_complete = PICKUP_MESSAGES.adresse
  else if (street.length > 200)                  e.adresse_complete = PICKUP_MESSAGES.adresseTooLong
  if (!v.zone)                                   e.zone = PICKUP_MESSAGES.zone
  if (v.latitude == null || v.longitude == null) e.pin = PICKUP_MESSAGES.pin
  else if (!inTunisia(v.latitude, v.longitude))  e.pin = PICKUP_MESSAGES.pinOutside
  if (v.contact_name.trim().length < 3)          e.contact_name = PICKUP_MESSAGES.contact
  if (!validateTunisianPhone(v.phone).valid)     e.phone = PICKUP_MESSAGES.phone
  if (!/^\d{4}$/.test(v.code_postal.trim()))     e.code_postal = PICKUP_MESSAGES.postalCode
  return e
}

/** The request fields expected by the backend. */
export function pickupPayload(v: PickupAddressValue): Record<string, string | number | null> {
  return {
    adresse_complete: v.adresse_complete.trim(),
    intigo_zone_id: v.zone?.id ?? null,
    latitude: v.latitude != null ? Number(v.latitude.toFixed(7)) : null,
    longitude: v.longitude != null ? Number(v.longitude.toFixed(7)) : null,
    contact_name: v.contact_name.trim(),
    phone: validateTunisianPhone(v.phone).clean,
    code_postal: v.code_postal.trim(),
    indications: v.indications.trim() || null,
  }
}

/** Laravel 422 field errors → our field names. */
export function pickupErrorsFromApi(errors: Record<string, string[]> | undefined): PickupErrors {
  if (!errors) return {}
  const map: Record<string, PickupField> = {
    adresse_complete: 'adresse_complete', intigo_zone_id: 'zone', latitude: 'pin', longitude: 'pin',
    contact_name: 'contact_name', phone: 'phone', code_postal: 'code_postal', indications: 'indications',
  }
  const out: PickupErrors = {}
  for (const [k, msgs] of Object.entries(errors)) {
    const f = map[k]
    if (f && !out[f]) out[f] = msgs[0]
  }
  return out
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
