'use client'

/**
 * Seller WhatsApp notices (manual): the one-click button opens the seller's chat
 * with the message pre-filled (sent from the business WhatsApp), copies the
 * message, then records it as sent.
 * Used by the order drawer (ParcelWhatsAppBlock) and the WhatsApp reminders page.
 */

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle, Clock, MessageCircle, Phone } from 'lucide-react'
import BrandLoader from '@/components/brand/BrandLoader'
import {
  ATTEMPT_LABEL, formatPhone, notifyRemindersChanged, whatsappRemindersApi,
  type ParcelWhatsApp,
} from '@/lib/whatsappRemindersApi'

export const WA_GREEN = '#198f41'
export const WA_RED = '#db142e'

const when = (iso: string | null) => (iso ? format(new Date(iso), 'MMM d, HH:mm') : '—')

/** Every notice opens in this one tab: WhatsApp Web refuses to run in two tabs at once. */
const WHATSAPP_TAB = 'choosetounsi-whatsapp'

/**
 * Where a computer opens the chat (per browser, remembered):
 *   app  the installed WhatsApp desktop app (whatsapp://send — the only link it
 *        opens on the right chat; Windows hands web.whatsapp.com links to the app
 *        without the chat)
 *   web  WhatsApp Web in one dedicated tab
 * Phones always use the wa.me link (opens the WhatsApp app).
 */
export type WhatsAppOpener = 'app' | 'web'
const OPENER_KEY = 'ct:whatsapp-opener'
const OPENER_EVENT = 'whatsapp-opener:changed'

export function getOpener(): WhatsAppOpener {
  try { return localStorage.getItem(OPENER_KEY) === 'app' ? 'app' : 'web' } catch { return 'web' }
}

export function setOpener(value: WhatsAppOpener) {
  try { localStorage.setItem(OPENER_KEY, value) } catch { /* private mode: default stays */ }
  window.dispatchEvent(new Event(OPENER_EVENT))
}

export function useOpener(): [WhatsAppOpener, (v: WhatsAppOpener) => void] {
  const [value, setValue] = useState<WhatsAppOpener>('web')
  useEffect(() => {
    const sync = () => setValue(getOpener())
    sync()
    window.addEventListener(OPENER_EVENT, sync)
    return () => window.removeEventListener(OPENER_EVENT, sync)
  }, [])
  return [value, setOpener]
}

/**
 * Opens the chat with the message pre-filled, and copies the message: if
 * WhatsApp opens without it, the admin pastes it (Ctrl+V). Returns false when
 * the clipboard copy failed.
 */
export function openWhatsApp(waMeUrl: string): Promise<boolean> {
  const match = waMeUrl.match(/^https:\/\/wa\.me\/(\d+)\?text=(.*)$/)
  const phone = match?.[1] ?? ''
  const text  = match?.[2] ?? ''

  // Copied first, while the click still counts as a user gesture
  const copied = navigator.clipboard
    ? navigator.clipboard.writeText(decodeURIComponent(text)).then(() => true, () => false)
    : Promise.resolve(false)

  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (mobile || !match) {
    window.open(waMeUrl, '_blank', 'noopener,noreferrer')
  } else if (getOpener() === 'app') {
    window.location.href = `whatsapp://send?phone=${phone}&text=${text}`
  } else {
    const tab = window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${text}`, WHATSAPP_TAB)
    if (tab) {
      tab.opener = null
      tab.focus()
    }
  }
  return copied
}

/** "Open with: WhatsApp app / WhatsApp Web" switch (computers). */
export function WhatsAppOpenerToggle() {
  const [opener, change] = useOpener()
  const option = (value: WhatsAppOpener, label: string) => (
    <button type="button" onClick={() => change(value)} aria-pressed={opener === value} style={{
      padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
      border: 'none', background: opener === value ? WA_GREEN : 'transparent', color: opener === value ? '#fff' : 'var(--text-secondary)',
    }}>{label}</button>
  )
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>Open with</span>
      <div role="group" aria-label="Open WhatsApp with" style={{ display: 'inline-flex', padding: 3, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,.03)' }}>
        {option('app', 'WhatsApp app')}
        {option('web', 'WhatsApp Web')}
      </div>
    </div>
  )
}

export function WhatsAppButton({ sellerOrderId, attempt, url, early = false, onSent, onError, compact = false }: {
  sellerOrderId: number
  attempt: number
  url: string | null
  /** Not due yet: the admin sends it ahead of time */
  early?: boolean
  onSent: (data: ParcelWhatsApp, message: string) => void
  onError: (message: string) => void
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const label = attempt === 0 ? 'Notify seller on WhatsApp' : `Send ${ATTEMPT_LABEL[attempt].toLowerCase()}${early ? ' now' : ''}`

  const send = async () => {
    if (!url || busy) return
    // Opened in the click itself (popup blockers), then recorded
    const copied = openWhatsApp(url)
    setBusy(true)
    try {
      const res = await whatsappRemindersApi.markSent(sellerOrderId, attempt)
      notifyRemindersChanged()
      onSent(res.data, (await copied)
        ? `${res.message} Message copied: if the chat opens empty, paste it (Ctrl+V).`
        : res.message)
    } catch (e: any) {
      onError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={send} disabled={!url || busy}
      title={url ? undefined : 'No WhatsApp number or valid phone for this seller'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        padding: compact ? '6px 11px' : '8px 14px', borderRadius: 9, fontSize: compact ? 11.5 : 12.5, fontWeight: 800,
        border: `1px solid ${early ? 'rgba(25,143,65,0.4)' : WA_GREEN}`,
        background: early ? 'rgba(25,143,65,0.1)' : `linear-gradient(135deg, ${WA_GREEN}, #146f33)`,
        color: early ? '#4ade80' : '#fff',
        cursor: !url || busy ? 'not-allowed' : 'pointer', opacity: !url ? 0.45 : 1, fontFamily: 'inherit',
      }}>
      {busy ? <BrandLoader variant="inline" size={12} /> : <MessageCircle size={13} />}
      {label}
    </button>
  )
}

