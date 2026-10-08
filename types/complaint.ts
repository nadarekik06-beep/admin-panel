/**
 * Returns ("réclamations") as the admin moderates them. Return + refund only;
 * legacy "exchange" records stay readable and can only be closed.
 *
 *   requested → seller_accepted | seller_rejected (→ escalated by the client)
 *             → admin_approved → pickup_scheduled → picked_up
 *             → returned_to_seller (received & inspected) → refunded
 *   terminal: rejected | cancelled | closed
 */

export type ComplaintStatus =
  | 'requested'
  | 'seller_accepted'
  | 'seller_rejected'
  | 'escalated'
  | 'admin_approved'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'returned_to_seller'
  | 'refunded'
  | 'rejected'
  | 'cancelled'
  | 'closed'

export type ComplaintType = 'wrong_product' | 'wrong_size' | 'wrong_color' | 'damaged_product' | 'other'
export type ResolutionType = 'return_refund' | 'exchange'
export type RefundMethod = 'cash' | 'wallet' | 'bank_transfer' | 'd17' | 'original'
export type ItemCondition = 'resaleable' | 'damaged'

export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  wrong_product:   'Wrong product received',
  wrong_size:      'Wrong size',
  wrong_color:     'Wrong color',
  damaged_product: 'Damaged / defective product',
  other:           'Other',
}

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  cash:          'Cash, paid by the courier at pick-up',
  wallet:        'ChooseTounsi wallet',
  bank_transfer: 'Bank transfer',
  d17:           'D17',
  original:      'Original card (Stripe)',
}

export const STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; bg: string }> = {
  requested:          { label: 'Requested',          color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  seller_accepted:    { label: 'Seller accepted',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  seller_rejected:    { label: 'Seller refused',     color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  escalated:          { label: 'Escalated',          color: '#a78bfa', bg: 'rgba(139,92,246,0.14)' },
  admin_approved:     { label: 'Approved',           color: '#38bdf8', bg: 'rgba(14,165,233,0.12)' },
  pickup_scheduled:   { label: 'Pick-up scheduled',  color: '#818cf8', bg: 'rgba(99,102,241,0.14)' },
  picked_up:          { label: 'Picked up',          color: '#818cf8', bg: 'rgba(99,102,241,0.14)' },
  returned_to_seller: { label: 'Received',           color: '#2dd4bf', bg: 'rgba(20,184,166,0.12)' },
  refunded:           { label: 'Refunded',           color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  rejected:           { label: 'Rejected',           color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  cancelled:          { label: 'Cancelled',          color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  closed:             { label: 'Closed',             color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

export const statusConfig = (s: string) =>
  STATUS_CONFIG[s as ComplaintStatus] ?? { label: s, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }

/** One attribute of the bought variant, frozen at checkout. */
export interface PurchasedVariantAttribute {
  option_id?: number
  slug:       string
  label:      string
  value:      string
  color_hex:  string | null
}

/** A returned line: as bought (order snapshot) + what this return covers. */
export interface ComplaintOrderItem {
  id:                  number
  product_id?:         number | null
  variant_id?:         number | null
  product_name:        string
  variant_label:       string | null
  variant_attributes?: PurchasedVariantAttribute[]
  quantity:            number          // as ordered
  unit_price:          number
  total?:              number
  image_url:           string | null
  return_quantity:     number
  return_unit_price:   number          // price actually paid per unit
  return_amount:       number
  condition:           ItemCondition | null
  restocked_quantity:  number
}

export interface ComplaintOrder {
  id:              number
  order_number:    string
  total_amount:    number
  status:          string
  return_status?:  'partial' | 'full' | null
  payment_method?: string
  payment_status?: string
  shipping_fee?:   number
  created_at?:     string
  updated_at?:     string
}

export interface ComplaintUser { id: number; name: string; email: string }

export interface TimelineStep { key: string; status: string; at: string | null; done: boolean; current: boolean; skipped: boolean }

export interface ComplaintEvent {
  id:         number
  status:     string
  actor_role: string | null
  note:       string | null
  meta:       Record<string, unknown> | null
  created_at: string
  actor?:     { id: number; name: string; role: string } | null
}

export interface Address {
  name?: string | null; phone?: string | null; phone_secondary?: string | null; address?: string | null
  delegation?: string | null; postal_code?: string | null; wilaya?: string | null; notes?: string | null
}

export interface SellerPickup {
  shop_name: string | null; contact: string | null; phone: string | null; address: string | null
  city: string | null; postal_code: string | null; wilaya: string | null; notes: string | null
  complete: boolean; missing: string[]
}

export interface SellerAdjustment {
  id: number; type: string; amount: number | string; description: string
  settlement_batch_id: number | null; applied_at: string | null; created_at: string
}

export interface Complaint {
  id:                  number
  reference:           string | null
  user_id:             number
  order_id:            number
  seller_id:           number | null
  complaint_type:      ComplaintType
  resolution_type:     ResolutionType | null
  return_scope:        'full' | 'partial' | null
  shipping_payer:      'seller' | 'client' | null
  return_shipping_fee: number | string
  items_amount:        number | string
  refund_amount:       number | string
  refund_method:       RefundMethod | null
  refund_reference:    string | null
  other_reason:        string | null
  description:         string
  image_url:           string | null
  image_urls:          string[]
  status:              ComplaintStatus
  rejection_reason:    string | null
  seller_note:         string | null
  seller_decision:     'approved' | 'rejected' | null
  escalation_note:     string | null
  admin_note:          string | null
  pickup_note:         string | null
  reception_note:      string | null
  created_at:          string
  refunded_at:         string | null
  refund_status?:      string | null
  order?:              ComplaintOrder
  user?:               ComplaintUser
  seller?:             ComplaintUser
  complained_items?:   ComplaintOrderItem[]
  timeline?:           TimelineStep[]
  events?:             ComplaintEvent[]
  client_address?:     Address
  seller_pickup?:      SellerPickup
  refund_methods?:     RefundMethod[]
  cash_refund?:        boolean   // COD: the courier pays the client back in cash at pick-up
  adjustments?:        SellerAdjustment[]
  allowed_transitions?: ComplaintStatus[]
  refund_task?:        { id: number; status: string; delivery_guy?: { id: number; name: string } | null } | null
}
