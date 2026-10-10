// Admin "Delivery & Fees": delivery pricing + checkout payment-method switches.
// GET / PUT /api/admin/delivery-settings

import api from './axios'

export type PaymentMethodKey = 'cod' | 'card' | 'd17' | 'wallet'

export interface DeliverySettingsValues {
  client_delivery_fee: number
  agency_delivery_cost: number
  seller_free_delivery_contribution: number
  return_shipping_fee: number
  refused_parcel_agency_fee: number
  refused_parcel_fee_paid_by: 'platform' | 'seller'
}

export interface DeliverySettingChange {
  id: number
  field: string
  old_value: string | null
  new_value: string | null
  created_at: string
  changed_by: number | null
  changed_by_name: string | null
}

export interface DeliverySettingsPayload {
  settings: DeliverySettingsValues
  margins: { normal: number; free_delivery: number }
  warnings: string[]
  payment_methods: Record<PaymentMethodKey, boolean>
  updated_at: string | null
  history: DeliverySettingChange[]
}

/** Amounts are sent as typed (strings): the server validates TND with 3 decimals max. */
export type DeliverySettingsForm = Record<Exclude<keyof DeliverySettingsValues, 'refused_parcel_fee_paid_by'>, string> & {
  refused_parcel_fee_paid_by: 'platform' | 'seller'
  payment_methods: Record<PaymentMethodKey, boolean>
}

function message(e: any): string {
  const errors = e?.response?.data?.errors
  if (errors) return Object.values(errors).flat().join(' ')
  return e?.response?.data?.message ?? e?.message ?? 'Request failed.'
}

export const deliverySettingsApi = {
  async get(): Promise<DeliverySettingsPayload> {
    try { return (await api.get('/admin/delivery-settings')).data.data } catch (e) { throw new Error(message(e)) }
  },
  async save(form: DeliverySettingsForm): Promise<{ message: string; data: DeliverySettingsPayload }> {
    try {
      const res = await api.put('/admin/delivery-settings', form)
      return { message: res.data.message, data: res.data.data }
    } catch (e) { throw new Error(message(e)) }
  },
}

/** "8.5" → 8500 millimes; null when not a valid TND amount (≥ 0, max 3 decimals). No float math. */
export function toMillimes(text: string): number | null {
  const m = /^\s*(\d{1,9})(?:[.,](\d{0,3}))?\s*$/.exec(text)
  if (!m) return null
  return Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0'))
}

/** 8500 → "8.500", -1000 → "-1.000" */
export function fromMillimes(m: number): string {
  const sign = m < 0 ? '-' : ''
  const abs = Math.abs(m)
  return `${sign}${Math.floor(abs / 1000)}.${String(abs % 1000).padStart(3, '0')}`
}
