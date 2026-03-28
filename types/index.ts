// types/index.ts  (admin-panel)

export interface Admin {
  id: number
  name: string
  email: string
  role: 'admin' | 'super_admin'
}

export interface PaginatedResponse<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number
  to: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// ── User ──────────────────────────────────────────────────────────
export interface User {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  is_approved: boolean
  orders_count?: number
  created_at: string
  updated_at: string
}

// ── Seller ────────────────────────────────────────────────────────
export interface Seller {
  id: number
  name: string
  email: string
  role: 'seller'
  is_active: boolean
  is_approved: boolean
  products_count?: number
  created_at: string
  updated_at: string
}

// ── Product ───────────────────────────────────────────────────────
export type ProductStatus = 'pending' | 'approved' | 'disabled'

export interface ProductVariantOption {
  value: string
  color_hex?: string | null
}

export interface ProductVariant {
  id: number
  label: string
  sku: string | null
  stock: number
  price_override: number | null
  is_active: boolean
  option_map: Record<string, ProductVariantOption>
  /** Resolved image URLs for this variant/color */
  image_urls: string[]
}

export interface ProductImage {
  id: number
  image_path: string
  is_primary: boolean
  order: number
  url: string
  variant_id?: number | null
  color_option_id?: number | null
}

export interface Product {
  id: number
  name: string
  slug?: string
  price: number
  stock: number
  sku?: string
  is_approved: boolean
  is_active: boolean
  featured?: boolean
  status?: string
  primary_image_url?: string | null
  images?: ProductImage[]
  /** Enriched variant data (returned by admin show endpoint) */
  variant_data?: ProductVariant[]
  seller?: { id: number; name: string; email?: string }
  category?: { id: number; name: string }
  created_at: string
  updated_at: string
}

// ── Order item ────────────────────────────────────────────────────
export interface OrderItem {
  id: number
  product_id: number
  variant_id: number | null
  variant_label: string | null
  product_name: string
  quantity: number
  unit_price: number
  total: number
  /** Resolved by the backend based on variant image → product image priority */
  resolved_image_url: string | null
  /** Key-value map of variant options e.g. { color: { value: 'Red', color_hex: '#DC2626' } } */
  variant_options: Record<string, { value: string; color_hex?: string | null }>
  product?: { id: number; name: string; slug?: string }
}

// ── Order ─────────────────────────────────────────────────────────
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'delivered' | 'refunded'

export interface Order {
  id: number
  order_number?: string
  user?: { id: number; name: string; email: string }
  status: OrderStatus
  payment_status?: string
  payment_method?: string
  total_amount: number
  wilaya?: string | null
  address?: string | null
  phone?: string | null
  items?: OrderItem[]
  created_at: string
  updated_at: string
}

// ── Dashboard ─────────────────────────────────────────────────────
export interface DashboardKPIs {
  total_users: number
  total_sellers: number
  total_products: number
  total_orders: number
  total_revenue: number
  pending_seller_approvals: number
  pending_product_approvals: number
}

export interface DashboardData {
  kpis: DashboardKPIs
  order_status_distribution: Record<string, number>
  monthly_revenue: Array<{ month: string; revenue: number }>
  recent_orders: Order[]
}

// ── Statistics ────────────────────────────────────────────────────
export interface RevenuePoint  { month: string; revenue: number }
export interface OrderTrendPoint { month: string; pending: number; processing: number; delivered: number; canceled: number }
export interface CategoryPoint  { name: string; count: number }