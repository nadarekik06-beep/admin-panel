'use client'

// Shipping address, seller pickup points and delivery-document exports for
// the admin Orders page. Data comes from GET /api/admin/orders/{id}
// (shipping_address, seller_orders[].pickup, export_readiness, export_history).

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  MapPin, Phone, Copy, Check, AlertTriangle, Store, FileDown, ChevronDown,
  FileText, Files, Lock, Pencil, X, Save, CheckCircle, XCircle,
} from 'lucide-react'
import { ordersApi, type PickupAddressInput } from '@/lib/api/orders'

import BrandLoader from '@/components/brand/BrandLoader'
// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShippingAddress {
  status:          'complete' | 'legacy' | 'missing'
  recipient_name:  string | null
  phone:           string | null
  phone_secondary: string | null
  wilaya:          string | null
  delegation:      string | null
  address:         string | null
  postal_code:     string | null
  notes:           string | null
  formatted:       string
}

export interface SellerPickup {
  shop_name:   string | null
  contact:     string | null
  phone:       string | null
  address:     string | null
  city:        string | null
  postal_code: string | null
  wilaya:      string | null
  notes:       string | null
  formatted:   string
  is_platform: boolean
  complete:    boolean
  missing:     string[]
}

export interface SlipMoney { subtotal: number; discount: number; shipping: number; total: number; cod: number }

export interface ExportReadiness { ready: boolean; issues: string[] }

export interface ExportHistoryEntry {
  id: number
  type: 'slip' | 'slips' | 'summary' | 'bulk'
  seller_order_id: number | null
  exported_by: string | null
  created_at: string
}

// Same list as the backend (App\Support\Wilayas) and the storefront.
export const WILAYAS = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa',
  'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia',
  'La Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid',
  'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
]

export const dt = (v: number | string | null | undefined) => `${Number(v ?? 0).toFixed(3)} DT`

/** "22123456" → "22 123 456" for reading over the phone. */
export const prettyPhone = (p: string | null | undefined) =>
  p && /^\d{8}$/.test(p) ? `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}` : (p ?? '')

// Direction follows the first letter. RegExp constructor: tsconfig has no target, so no /u literals.
const FIRST_LETTER_ARABIC = new RegExp('^[^\\p{L}]*\\p{Script=Arabic}', 'u')
const isArabic = (s: string | null | undefined) => !!s && FIRST_LETTER_ARABIC.test(s)

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { type: 'success' | 'error'; msg: string } | null

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const show = useCallback((type: 'success' | 'error', msg: string) => {
    clearTimeout(timer.current)
    setToast({ type, msg })
    timer.current = setTimeout(() => setToast(null), type === 'error' ? 7000 : 3500)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { toast, show, dismiss: () => setToast(null) }
}

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  const color = ok ? '#10b981' : '#ef4444'
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
      display: 'flex', alignItems: 'center', gap: 10, maxWidth: 'min(560px, calc(100vw - 32px))',
      background: '#111827', border: `1px solid ${color}55`, borderRadius: 12,
      padding: '11px 14px', color: '#f1f5f9', fontSize: 13, fontWeight: 600,
      boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
    }}>
      {ok ? <CheckCircle size={16} color={color} style={{ flexShrink: 0 }} /> : <XCircle size={16} color={color} style={{ flexShrink: 0 }} />}
      <span style={{ lineHeight: 1.45 }}>{toast.msg}</span>
      <button onClick={onClose} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2, display: 'flex' }}>
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.35)', margin: '0 0 10px',
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for non-secure contexts (plain http on a LAN IP)
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} title="Copy to clipboard" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
      background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
      color: copied ? '#10b981' : '#94a3b8', fontSize: 11, fontWeight: 700, cursor: 'pointer',
    }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : label}
    </button>
  )
}

function PhoneLink({ phone, primary }: { phone: string; primary?: boolean }) {
  return (
    <a href={`tel:+216${phone}`} title="Call" dir="ltr" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
      color: primary ? '#3b82f6' : '#94a3b8', fontWeight: 800, fontSize: primary ? 15 : 13,
    }}>
      <Phone size={primary ? 13 : 11} /> +216 {prettyPhone(phone)}
    </a>
  )
}

function WarningBadge({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 800,
      padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em',
      background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)',
    }}>
      <AlertTriangle size={9} />{children}
    </span>
  )
}

