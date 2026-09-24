import type { Availability, ModerationStatus } from '@/types/productReview'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/api$/, '')

export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  const clean = path.replace(/^\/storage\//, '').replace(/^\//, '')
  return `${API_ORIGIN}/storage/${clean}`
}

export function formatDT(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return `${Number(value).toFixed(3)} DT`
}

export const STATUS_META: Record<ModerationStatus, { label: string; badge: 'pending' | 'approved' | 'rejected' | 'disabled' | 'info' | 'error' }> = {
  pending:           { label: 'Pending review',    badge: 'pending'  },
  changes_requested: { label: 'Changes requested', badge: 'info'     },
  rejected:          { label: 'Rejected',          badge: 'rejected' },
  approved:          { label: 'Approved',          badge: 'approved' },
  disabled:          { label: 'Disabled',          badge: 'disabled' },
  deleted_by_seller: { label: 'Deleted by seller', badge: 'error'    },
}

export const AVAILABILITY_META: Record<Availability, { label: string; badge: 'success' | 'warning' | 'error' | 'disabled' }> = {
  in_stock:     { label: 'In stock',     badge: 'success'  },
  low_stock:    { label: 'Low stock',    badge: 'warning'  },
  out_of_stock: { label: 'Out of stock', badge: 'error'    },
  inactive:     { label: 'Inactive',     badge: 'disabled' },
}

/** Subscription tiers — brand pepper colors. */
export const PLAN_META: Record<'free' | 'red' | 'black', { label: string; color: string; bg: string; border: string }> = {
  free:  { label: 'Green Pepper', color: '#34d399', bg: 'rgba(25,143,65,0.15)',  border: 'rgba(25,143,65,0.45)' },
  red:   { label: 'Red Pepper',   color: '#f87171', bg: 'rgba(219,20,46,0.15)',  border: 'rgba(219,20,46,0.45)' },
  black: { label: 'Black Pepper', color: '#f1f5f9', bg: 'rgba(0,0,0,0.55)',      border: 'rgba(241,245,249,0.35)' },
}

/** Badge style for any plan slug; admin-created plans use their own colour. */
export function planStyle(slug: string, name?: string, color?: string) {
  const known = PLAN_META[slug as keyof typeof PLAN_META]
  if (known && !color) return known
  const c = color ?? '#94a3b8'
  return { label: name ?? known?.label ?? slug, color: c, bg: `${c}26`, border: `${c}73` }
}

/**
 * Fallback for the moderation reason list when the review payload isn't
 * loaded (quick reject from the products table). Mirrors
 * ProductModerationLog::REASONS on the backend — the review page always uses
 * the server-provided list.
 */
export const DEFAULT_MODERATION_REASONS = [
  { code: 'poor_image_quality',     label: 'Poor image quality' },
  { code: 'insufficient_images',    label: 'Not enough images' },
  { code: 'wrong_category',         label: 'Wrong category' },
  { code: 'prohibited_item',        label: 'Prohibited item' },
  { code: 'misleading_description', label: 'Misleading description' },
  { code: 'incorrect_price',        label: 'Incorrect price' },
  { code: 'missing_variant_info',   label: 'Missing variant info' },
  { code: 'counterfeit',            label: 'Suspected counterfeit / brand infringement' },
  { code: 'duplicate_listing',      label: 'Duplicate listing' },
  { code: 'other',                  label: 'Other' },
]

/** Pull a human message out of an axios error (Laravel 422 / JSON errors). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
  const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
  return first ?? data?.message ?? fallback
}
