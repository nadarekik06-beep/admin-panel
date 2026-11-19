// Admin "Delivery time": the rules behind the storefront's delivery estimate (business days,
// holidays, cutoff). GET / PUT /api/admin/delivery-time. Public read: GET /api/delivery-time.

import api from './axios'

export interface DeliveryTimeSettings {
  pickup_delay_min_business_days: number
  pickup_delay_max_business_days: number
  transit_business_days: number
  /** ISO weekdays: 1 = Monday … 7 = Sunday */
  working_days: number[]
  /** "YYYY-MM-DD" */
  holidays: string[]
  /** "HH:MM", Africa/Tunis */
  order_cutoff_time: string
}

function message(e: any): string {
  const errors = e?.response?.data?.errors
  if (errors) return Object.values(errors).flat().join(' ')
  return e?.response?.data?.message ?? e?.message ?? 'Request failed.'
}

export const deliveryTimeApi = {
  async get(): Promise<DeliveryTimeSettings> {
    try { return (await api.get('/admin/delivery-time')).data.data } catch (e) { throw new Error(message(e)) }
  },
  async save(s: DeliveryTimeSettings): Promise<DeliveryTimeSettings> {
    try { return (await api.put('/admin/delivery-time', s)).data.data } catch (e) { throw new Error(message(e)) }
  },
}
