'use client'

// WhatsApp reminders: sellers to notify about confirmed orders, from the business WhatsApp.
// Overdue parcels first (in red: call the seller), then every notice due now with its
// one-click wa.me button. The backend decides when reminders are due (Tunis working
// hours, php artisan orders:whatsapp-reminders every 5 minutes).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, MessageCircle, Phone, RefreshCw } from 'lucide-react'
import { formatDistanceToNowStrict, format } from 'date-fns'
import { Btn, card, Notice, Stat, RED, GREEN } from '../sponsoring/_components/ui'
import { WhatsAppButton, WhatsAppOpenerToggle } from '@/components/whatsapp/SellerWhatsApp'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import { RefreshCover } from '@/components/brand/BrandLoader'
import {
  ATTEMPT_LABEL, formatPhone, REMINDERS_EVENT, whatsappRemindersApi,
  type ReminderRow, type RemindersList,
} from '@/lib/whatsappRemindersApi'

const td: React.CSSProperties = { padding: '10px 8px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, verticalAlign: 'middle' }
const th: React.CSSProperties = { padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left', whiteSpace: 'nowrap' }

const ago = (iso: string | null) => (iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: false }) : '—')
const when = (iso: string | null) => (iso ? format(new Date(iso), 'MMM d, HH:mm') : '—')

const ATTEMPT_COLOR: Record<number, string> = { 0: GREEN, 1: '#f59e0b', 2: RED }

export default function WhatsAppRemindersPage() {
  const [data, setData] = useState<RemindersList | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  usePageLoading(loading && !data)

  const load = useCallback(() => {
    setLoading(true)
    return whatsappRemindersApi.list()
      .then(setData)
      .catch(e => setMsg({ tone: 'error', text: e.message }))
      .finally(() => setLoading(false))
  }, [])

  // Reminders turn due every few minutes: keep the list fresh while the page is open
  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    window.addEventListener(REMINDERS_EVENT, load)
    return () => { clearInterval(timer); window.removeEventListener(REMINDERS_EVENT, load) }
  }, [load])

  const onSent = (_: unknown, text: string) => setMsg({ tone: 'ok', text })
  const onError = (text: string) => { setMsg({ tone: 'error', text }); load() }

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={20} color={GREEN} /> WhatsApp reminders
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Ask sellers to prepare their confirmed orders. Each button opens WhatsApp with the message ready —
            send it from the business number{data ? ` (${formatPhone(data.business_number)})` : ''}.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <WhatsAppOpenerToggle />
          <Btn onClick={load} loading={loading}><RefreshCw size={13} /> Refresh</Btn>
        </div>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {data?.warnings.map(w => <Notice key={w} tone="error">{w}</Notice>)}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Stat label="Overdue (call)" value={data?.counts.overdue ?? '—'} tone={data?.counts.overdue ? RED : undefined} />
        <Stat label="To send now" value={data?.counts.due ?? '—'} tone={data?.counts.due ? GREEN : undefined} />
      </div>

      <div style={{ position: 'relative' }}>
        <RefreshCover active={loading && !!data} />
        {/* Overdue: still not prepared after the last reminder */}
        {(data?.overdue.length ?? 0) > 0 && (
          <div style={{ ...card, borderColor: 'rgba(219,20,46,0.5)', background: 'rgba(219,20,46,0.06)', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 900, color: '#f87171', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} /> Overdue — call the seller
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              The last reminder got no reaction: the order is still not marked prepared.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead><tr>{['Seller / store', 'Order', 'Confirmed', 'Waiting for', 'Last reminder', 'Call'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data!.overdue.map(r => (
                    <tr key={r.seller_order_id}>
                      <SellerCell row={r} />
                      <OrderCell row={r} />
                      <td style={td}>{when(r.order.confirmed_at)}</td>
                      <td style={{ ...td, color: '#f87171', fontWeight: 800 }}>{ago(r.order.confirmed_at)}</td>
                      <td style={td}>{r.last_sent ? `${when(r.last_sent.sent_at)} · ${r.last_sent.sent_by ?? '—'}` : '—'}</td>
                      <td style={td}>
                        {r.seller.call_phone ? (
                          <a href={`tel:+216${r.seller.call_phone.replace(/\D/g, '').slice(-8)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f87171', fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            <Phone size={13} /> {formatPhone(`216${r.seller.call_phone.replace(/\D/g, '').slice(-8)}`)}
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Due now */}
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 10px' }}>To send now</h2>
          {data && data.due.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, padding: '18px 0', textAlign: 'center' }}>
              Nothing to send. New reminders appear here when they are due.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead><tr>{['Seller / store', 'Order', 'Confirmed', 'Since confirmation', 'Message', 'Send'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data?.due.map(r => (
                    <tr key={r.seller_order_id}>
                      <SellerCell row={r} />
                      <OrderCell row={r} />
                      <td style={td}>{when(r.order.confirmed_at)}</td>
                      <td style={td}>{ago(r.order.confirmed_at)}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', color: ATTEMPT_COLOR[r.reminder!.attempt], background: `${ATTEMPT_COLOR[r.reminder!.attempt]}1a`, border: `1px solid ${ATTEMPT_COLOR[r.reminder!.attempt]}55` }}>
                          {ATTEMPT_LABEL[r.reminder!.attempt]}
                        </span>
                      </td>
                      <td style={td}>
                        <WhatsAppButton compact sellerOrderId={r.seller_order_id} attempt={r.reminder!.attempt} url={r.reminder!.url} onSent={onSent} onError={onError} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SellerCell({ row }: { row: ReminderRow }) {
  return (
    <td style={td}>
      <p style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>{row.seller.store}</p>
      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
        {row.seller.name} · {formatPhone(row.phone)}{row.phone_source === 'phone' ? ' (phone)' : ''}
        {!row.phone && <span style={{ color: '#f59e0b', fontWeight: 700 }}> no valid number</span>}
      </p>
    </td>
  )
}

function OrderCell({ row }: { row: ReminderRow }) {
  return (
    <td style={td}>
      <Link href={`/orders?order=${row.order.id}`} style={{ fontFamily: 'monospace', fontWeight: 800, color: '#f1f5f9', textDecoration: 'none' }}>
        {row.order.order_number}
      </Link>
      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>{row.item_count} item{row.item_count === 1 ? '' : 's'}</p>
    </td>
  )
}
