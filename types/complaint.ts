/**
 * After-sale requests ("réclamations") as the admin moderates them: a RETURN
 * (refund) or an EXCHANGE (another variant, Intigo exchange parcel). Legacy
 * exchange records (is_legacy_exchange) stay readable and can only be closed.
 *
 *   requested → seller_accepted | seller_rejected (→ escalated by the client) → admin_approved
 *   return:   → pickup_scheduled → picked_up → returned_to_seller (received & inspected) → refunded
 *   exchange: → exchange_in_transit → exchanged → exchange_completed (seller got the old item)
 *             exchange_in_transit → exchange_failed → retry | switch to return | cancel
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
  | 'exchange_in_transit'
  | 'exchanged'
  | 'exchange_failed'
  | 'exchange_completed'

export type ComplaintType =
  | 'wrong_product' | 'wrong_size' | 'wrong_color' | 'damaged_product'
  | 'changed_mind' | 'doesnt_fit' | 'prefer_other_color' | 'other'
export type ResolutionType = 'return_refund' | 'exchange'
export type RefundMethod = 'cash' | 'wallet' | 'bank_transfer' | 'd17' | 'original'
export type ItemCondition = 'resaleable' | 'damaged'
export type Payer = 'seller' | 'client'
export type ExchangeSyncStatus = 'sending' | 'sent' | 'manual' | 'needs_check' | 'failed' | 'cancelled'

export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  wrong_product:      'Wrong product received',
  wrong_size:         'Wrong size sent',
  wrong_color:        'Wrong color sent',
  damaged_product:    'Damaged / defective product',
  changed_mind:       'Changed my mind',
  doesnt_fit:         "Size doesn't fit",
  prefer_other_color: 'Prefers another color',
  other:              'Other',
}

/** Seller at fault → the seller pays the after-sale parcel (the admin may switch it). */
export const SELLER_FAULT_TYPES: ComplaintType[] = ['wrong_product', 'wrong_size', 'wrong_color', 'damaged_product']

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
  exchange_in_transit: { label: 'Exchange in transit', color: '#818cf8', bg: 'rgba(99,102,241,0.14)' },
  exchanged:          { label: 'Exchanged · old item due', color: '#2dd4bf', bg: 'rgba(20,184,166,0.12)' },
  exchange_failed:    { label: 'Exchange failed',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  exchange_completed: { label: 'Exchange completed', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
}

/** Shared decision steps read as "Exchange requested / approved…" on an exchange. */
const EXCHANGE_LABELS: Partial<Record<ComplaintStatus, string>> = {
  requested: 'Exchange requested', admin_approved: 'Exchange approved', seller_accepted: 'Seller accepted (exchange)',
}

export const statusConfig = (s: string, resolution?: ResolutionType | null) => {
  const base = STATUS_CONFIG[s as ComplaintStatus] ?? { label: s, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  const label = resolution === 'exchange' ? EXCHANGE_LABELS[s as ComplaintStatus] : undefined
  return label ? { ...base, label } : base
}

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
  /** Exchange: the variant sent instead */
  replacement_variant_id?: number | null
  replacement_label?:      string | null
  replacement_reserved?:   boolean
}

export interface ComplaintCost {
  id: number; kind: 'return' | 'exchange' | 'exchange_failed'; size: string | null
  intigo_cost: number | string; recovered_client: number | string; recovered_seller: number | string
  margin: number; payer: Payer | null; intigo_nid: string | null; booked_at: string | null
}

export interface ComplaintFees {
  case_fee: number; return_fee: number; exchange_fee: number; client_fee: number; seller_fee: number
  items_amount: number; default_payer: Payer
}

export interface ExchangeInfo {
  original_nid: string | null
  can_book: boolean
  problems: string[]
  payload: Record<string, unknown> | null
  cod: number
  intigo_mode: 'fake' | 'live'
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

/** Who asked (staff views): the account, or a guest's name + phone from the order. */
export interface ComplaintBuyer {
  is_guest: boolean
  name:     string | null
  phone:    string | null
  email:    string | null
}

export interface Complaint {
  id:                  number
  reference:           string | null
  user_id:             number | null   // null: guest (no account)
  order_id:            number
  seller_id:           number | null
  complaint_type:      ComplaintType
  resolution_type:     ResolutionType | null
  return_scope:        'full' | 'partial' | null
  shipping_payer:      Payer | null
  return_shipping_fee: number | string
  exchange_fee?:       number | string
  fee_size?:           'S' | 'L' | 'XL' | null
  fee_exceeds_refund?: boolean
  is_legacy_exchange?: boolean
  old_item_overdue?:   boolean
  intigo_exchange_nid?: string | null
  exchange_sync_status?: ExchangeSyncStatus | null
  exchange_sync_error?: string | null
  intigo_exchange_status_code?: number | null
  intigo_exchange_status_label?: string | null
  exchange_shipped_at?: string | null
  exchanged_at?:       string | null
  exchange_failed_at?: string | null
  old_item_received_at?: string | null
  items_amount:        number | string
  refund_amount:       number | string
  refund_method:       RefundMethod | null
  refund_reference:    string | null
  /** After-sale return booked by hand in the Intigo dashboard: its reference */
  intigo_return_ref?:  string | null
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
  buyer?:              ComplaintBuyer
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
  fees?:               ComplaintFees
  costs?:              ComplaintCost[]
  exchange?:           ExchangeInfo
  refund_task?:        { id: number; status: string; delivery_guy?: { id: number; name: string } | null } | null
}
