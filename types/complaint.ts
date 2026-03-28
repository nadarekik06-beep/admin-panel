/**
 * FILE: types/complaint.ts  ← REPLACE existing file (same in both frontends)
 *
 * Changes from v1:
 *   - Added 'seller_rejected_pending_admin' to ComplaintStatus
 *   - Added STATUS_CONFIG entry for new status
 *   - Added seller_decision field to Complaint interface
 */

export type ComplaintStatus =
  | 'pending'
  | 'reviewing'
  | 'approved'
  | 'seller_rejected_pending_admin'
  | 'rejected'

export type ComplaintType =
  | 'wrong_product'
  | 'wrong_size'
  | 'wrong_color'
  | 'damaged_product'
  | 'other'

// ─── Label maps ───────────────────────────────────────────────────────────────

export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  wrong_product:   'Wrong product received',
  wrong_size:      'Wrong size',
  wrong_color:     'Wrong color',
  damaged_product: 'Damaged / defective product',
  other:           'Other (specify below)',
}

export const STATUS_CONFIG: Record<
  ComplaintStatus,
  { label: string; color: string; bg: string; description: string }
> = {
  pending: {
    label:       'Pending',
    color:       '#f59e0b',
    bg:          'rgba(245,158,11,0.1)',
    description: 'Awaiting seller review.',
  },
  reviewing: {
    label:       'Under Review',
    color:       '#3b82f6',
    bg:          'rgba(59,130,246,0.1)',
    description: 'Seller is reviewing your complaint.',
  },
  approved: {
    label:       'Approved',
    color:       '#10b981',
    bg:          'rgba(16,185,129,0.1)',
    description: 'Your complaint has been approved.',
  },
  seller_rejected_pending_admin: {
    label:       'Awaiting Admin',
    color:       '#f97316',
    bg:          'rgba(249,115,22,0.1)',
    description: 'Seller rejected — admin will make the final decision.',
  },
  rejected: {
    label:       'Rejected',
    color:       '#ef4444',
    bg:          'rgba(239,68,68,0.1)',
    description: 'Your complaint was not approved.',
  },
}

// ─── Eligible Order ───────────────────────────────────────────────────────────

export interface EligibleOrderItem {
  product_name: string
  quantity:     number
}

export interface EligibleOrder {
  id:           number
  order_number: string
  delivered_at: string
  days_left:    number
  total_amount: number
  items:        EligibleOrderItem[]
}

// ─── Nested shapes ────────────────────────────────────────────────────────────

export interface ComplaintOrderItem {
  id:           number
  product_name: string
  quantity:     number
  unit_price:   number
  total:        number
}

export interface ComplaintOrder {
  id:           number
  order_number: string
  total_amount: number
  status:       string
  created_at?:  string
  wilaya?:      string
  address?:     string
  phone?:       string
  items?:       ComplaintOrderItem[]
}

export interface ComplaintUser {
  id:    number
  name:  string
  email: string
}

// ─── Main Complaint ───────────────────────────────────────────────────────────

export interface Complaint {
  id:               number
  user_id:          number
  order_id:         number
  seller_id:        number | null
  complaint_type:   ComplaintType
  other_reason:     string | null
  description:      string
  image_path:       string | null
  image_url:        string | null
  status:           ComplaintStatus
  rejection_reason: string | null
  seller_note:      string | null
  seller_decision:  'approved' | 'rejected' | null  // NEW
  reviewed_at:      string | null
  resolved_at:      string | null
  created_at:       string
  updated_at:       string
  order?:           ComplaintOrder
  user?:            ComplaintUser
  seller?:          ComplaintUser
}

// ─── Form payload ─────────────────────────────────────────────────────────────

export interface ComplaintFormPayload {
  order_id:       number
  complaint_type: ComplaintType
  other_reason?:  string
  description:    string
  image?:         File | null
}