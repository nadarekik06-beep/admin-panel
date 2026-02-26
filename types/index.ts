// types/index.ts

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
  is_active: boolean       // ✅ real column
  is_approved: boolean     // ✅ real column
  orders_count?: number
  created_at: string
  updated_at: string
}

// ── Seller ────────────────────────────────────────────────────────

export interface Seller {
  id: number
  name: string        // direct field — seller IS a user
  email: string       // direct field
  role: 'seller'
  is_active: boolean
  is_approved: boolean
  products_count?: number
  created_at: string
  updated_at: string
}

// ── Product ───────────────────────────────────────────────────────
export type ProductStatus = 'pending' | 'approved' | 'disabled'

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
  seller?: { id: number; name: string; email?: string }
  category?: { id: number; name: string }
  created_at: string
  updated_at: string
}

// ── Order ─────────────────────────────────────────────────────────
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled'

export interface Order {
  id: number
  order_number?: string        // ✅ add this
  user?: { id: number; name: string; email: string }
  status: OrderStatus
  payment_status?: string      // ✅ add this too (your orders table has it)
  payment_method?: string      // ✅ and this
  total_amount: number
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
export interface RevenuePoint {
  month: string
  revenue: number
}

export interface OrderTrendPoint {
  month: string
  pending: number
  processing: number
  delivered: number
  canceled: number
}

export interface CategoryPoint {
  name: string
  count: number
}