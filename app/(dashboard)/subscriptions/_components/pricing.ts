import {
  BarChart3, Check, Clock, Crown, Gift, Headset, Heart, Image, Megaphone, Package, Percent,
  Rocket, Shield, Sparkles, Star, Tag, Ticket, Truck, Users, Zap, type LucideIcon,
} from 'lucide-react'
import type { Capability, CapabilityDisplay, CommissionTable, DisplayFeature, PublicLimitKey } from '@/types/subscriptions'

/**
 * Mirrors of the backend's pricing-card rules (App\Services\PricingCatalog), so the
 * plan editor's live preview matches what /become-a-vendor will render.
 */

/** Same keys as PlanDisplayFeature::ICONS / the storefront's PLAN_ICONS. */
export const ICONS: Record<string, LucideIcon> = {
  check: Check, star: Star, zap: Zap, sparkles: Sparkles, crown: Crown, chart: BarChart3,
  megaphone: Megaphone, ticket: Ticket, tag: Tag, percent: Percent, package: Package, image: Image,
  truck: Truck, headset: Headset, shield: Shield, gift: Gift, clock: Clock, users: Users,
  rocket: Rocket, heart: Heart,
}

/** Order of capabilities on the public card (PlanCapability::PUBLIC_ORDER). */
export const PUBLIC_ORDER = ['promotions', 'coupons', 'sponsorships', 'analytics', 'ai_tools', 'black_hub']

export const LIMIT_NAMES: Record<PublicLimitKey, string> = {
  max_products: 'Max products',
  max_images_per_product: 'Max images / product',
  max_sponsored_products: 'Max sponsored at once',
}

export const LABEL_MAX = 80
export const DESCRIPTION_MAX = 160

const n = (v: number) => v.toLocaleString('fr-FR').replace(/ | /g, ' ')

/** French card line for a limit; null = unlimited. */
export function limitLabel(key: PublicLimitKey, value: number | null): string {
  switch (key) {
    case 'max_products':
      return value === null ? 'Produits illimités' : value === 1 ? '1 produit' : `${n(value)} produits`
    case 'max_images_per_product':
      return value === null ? 'Photos illimitées par produit' : value === 1 ? '1 photo par produit' : `${n(value)} photos par produit`
    case 'max_sponsored_products':
      return value === null ? 'Produits sponsorisés illimités' : value === 1 ? '1 produit sponsorisé à la fois' : `${n(value)} produits sponsorisés à la fois`
  }
}

export interface PreviewInput {
  name: string
  tagline: string
  badge_color: string
  tier: 0 | 1 | 2
  price_monthly: number
  commission: { min: number; max: number } | null
  is_recommended: boolean
  limits: Record<PublicLimitKey, number | null>
  hidden_limits: PublicLimitKey[]
  features: Record<string, boolean>
  capability_display: Record<string, CapabilityDisplay>
  display_features: DisplayFeature[]
}

export interface PreviewLine { key: string; label: string; description?: string | null; title?: string | null; included: boolean; highlight?: boolean; icon?: string | null; kind: 'limit' | 'capability' | 'feature' }

/** Card lines in public order: limits, then capabilities, then display features. */
export function previewLines(p: PreviewInput, capabilities: Capability[]): PreviewLine[] {
  const lines: PreviewLine[] = []
  for (const key of Object.keys(LIMIT_NAMES) as PublicLimitKey[]) {
    if (p.hidden_limits.includes(key)) continue
    if (key === 'max_sponsored_products' && !p.features.sponsorships) continue
    const value = p.limits[key]
    if (value === 0) continue
    lines.push({ key: `l-${key}`, label: limitLabel(key, value), included: true, kind: 'limit', icon: key === 'max_products' ? 'package' : key === 'max_images_per_product' ? 'image' : 'megaphone' })
  }
  const byKey = Object.fromEntries(capabilities.map((c) => [c.key, c]))
  for (const key of PUBLIC_ORDER) {
    const cap = byKey[key]
    if (!cap) continue
    const o = p.capability_display[key] ?? {}
    if (o.visible === false) continue
    lines.push({
      key: `c-${key}`, kind: 'capability', included: !!p.features[key],
      label: o.label?.trim() || cap.public_label,
      title: o.description?.trim() || cap.public_description,
    })
  }
  p.display_features.forEach((f, i) => {
    if (!f.label.trim()) return
    lines.push({ key: `d-${i}`, kind: 'feature', label: f.label.trim(), description: f.description?.trim() || null, included: f.included, highlight: f.highlight, icon: f.icon })
  })
  return lines
}

/** Commission range the plan will show, from the platform tiers (CommissionService::rateRangeForPlan). */
export function commissionRange(table: CommissionTable | null, mode: 'flat' | 'tiers', flat: number | null, reduction: number): { min: number; max: number } | null {
  if (mode === 'flat') return flat === null || Number.isNaN(flat) ? null : { min: flat, max: flat }
  if (!table || table.tiers.length === 0) return null
  const rates = table.tiers.map((t) => Math.max(table.floor, t.rate - reduction))
  return { min: Math.min(...rates), max: Math.max(...rates) }
}

export const fmtPct = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`
