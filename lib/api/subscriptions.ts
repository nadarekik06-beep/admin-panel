import api from '../axios'
import type { PaginatedResponse } from '@/types'
import type {
  CommissionTable, CommissionTier, HistoryEvent, Plan, PlansPayload,
  SellerSubscriptionRow, SubscriptionStats,
} from '@/types/subscriptions'

export interface SubscriptionListParams {
  search?: string
  plan?: string
  status?: string
  sort?: string
  dir?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export type PlanInput = Partial<Omit<Plan, 'id' | 'tier_key' | 'active_sellers' | 'total_sellers' | 'commission_range' | 'commission_label' | 'archived_at' | 'is_default'>> & { reason?: string }

const base = (sellerId: number) => `/admin/subscriptions/${sellerId}`

export const subscriptionsApi = {
  async list(params: SubscriptionListParams = {}): Promise<PaginatedResponse<SellerSubscriptionRow>> {
    const res = await api.get('/admin/subscriptions', { params })
    return res.data.data
  },

  async stats(): Promise<SubscriptionStats> {
    const res = await api.get('/admin/subscriptions/stats')
    return res.data.data
  },

  async get(sellerId: number): Promise<{ subscription: SellerSubscriptionRow; history: HistoryEvent[] }> {
    const res = await api.get(base(sellerId))
    return res.data.data
  },

  // Every action returns the updated subscription row
  async assignPlan(sellerId: number, body: { plan: string; billing_period?: string; end_date?: string | null; reason: string }) {
    return (await api.post(`${base(sellerId)}/assign-plan`, body)).data as { message: string; data: SellerSubscriptionRow }
  },
  async changeEndDate(sellerId: number, body: { end_date: string; reason: string }) {
    return (await api.post(`${base(sellerId)}/end-date`, body)).data as { message: string; data: SellerSubscriptionRow }
  },
  async grantFreeDays(sellerId: number, body: { days: number; reason: string }) {
    return (await api.post(`${base(sellerId)}/free-days`, body)).data as { message: string; data: SellerSubscriptionRow }
  },
  async startTrial(sellerId: number, body: { plan: string; days: number; reason: string }) {
    return (await api.post(`${base(sellerId)}/trial`, body)).data as { message: string; data: SellerSubscriptionRow }
  },
  async suspend(sellerId: number, reason: string) {
    return (await api.post(`${base(sellerId)}/suspend`, { reason })).data as { message: string; data: SellerSubscriptionRow }
  },
  async reinstate(sellerId: number, reason: string) {
    return (await api.post(`${base(sellerId)}/reinstate`, { reason })).data as { message: string; data: SellerSubscriptionRow }
  },
  async cancel(sellerId: number, reason: string, immediate: boolean) {
    return (await api.post(`${base(sellerId)}/cancel`, { reason, immediate })).data as { message: string; data: SellerSubscriptionRow }
  },
  async setCommissionOverride(sellerId: number, body: { rate: number; expires_at?: string | null; reason: string }) {
    return (await api.put(`${base(sellerId)}/commission-override`, body)).data as { message: string; data: SellerSubscriptionRow }
  },
  async removeCommissionOverride(sellerId: number, reason: string) {
    return (await api.delete(`${base(sellerId)}/commission-override`, { data: { reason } })).data as { message: string; data: SellerSubscriptionRow }
  },
}

export const plansApi = {
  async list(withArchived = false): Promise<PlansPayload> {
    const res = await api.get('/admin/subscription-plans', { params: { with_archived: withArchived ? 1 : 0 } })
    return res.data.data
  },
  async create(body: PlanInput & { slug: string }) {
    return (await api.post('/admin/subscription-plans', body)).data as { message: string; data: Plan }
  },
  async update(id: number, body: PlanInput) {
    return (await api.put(`/admin/subscription-plans/${id}`, body)).data as { message: string; data: Plan }
  },
  async toggle(id: number) {
    return (await api.patch(`/admin/subscription-plans/${id}/toggle`)).data as { message: string; data: Plan }
  },
  async makeDefault(id: number) {
    return (await api.patch(`/admin/subscription-plans/${id}/default`)).data as { message: string; data: Plan }
  },
  async archive(id: number, reason: string) {
    return (await api.delete(`/admin/subscription-plans/${id}`, { data: { reason } })).data as { message: string }
  },
  async restore(id: number) {
    return (await api.post(`/admin/subscription-plans/${id}/restore`)).data as { message: string; data: Plan }
  },
  async commission(): Promise<CommissionTable> {
    return (await api.get('/admin/commission-settings')).data.data
  },
  async updateCommission(body: { tiers: CommissionTier[]; floor: number; reason: string }) {
    return (await api.put('/admin/commission-settings', body)).data as { message: string; data: CommissionTable }
  },
}

/** Laravel validation / JSON error → readable message. */
export function apiError(err: unknown, fallback = 'Action failed. Please try again.'): string {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
  const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
  return first ?? data?.message ?? fallback
}
