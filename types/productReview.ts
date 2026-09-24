// Shape of GET /api/admin/products/{id}/review (ProductReviewResource.php)

export type ModerationStatus =
  | 'pending'
  | 'changes_requested'
  | 'rejected'
  | 'approved'
  | 'disabled'
  | 'deleted_by_seller'

export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock' | 'inactive'

export interface ReviewImage {
  id: number
  url: string
  is_primary: boolean
  order: number
  variant_id: number | null
  color_option_id: number | null
  scope: 'general' | 'color' | 'variant'
}

export interface ReviewColorGroup {
  option_id: number
  name: string
  hex: string | null
  image_ids: number[]
}

export interface ReviewVariantOption {
  id: number
  attribute: string | null
  attribute_slug: string | null
  value: string
  color_hex: string | null
}

export interface ReviewVariant {
  id: number
  label: string
  sku: string | null
  price: number
  price_override: number | null
  stock: number
  is_active: boolean
  availability: Availability
  color_option_id: number | null
  options: ReviewVariantOption[]
  image_ids: number[]
  image_urls: string[]
}

export interface ReviewPromotion {
  id: number
  name: string
  type: 'flash_sale' | 'discount'
  status: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  starts_at: string | null
  ends_at: string | null
  is_active_now: boolean
  flash_stock_remaining: number | null
}

export interface ReviewHistoryEvent {
  id: number | null
  action: string
  from_status: string | null
  to_status: string | null
  reasons: string[]
  note: string | null
  actor: { id: number | null; name: string | null; role: 'admin' | 'seller' }
  created_at: string | null
  synthetic?: boolean
}

export interface ReviewCheck {
  key: string
  label: string
  ok: boolean
  detail: string
  na?: boolean
}

export interface ProductReview {
  id: number
  name: string
  slug: string
  sku: string | null
  status: ModerationStatus
  is_approved: boolean
  is_active: boolean
  featured: boolean
  is_pack: boolean
  is_platform_product: boolean
  is_sponsored: boolean
  hidden_reason: string | null
  rejection_reason: string | null
  seasons: { value: string; label: string }[]

  created_at: string | null
  updated_at: string | null
  submitted_at: string | null
  changes_requested_at: string | null
  deleted_at: string | null

  storefront_url: string | null
  category: { id: number; name: string; slug: string } | null
  subcategory: { id: number; name: string; slug: string } | null
  category_path: string[]
  brand: string | null
  condition: string | null
  description: string | null
  short_description: string | null

  pricing: {
    base_price: number
    min_price: number
    max_price: number
    effective_price: number
    discount_amount: number
    active_promotion: ReviewPromotion | null
    promotions: ReviewPromotion[]
    coupons: { id: number; code: string; label: string; min_order_amount: number | null }[]
    delivery: { fee: number; is_free: boolean; is_default: boolean }
    commission: {
      plan: string
      plan_name: string
      source?: 'override' | 'plan' | 'default'
      on_price: number
      base_rate: number
      plan_reduction: number
      rate: number
      commission_amount: number
      seller_payout: number
      payout_range: { min: number; max: number } | null
    }
  }

  media: {
    images: ReviewImage[]
    count: number
    general_count: number
    primary_id: number | null
    colors: ReviewColorGroup[]
  }

  variants: ReviewVariant[]

  inventory: {
    has_variants: boolean
    total_stock: number
    variant_count: number
    active_variant_count: number
    out_of_stock_variants: number
    low_stock_variants: number
    low_stock_threshold: number
    availability: Availability
  }

  specifications: { slug: string; name: string; type: string; value: string; color_hexes: string[] }[]

  shipping: {
    delivery_fee: number
    is_free_delivery: boolean
    uses_platform_default: boolean
    fields: { label: string; value: string }[]
  }

  seller: {
    id: number
    name: string
    email: string
    store_name: string
    avatar: string | null
    location: string | null
    plan: string
    plan_name: string
    plan_color?: string
    plan_tier_key?: 'free' | 'red' | 'black'
    subscription_status: string | null
    is_active: boolean
    is_approved: boolean
    joined_at: string | null
    account_age_days: number | null
    stats: {
      total_products: number
      approved_products: number
      rejected_products: number
      pending_products: number
      rating_avg: number | null
      review_count: number
    }
    storefront_url: string
  } | null

  performance: {
    views: number
    orders_count: number
    units_sold: number
    revenue: number
    rating_avg: number | null
    review_count: number
  } | null

  history: ReviewHistoryEvent[]
  checks: ReviewCheck[]
  queue: { next_pending_id: number | null; pending_count: number } | null
  moderation_reasons: { code: string; label: string }[]
}