/** The order drawer's WhatsApp block for one seller parcel. */
export function ParcelWhatsAppBlock({ sellerOrderId, whatsapp, onChanged, notify }: {
  sellerOrderId: number
  whatsapp: ParcelWhatsApp
  onChanged: (data: ParcelWhatsApp) => void
  notify: (type: 'success' | 'error', msg: string) => void
}) {
  const wa = whatsapp
  if (!wa.needs_action && !wa.prepared_at && wa.history.length === 0) return null

  const visibleHistory = wa.history.filter(h => h.status !== 'pending' || h.attempt !== wa.current?.attempt)

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(25,143,65,0.05)', border: `1px solid ${wa.overdue ? 'rgba(219,20,46,0.45)' : 'rgba(25,143,65,0.2)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4ade80' }}>
          <MessageCircle size={11} /> WhatsApp
          {wa.phone && (
            <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 700, color: '#64748b' }}>
              · {formatPhone(wa.phone)}{wa.phone_source === 'phone' ? ' (phone, no WhatsApp number set)' : ''}
            </span>
          )}
        </div>
        {wa.current && (
          <WhatsAppButton
            compact
            sellerOrderId={sellerOrderId}
            attempt={wa.current.attempt}
            url={wa.current.url}
            early={wa.current.status === 'pending'}
            onSent={(data, message) => { onChanged(data); notify('success', message) }}
            onError={msg => notify('error', msg)}
          />
        )}
      </div>

      {wa.overdue && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 0', fontSize: 11.5, fontWeight: 800, color: '#f87171' }}>
          <AlertTriangle size={12} /> Overdue: still not prepared after the last reminder. Call the seller{wa.phone ? ` (${formatPhone(wa.phone)})` : ''}.
        </p>
      )}
      {wa.prepared_at && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 0', fontSize: 11.5, fontWeight: 700, color: '#4ade80' }}>
          <CheckCircle size={12} /> Marked prepared by the seller · {when(wa.prepared_at)}
        </p>
      )}
      {wa.current?.status === 'pending' && wa.current.due_at && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 0', fontSize: 11, color: '#64748b' }}>
          <Clock size={11} /> {ATTEMPT_LABEL[wa.current.attempt]} due {when(wa.current.due_at)}
        </p>
      )}
      {wa.needs_action && !wa.phone && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 0', fontSize: 11.5, fontWeight: 700, color: '#f59e0b' }}>
          <Phone size={11} /> No WhatsApp number or valid phone on file for this seller.
        </p>
      )}

      {visibleHistory.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {visibleHistory.map(h => (
            <div key={h.attempt} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
              <span style={{ color: '#cbd5e1', fontWeight: 700 }}>{ATTEMPT_LABEL[h.attempt]}</span>
              <span style={{ color: h.status === 'sent' ? '#94a3b8' : h.status === 'due' ? '#f59e0b' : '#475569' }}>
                {h.status === 'sent' && `Sent ${when(h.sent_at)} by ${h.sent_by?.name ?? 'unknown'}`}
                {h.status === 'due' && `Due since ${when(h.due_at)}`}
                {h.status === 'pending' && `Scheduled ${when(h.due_at)}`}
                {h.status === 'cancelled' && 'Not needed (cancelled)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
