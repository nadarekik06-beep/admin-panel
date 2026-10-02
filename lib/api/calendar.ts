// lib/api/calendar.ts  (admin panel) — Tunisian calendar used by the sellers' sales forecast
import api from '../axios'

export interface CalendarEffect {
  category_id: number
  change_pct: number | null
  event_orders: number
  baseline_orders: number
  reliable: boolean
}

export interface CalendarEvent {
  id: number
  key: string
  name_fr: string
  name_en: string
  name_ar: string
  starts_on: string
  ends_on: string
  category_ids: number[] | null
  is_active: boolean
  source: 'admin' | 'hijri'
  effects_summary: CalendarEffect[]
}

export type CalendarEventPayload = Omit<CalendarEvent, 'id' | 'source' | 'effects_summary'>

export const adminCalendarApi = {
  list: (year: number) =>
    api.get<{ success: boolean; data: CalendarEvent[]; min_orders: number }>('/admin/calendar-events', { params: { year } }).then(r => r.data),
  create: (body: CalendarEventPayload) => api.post('/admin/calendar-events', body).then(r => r.data),
  update: (id: number, body: CalendarEventPayload) => api.put(`/admin/calendar-events/${id}`, body).then(r => r.data),
  remove: (id: number) => api.delete(`/admin/calendar-events/${id}`).then(r => r.data),
  generateHijri: (year: number) =>
    api.post<{ success: boolean; created: number }>('/admin/calendar-events/generate-hijri', { year }).then(r => r.data),
  measure: (id: number) =>
    api.post<{ success: boolean; categories: number }>(`/admin/calendar-events/${id}/measure`).then(r => r.data),
}
