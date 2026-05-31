/**
 * FILE: types/complaint.ts  (customer frontend + admin panel)  ← REPLACE BOTH
 *
 * Changes:
 *   - Added ResolutionType type
 *   - Added resolution_type to Complaint interface
 *   - Added hours_left and window_hours to EligibleOrder response
 *   - ComplaintFormPayload now requires resolution_type
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

// ← NEW
export type ResolutionType = 'exchange' | 'return_refund'

export const RESOLUTION_TYPE_LABELS: Record<ResolutionType, { label: string; description: string; icon: string }> = {
  exchange: {
    label:       'Exchange',
    description: 'Receive a replacement item instead',
    icon:        '🔄',
  },
  return_refund: {
    label:       'Return & Refund',
    description: 'Return the item and get your money back',
    icon:        '💰',
  },
}

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

export interface EligibleOrderItem {
  id:           number
  product_name: string
  quantity:     number
  unit_price:   number
  image_url:    string | null
}

export interface EligibleOrder {
  id:           number
  order_number: string
  delivered_at: string
  hours_left:   number   // ← NEW (48h window)
  days_left:    number   // kept for backward compat
  total_amount: number
  items:        EligibleOrderItem[]
}

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

export interface Complaint {
  id:               number
  user_id:          number
  order_id:         number
  order_item_ids:   number[] | null
  seller_id:        number | null
  complaint_type:   ComplaintType
  resolution_type:  ResolutionType | null   // ← NEW
  other_reason:     string | null
  description:      string
  image_path:       string | null
  image_url:        string | null
  status:           ComplaintStatus
  rejection_reason: string | null
  seller_note:      string | null
  seller_decision:  'approved' | 'rejected' | null
  reviewed_at:      string | null
  resolved_at:      string | null
  created_at:       string
  updated_at:       string
  order?:           ComplaintOrder
  user?:            ComplaintUser
  seller?:          ComplaintUser
  complained_items?: ComplaintOrderItem[]
  refund_status?:   'pending' | 'assigned' | 'picked_up' | 'completed' | null
  refund_task_id?:  number | null
}

export interface ComplaintFormPayload {
  order_id:         number
  complaint_type:   ComplaintType
  resolution_type:  ResolutionType   // ← NEW, required
  other_reason?:    string
  description:      string
  image?:           File | null
  item_ids?:        number[]
}