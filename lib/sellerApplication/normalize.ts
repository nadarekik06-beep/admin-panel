/**
 * Seller application inputs: what sellers type is fixed, not refused.
 *
 * Mirrors the Laravel backend exactly, so nothing passes here and fails on submit:
 *   - App\Support\SocialLink          (social links, website)
 *   - App\Support\TunisianPhone       (phone)
 *   - SellerApplicationService::rules (lengths, required fields, images)
 * Copy of choosetounsi-frontend/lib/sellerApplication/normalize.ts: keep both in sync.
 */

export type SocialNetwork = 'instagram' | 'facebook' | 'tiktok'

/** A full link: scheme + a host with a dot, no spaces (SocialLink::PATTERN). */
export const LINK_PATTERN = /^https?:\/\/[^\s/?#]+\.[^\s/?#]{2,}([/?#]\S*)?$/i
/** Tunisian mobile, bare 8 digits (TunisianPhone::PATTERN). */
export const PHONE_PATTERN = /^[2459][0-9]{7}$/

const HANDLE = /^@?([A-Za-z0-9._-]{1,100})$/
const NETWORKS: Record<SocialNetwork, { base: string; hosts: string[] }> = {
  instagram: { base: 'https://instagram.com/', hosts: ['instagram.com', 'instagr.am'] },
  facebook:  { base: 'https://facebook.com/',  hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  tiktok:    { base: 'https://tiktok.com/@',   hosts: ['tiktok.com'] },
}

/** Backend limits (SellerApplicationService::rules). */
export const LIMITS = {
  name: 255,
  link: 255,
  description: 2000,
  caption: 200,
  categories: 5,
  samples: 5,
  imageBytes: 4096 * 1024,
} as const

/** Below this, the description gets a friendly (non-blocking) nudge. */
export const DESCRIPTION_NICE = 50

// ── Normalizers ─────────────────────────────────────────────────────────────

/** "flamingofashionsfax" / "@flamingofashionsfax" / "instagram.com/x" → full link. Empty → ''. */
export function normalizeSocial(network: SocialNetwork, raw: string): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  const lower = v.toLowerCase()
  // A link without "https://": "instagram.com/x", "www.facebook.com/x", "linktr.ee/x"
  if (v.includes('/') || NETWORKS[network].hosts.some(h => lower.includes(h))) {
    return /\s/.test(v) ? v : 'https://' + v.replace(/^\/+/, '')
  }
  const m = HANDLE.exec(v)
  if (m) return NETWORKS[network].base + m[1]
  return v
}

/** "votreboutique.tn" → "https://votreboutique.tn". Empty → ''. */
export function normalizeWebsite(raw: string): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) || /\s/.test(v) ? v : 'https://' + v.replace(/^\/+/, '')
}

/** "+216 22-123-456" → "22123456" (TunisianPhone::normalize). */
export function normalizePhone(raw: string): string {
  return (raw ?? '').replace(/[\s\-.()]/g, '').replace(/^(\+216|00216)/, '')
}

/** "22123456" → "22 123 456" for display. */
export function formatPhone(digits: string): string {
  return /^\d{8}$/.test(digits) ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}` : digits
}

// ── Checks ──────────────────────────────────────────────────────────────────
// Each returns null when the value is fine, or an issue code + values for the
// translated hint (vendor.guide.<code>). `blocking: false` = advice only.

export interface Issue {
  code: string
  values?: Record<string, string | number>
  blocking: boolean
}

const issue = (code: string, values?: Issue['values'], blocking = true): Issue => ({ code, values, blocking })

export function checkFullName(v: string): Issue | null {
  const t = v.trim()
  if (!t) return issue('fullNameRequired')
  if (t.length > LIMITS.name) return issue('fullNameMax')
  return null
}

export function checkBusinessName(v: string): Issue | null {
  const t = v.trim()
  if (!t) return issue('businessNameRequired')
  if (t.length > LIMITS.name) return issue('businessNameMax')
  return null
}

export function checkPhone(v: string): Issue | null {
  if (!v.trim()) return issue('phoneRequired')
  const n = normalizePhone(v)
  if (PHONE_PATTERN.test(n)) return null
  const digits = n.replace(/\D/g, '')
  if (/[^\d]/.test(n)) return issue('phoneLetters')
  if (digits.length < 8) return issue('phoneDigits', { left: 8 - digits.length })
  if (digits.length > 8) return issue('phoneTooMany')
  return issue('phonePrefix')
}

export function checkCategories(selected: string[]): Issue | null {
  if (selected.length === 0) return issue('categoryRequired')
  if (selected.length > LIMITS.categories) return issue('categoriesMax')
  return null
}

export function checkDescription(v: string): Issue | null {
  const len = v.trim().length
  if (len > LIMITS.description) return issue('descriptionMax', { extra: len - LIMITS.description })
  if (len > 0 && len < DESCRIPTION_NICE) return issue('descriptionShort', { left: DESCRIPTION_NICE - len }, false)
  return null
}

/** Optional link: '' is fine. Returns the link that will be sent. */
export function checkLink(kind: SocialNetwork | 'website', raw: string): { issue: Issue | null; value: string } {
  const value = kind === 'website' ? normalizeWebsite(raw) : normalizeSocial(kind, raw)
  if (!value) return { issue: null, value: '' }
  if (value.length > LIMITS.link) return { issue: issue('linkTooLong'), value }
  if (!LINK_PATTERN.test(value)) return { issue: issue(`${kind}Help`), value }
  return { issue: null, value }
}
