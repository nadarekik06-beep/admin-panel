/**
 * Admin sponsoring API — /api/admin/ads/* (same fetch pattern as vipRequestApi.ts).
 */

import Cookies from 'js-cookie'

const RAW_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
const API_URL = RAW_URL.endsWith('/api') ? RAW_URL : `${RAW_URL}/api`

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = Cookies.get('admin_token')
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': 'en',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const first = json.errors ? Object.entries(json.errors).map(([k, v]) => `${k}: ${(v as string[])[0]}`).join(' · ') : null
    const err: any = new Error(first ?? json.message ?? 'Request failed')
    err.status = res.status
    throw err
  }
  return json as T
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled' | 'rejected' | 'expired'

export interface AdminCampaign {
  id: number
  status: CampaignStatus
  paused_reason: string | null
  rejection_reason: string | null
  pricing_model: 'cpc' | 'legacy_daily'
  product: { id: number; name: string; slug: string; price: number; image_url: string | null } | null
  seller: { id: number; name: string; email: string } | null
  daily_budget: number | null
  max_cpc: number | null
  spent_today: number
  spent_total: number
  placements: string[] | null
  targeting: Record<string, unknown>
  start_at: string | null
  end_at: string | null
  readiness_score: number | null
  ad_copy: string | null
  tips: { code: string; params?: Record<string, unknown> }[]
  stats: { impressions: number; clicks: number; ctr: number | null; orders: number; revenue: number }
  created_at: string
}

export interface AdminCampaignDetail extends AdminCampaign {
  summary: { spend: number; paid_spend: number; credit_spend: number; clicks: number; impressions: number; orders: number; revenue: number; roas: number | null; cost_per_order: number | null }
  daily: { date: string; impressions: number; clicks: number; cost: number; orders: number; revenue: number }[]
  placement_stats: { placement: string; impressions: number; clicks: number; cost: number; orders: number; revenue: number }[]
  wallet: { balance: number; credit_balance: number; available: number } | null
  ad_tags: string[] | null
}

export interface AdsOverview {
  days: number
  revenue: { paid: number; credit: number; total: number }
  all_time: { paid: number; credit: number; total: number }
  daily: { date: string; paid: number; credit: number }[]
  totals: { impressions: number; clicks: number; orders: number; sales: number }
  by_placement: { placement: string; impressions: number; clicks: number; ctr: number | null; orders: number; revenue: number }[]
  campaigns: Record<string, number>
  top_advertisers: { seller_id: number; name: string; email: string; spend: number; paid: number }[]
  flags: {
    suspicious_ips: { ip: string; clicks: number; rejected: number; campaigns: number }[]
    high_ctr: { campaign_id: number; seller: string; placement: string; ctr: number; expected: number }[]
  }
  pending_top_ups: number
}

export interface WalletRow { seller: { id: number; name: string; email: string }; balance: number; credit_balance: number; credit_expires_at: string | null }
export interface WalletTx { id: number; type: string; amount: number; credit_amount: number; paid_amount: number; balance_after: number; credit_after: number; sponsorship_id: number | null; date: string | null; clicks: number | null; note: string | null; created_at: string }
export interface TopUp { id: number; amount: number; gateway: string; status: string; reference: string | null; paid_at: string | null; created_at: string; seller?: { id: number; name: string; email: string } }

type Paged<T> = { data: T[]; meta: { current_page: number; last_page: number; total: number } }

export const adsAdminApi = {
  overview: (days = 30) => request<{ data: AdsOverview }>('GET', `/admin/ads/overview?days=${days}`).then(r => r.data),

  campaigns: (params: { status?: string; search?: string; pricing_model?: string; page?: number } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))
    return request<Paged<AdminCampaign>>('GET', `/admin/ads/campaigns?${qs}`)
  },
  campaign: (id: number) => request<{ data: AdminCampaignDetail }>('GET', `/admin/ads/campaigns/${id}`).then(r => r.data),
  reject: (id: number, reason: string) => request<{ data: AdminCampaignDetail }>('POST', `/admin/ads/campaigns/${id}/reject`, { reason }).then(r => r.data),
  pause: (id: number) => request<{ data: AdminCampaignDetail }>('POST', `/admin/ads/campaigns/${id}/pause`).then(r => r.data),
  resume: (id: number) => request<{ data: AdminCampaignDetail }>('POST', `/admin/ads/campaigns/${id}/resume`).then(r => r.data),

  settings: () => request<{ data: { values: Record<string, any>; defaults: Record<string, any>; placements: string[] } }>('GET', '/admin/ads/settings').then(r => r.data),
  saveSettings: (values: Record<string, unknown>) =>
    request<{ data: { values: Record<string, any>; defaults: Record<string, any>; placements: string[] } }>('PUT', '/admin/ads/settings', values).then(r => r.data),

  wallets: (search = '', page = 1) => request<Paged<WalletRow>>('GET', `/admin/ads/wallets?search=${encodeURIComponent(search)}&page=${page}`),
  wallet: (sellerId: number) =>
    request<{ data: { seller: WalletRow['seller']; wallet: { balance: number; credit_balance: number; credit_expires_at: string | null; available: number }; transactions: WalletTx[]; top_ups: TopUp[] } }>('GET', `/admin/ads/wallets/${sellerId}`).then(r => r.data),
  adjust: (sellerId: number, body: { balance_delta?: number; credit_delta?: number; note: string; credit_expires_at?: string }) =>
    request('POST', `/admin/ads/wallets/${sellerId}/adjust`, body),
  topUps: (status = 'pending') => request<Paged<TopUp>>('GET', `/admin/ads/top-ups?status=${status}`),
  confirmTopUp: (id: number, note?: string) => request('POST', `/admin/ads/top-ups/${id}/confirm`, { note }),
  rejectTopUp: (id: number, note?: string) => request('POST', `/admin/ads/top-ups/${id}/reject`, { note }),
}

export const PLACEMENT_LABELS: Record<string, string> = {
  home_row: 'Homepage row', home_inline: 'Homepage inline', search_top: 'Search results', category_top: 'Category pages',
  product_similar: 'Product pages', cart_cross_sell: 'Cart', entry_popup: 'Entry popup', email_digest: 'E-mail digest',
}

export const money = (v: number | null | undefined) =>
  v == null ? '—' : `${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`
