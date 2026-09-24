// Shapes of /api/admin/subscriptions* and /api/admin/subscription-plans*

export type SubStatus = 'active' | 'trial' | 'grace_period' | 'past_due' | 'canceled' | 'expired' | 'suspended'
export type CommissionSource = 'override' | 'plan' | 'default'

export interface PlanMeta {
  slug: string
  name: string
  color: string
  tier_key: 'free' | 'red' | 'black'
  is_free: boolean
  archived: boolean
}

export interface CommissionSummary {
  source: CommissionSource
  rate: number | null
  range?: { min: number; max: number }
  label: string
  expires_at?: string | null
  override: number | null
  override_expires_at: string | null
  override_reason: string | null
  override_active: boolean
}

export interface SellerSubscriptionRow {
  id: number
  user_id: number
  seller_name: string | null
  seller_email: string | null
  business_name: string | null
  current_plan: string
  plan: PlanMeta
  pending_plan: string | null
  pending: PlanMeta | null
  status: SubStatus
  status_label: string
  expiring_soon: boolean
  billing_period: 'monthly' | 'yearly'
  billing_cycle_start: string | null
  billing_cycle_end: string | null
  days_remaining: number
  trial_ends_at: string | null
  grace_period_ends_at: string | null
  has_pending_downgrade: boolean
  last_payment_at: string | null
  suspended_at: string | null
  canceled_at: string | null
  cancel_reason: string | null
  admin_note: string | null
  max_products: number | null
  products: { visible: number; hidden: number } | null
  commission: CommissionSummary
}

export interface HistoryEvent {
  kind: 'audit' | 'plan_change' | 'payment'
  action: string
  label: string
  reason: string | null
  amount?: number
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  actor: { id?: number; name: string | null; role: string }
  at: string | null
}

export interface SubscriptionStats {
  per_plan: { slug: string; name: string; color: string; count: number; archived: boolean }[]
  trials: number
  expiring_this_week: number
  grace_period: number
  expired: number
  suspended: number
  overrides: number
  mrr: number
  revenue_this_month: number
  commission_this_month: number
  chart: { month: string; label: string; subscription_revenue: number; commission: number; new_paid: number }[]
}

export type FeatureFlags = Record<string, boolean>

export interface Plan {
  id: number
  slug: string
  name: string
  description: string | null
  badge_color: string
  display_order: number
  tier: 0 | 1 | 2
  tier_key: 'free' | 'red' | 'black'
  price_monthly: number
  price_yearly: number | null
  trial_days: number
  commission_rate: number | null
  commission_reduction: number
  max_products: number | null
  max_images_per_product: number | null
  max_sponsored_products: number | null
  features: FeatureFlags
  is_active: boolean
  is_default: boolean
  archived_at: string | null
  active_sellers: number
  total_sellers: number
  commission_range: { min: number; max: number }
  commission_label: string
}

export interface CommissionTier { min: number; max: number | null; rate: number }

export interface CommissionTable {
  tiers: CommissionTier[]
  reductions: Record<string, number>
  floor: number
}

export interface PlansPayload {
  plans: Plan[]
  features: { key: string; label: string }[]
  commission_default: CommissionTable
}