export function ExportedBadge({ at }: { at: string }) {
  const when = new Date(at)
  return (
    <span title={`Delivery slips exported ${when.toLocaleString()}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 800,
      padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em',
      background: 'rgba(20,184,166,0.12)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.3)',
      whiteSpace: 'nowrap',
    }}>
      <FileDown size={9} /> Exported
    </span>
  )
}

// ─── Shipping address card ────────────────────────────────────────────────────

export function ShippingAddressCard({ address }: { address?: ShippingAddress | null }) {
  if (!address || address.status === 'missing') {
    return (
      <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 10 }}>
        <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', margin: 0 }}>Address not recorded (legacy order)</p>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
            This order was placed before addresses were saved. Call the customer to get the delivery address — delivery slips can&apos;t be printed until then.
          </p>
        </div>
      </div>
    )
  }

  const copyText = [
    address.recipient_name,
    address.phone && `+216 ${prettyPhone(address.phone)}${address.phone_secondary ? ` / +216 ${prettyPhone(address.phone_secondary)}` : ''}`,
    address.formatted,
    address.notes && `Notes: ${address.notes}`,
  ].filter(Boolean).join('\n')

  return (
    <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={14} color="#3b82f6" />
          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Shipping Address</h3>
          {address.status === 'legacy' && (
            <WarningBadge title="Placed before structured addresses: no postal code / delegation. Confirm by phone.">Legacy — check by phone</WarningBadge>
          )}
        </div>
        <CopyButton text={copyText} label="Copy address" />
      </div>

      <p dir={isArabic(address.recipient_name) ? 'rtl' : 'ltr'} style={{ fontSize: 15, fontWeight: 900, color: '#f1f5f9', margin: '0 0 6px', textAlign: 'start' }}>
        {address.recipient_name ?? '—'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginBottom: 10 }}>
        {address.phone && <PhoneLink phone={address.phone} primary />}
        {address.phone_secondary && <PhoneLink phone={address.phone_secondary} />}
      </div>

      <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
        <div dir={isArabic(address.address) ? 'rtl' : 'ltr'} style={{ textAlign: 'start' }}>{address.address}</div>
        {address.delegation && <div>{address.delegation}</div>}
        <div style={{ fontWeight: 800, color: '#f1f5f9' }}>{[address.postal_code, address.wilaya].filter(Boolean).join(' ')}</div>
      </div>

      {address.notes && (
        <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>Landmark / delivery notes</span>
          <p dir={isArabic(address.notes) ? 'rtl' : 'ltr'} style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0', textAlign: 'start' }}>{address.notes}</p>
        </div>
      )}
    </div>
  )
}

// ─── Pickup block (inside a seller sub-order card) ────────────────────────────

export function PickupBlock({ sellerId, pickup, onSaved }: {
  sellerId: number | null
  pickup: SellerPickup
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Store size={11} color="#64748b" />
          <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>Pickup</span>
          {!pickup.complete && (
            <WarningBadge title={`Missing: ${pickup.missing.join(', ')}`}>Pickup address incomplete</WarningBadge>
          )}
        </div>
        {!pickup.is_platform && sellerId && !editing && (
          <button onClick={() => setEditing(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7,
            background: pickup.complete ? 'transparent' : 'rgba(245,158,11,0.12)',
            border: `1px solid ${pickup.complete ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.35)'}`,
            color: pickup.complete ? '#64748b' : '#f59e0b', fontSize: 10, fontWeight: 700, cursor: 'pointer',
          }}>
            <Pencil size={10} /> {pickup.complete ? 'Edit' : 'Complete address'}
          </button>
        )}
      </div>

      {editing && sellerId ? (
        <PickupForm sellerId={sellerId} pickup={pickup} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved() }} />
      ) : (
        <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8', lineHeight: 1.55 }}>
          <div style={{ color: '#cbd5e1', fontWeight: 700 }}>
            {pickup.contact ?? '—'}
            {pickup.phone && <> · <a href={`tel:+216${pickup.phone}`} style={{ color: '#3b82f6', textDecoration: 'none' }} dir="ltr">+216 {prettyPhone(pickup.phone)}</a></>}
          </div>
          <div dir={isArabic(pickup.formatted) ? 'rtl' : 'ltr'} style={{ textAlign: 'start' }}>{pickup.formatted || '—'}</div>
          {pickup.notes && <div style={{ fontSize: 11, color: '#64748b' }}>{pickup.notes}</div>}
          {!pickup.complete && (
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>
              Missing: {pickup.missing.join(', ')}
              {pickup.is_platform && ' — set PLATFORM_PICKUP_* in the backend .env'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#f1f5f9', outline: 'none', fontFamily: 'inherit',
}

function PickupForm({ sellerId, pickup, onCancel, onSaved }: {
  sellerId: number
  pickup: SellerPickup
  onCancel: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<PickupAddressInput>({
    full_name:          pickup.contact ?? '',
    phone_number:       pickup.phone ?? '',
    pickup_address:     pickup.address ?? '',
    city:               pickup.city ?? '',
    pickup_postal_code: pickup.postal_code ?? '',
    wilaya:             pickup.wilaya ?? '',
    pickup_notes:       pickup.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (k: keyof PickupAddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      await ordersApi.updateSellerPickup(sellerId, form)
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, el: React.ReactNode, span = 1) => (
    <label style={{ gridColumn: `span ${span}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>{label}</span>
      {el}
    </label>
  )

  return (
    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {field('Contact person *', <input style={inputStyle} value={form.full_name} onChange={set('full_name')} />)}
      {field('Phone *', <input style={inputStyle} value={form.phone_number} onChange={set('phone_number')} placeholder="22 123 456" inputMode="tel" dir="ltr" />)}
      {field('Street address *', <input style={inputStyle} value={form.pickup_address} onChange={set('pickup_address')} placeholder="Rue, numéro, zone industrielle…" />, 2)}
      {field('City / delegation *', <input style={inputStyle} value={form.city} onChange={set('city')} />)}
      {field('Postal code *', <input style={inputStyle} value={form.pickup_postal_code} onChange={set('pickup_postal_code')} maxLength={4} inputMode="numeric" placeholder="1000" />)}
      {field('Governorate *', (
        <select style={{ ...inputStyle, appearance: 'auto' }} value={form.wilaya} onChange={set('wilaya')}>
          <option value="" style={{ background: '#0f1623' }}>— Select —</option>
          {WILAYAS.map(w => <option key={w} value={w} style={{ background: '#0f1623' }}>{w}</option>)}
        </select>
      ))}
      {field('Notes for the courier', <input style={inputStyle} value={form.pickup_notes ?? ''} onChange={set('pickup_notes')} placeholder="Opening hours, landmark…" />)}
      {error && <p style={{ gridColumn: 'span 2', fontSize: 11, color: '#ef4444', margin: 0 }}>{error}</p>}
      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button onClick={onCancel} disabled={saving} style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? <BrandLoader variant="inline" size={11} /> : <Save size={11} />} Save pickup address
        </button>
      </div>
    </div>
  )
}

// ─── Export dropdown ──────────────────────────────────────────────────────────

export interface ExportableSubOrder {
  id: number
  shopName: string
  ready: boolean
  reason?: string
}

export function ExportMenu({ orderId, subOrders, readiness, onExported, notify }: {
  orderId: number
  subOrders: ExportableSubOrder[]
  readiness?: ExportReadiness | null
  onExported: () => void
  notify: (type: 'success' | 'error', msg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc, true) }
  }, [open])

  const run = async (key: string, fn: () => Promise<string>) => {
    setOpen(false); setBusy(key)
    try {
      const name = await fn()
      notify('success', `Downloaded ${name}`)
      onExported()
    } catch (e: any) {
      notify('error', e.message)
    } finally {
      setBusy(null)
    }
  }

  const allReady    = readiness?.ready ?? false
  const blockReason = readiness?.issues?.[0]

  const item = (key: string, icon: React.ReactNode, label: string, sub: string | null, disabled: boolean, reason: string | undefined, fn: () => Promise<string>) => (
    <button key={key} role="menuitem" disabled={disabled} title={disabled ? reason : undefined}
      onClick={() => !disabled && run(key, fn)}
      style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px',
        background: 'transparent', border: 'none', textAlign: 'left', fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, borderRadius: 8,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ marginTop: 1, color: '#94a3b8', flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{label}</span>
        {(disabled ? reason : sub) && (
          <span style={{ display: 'block', fontSize: 10, color: disabled ? '#f59e0b' : '#64748b', marginTop: 1, lineHeight: 1.4 }}>{disabled ? reason : sub}</span>
        )}
      </span>
    </button>
  )

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} disabled={!!busy} aria-haspopup="menu" aria-expanded={open}
        title={allReady ? 'Download delivery documents' : `Slips blocked: ${blockReason ?? 'missing data'}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
          background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)',
          color: '#14b8a6', fontSize: 11, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
        }}>
        {busy ? <BrandLoader variant="inline" size={13} /> : <FileDown size={13} />}
        {busy ? 'Generating…' : 'Export'}
        {!busy && <ChevronDown size={12} />}
        {!allReady && !busy && <AlertTriangle size={11} color="#f59e0b" />}
      </button>

      {open && (
        <div role="menu" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 300, zIndex: 120,
          background: '#141c2b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
          padding: 6, boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
        }}>
          <p style={{ ...sectionLabel, margin: '6px 12px 4px' }}>Delivery slips (for the courier)</p>
          {subOrders.map(so => item(
            `slip-${so.id}`, <FileText size={13} />, `Slip — ${so.shopName}`, 'One pickup, one page',
            !so.ready, so.reason,
            () => ordersApi.exportSlip(orderId, so.id),
          ))}
          {subOrders.length > 1 && item(
            'slips', <Files size={13} />, 'All slips for this order', `${subOrders.length} pages in one PDF`,
            !allReady, blockReason,
            () => ordersApi.exportSlips(orderId),
          )}
          {subOrders.length === 0 && <p style={{ fontSize: 11, color: '#64748b', margin: '4px 12px 8px' }}>No active sub-order to ship.</p>}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '6px 4px' }} />
          {item(
            'summary', <Lock size={13} />, 'Internal order summary', 'Includes commission & payouts — admin records only',
            false, undefined,
            () => ordersApi.exportSummary(orderId),
          )}
        </div>
      )}
    </div>
  )
}

export const EXPORT_TYPE_LABEL: Record<ExportHistoryEntry['type'], string> = {
  slip:    'Seller slip',
  slips:   'All slips',
  summary: 'Internal summary',
  bulk:    'Bulk slips',
}
