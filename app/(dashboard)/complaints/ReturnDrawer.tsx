'use client'

/**
 * Admin after-sale detail (return or exchange): the whole file (order,
 * returned lines as bought with qty / price paid / totals, replacement for an
 * exchange, reason, proof photos, both addresses, Intigo exchange parcel,
 * audit trail, finance) and the next step for its status. Uses the ct-*
 * classes injected by the complaints page.
 */

import { useState } from 'react'
import {
  CheckCircle, XCircle, X, User, Store, Package, Image as ImageIcon, CalendarDays, MessageSquare,
  FileDown, Truck, PackageCheck, Wallet, Ban, History, MapPin, AlertCircle, ShieldAlert, ArrowUpRight,
  Repeat, Copy, RotateCcw, Send,
} from 'lucide-react'
import { adminComplaintApi } from '@/lib/complaintApi'
import BrandLoader from '@/components/brand/BrandLoader'
import { GuestWhatsAppButton, guestReturnMessage } from '@/components/whatsapp/GuestWhatsApp'
import type { Complaint, ItemCondition, Payer, RefundMethod, ResolutionType } from '@/types/complaint'
import { COMPLAINT_TYPE_LABELS, REFUND_METHOD_LABELS, statusConfig } from '@/types/complaint'

const GREEN  = '#198f41'
const ORANGE = '#f97316'

const dt = (v: number | string | null | undefined) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v ?? 0)) + ' DT'
const when = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const PAYMENT_LABELS: Record<string, string> = { cod: 'Cash on delivery', card: 'Card (Stripe)', d17: 'D17', wallet: 'Wallet' }
const EVENT_LABELS: Record<string, string> = {
  seller_note: 'Seller note', delivered_to_seller: 'Courier dropped the parcel at the shop',
  finance_applied: 'Sale reversed (finance)', refund_issued: 'Refund issued', slip_exported: 'Slip exported',
  payer_overridden: 'Payer switched', exchange_booking: 'Intigo exchange booking', exchange_retry: 'Exchange retried',
  exchange_carrier_cancelled: 'Cancelled by Intigo', replacement_released: 'Replacement back in stock',
  // Returns policy v2
  payout_frozen: 'Cash refund paid at pick-up — payout frozen', inspection: 'Inspection', dispute_decided: 'Dispute decision',
  exchange_impossible: 'Shop: exchange impossible', switched_to_refund: 'Client switched to a refund', refund_amount_drift: 'Refund amount differs from the frozen figure',
}
const SYNC_LABELS: Record<string, { label: string; color: string }> = {
  sending:     { label: 'Booking…', color: '#38bdf8' },
  sent:        { label: 'Booked via the Intigo API', color: GREEN },
  manual:      { label: 'Book it by hand in Intigo', color: '#f59e0b' },
  needs_check: { label: 'Check in Intigo & paste the nid', color: '#ef4444' },
  failed:      { label: 'Refused by Intigo', color: '#ef4444' },
  cancelled:   { label: 'Cancelled by Intigo', color: '#ef4444' },
}
const PACKAGE_SIZE: Record<string, number> = { S: 1, L: 4, XL: 5 }

/** What the client pays and gets back for a payer (the drawer recomputes it live). */
function money(c: Complaint, payer: Payer | null | undefined) {
  const exchange = c.resolution_type === 'exchange'
  const fee = Number(exchange ? c.exchange_fee ?? 0 : c.return_shipping_fee ?? 0)
  const items = Number(c.items_amount ?? 0)
  const clientFee = payer === 'client' ? fee : 0
  return {
    fee, clientFee, sellerFee: payer === 'seller' ? fee : 0,
    refund: exchange ? 0 : Math.max(0, Math.round((items - clientFee) * 1000) / 1000),
    exceeds: !exchange && clientFee > items + 0.0005,
  }
}

export function ReturnStatusBadge({ status, resolution }: { status: string; resolution?: ResolutionType | null }) {
  const cfg = statusConfig(status, resolution)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, padding: '4px 10px',
      borderRadius: 100, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}28`,
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

type StepKind = 'approve' | 'reject' | 'pickup' | 'pickedup' | 'receive' | 'refund' | 'cancel'
  | 'nid' | 'delivered' | 'failed' | 'decide_retry' | 'decide_return' | 'decide_cancel' | 'inspect' | 'dispute'

const DISPUTE_OPTIONS: { value: 'charge_seller' | 'absorb' | 'contact_client' | 'send_back' | 'treat_as_conform'; label: string; hint: string }[] = [
  { value: 'charge_seller',    label: 'Charge the seller',     hint: 'The seller keeps the payout but is debited the amount below (default: what the client was refunded).' },
  { value: 'absorb',           label: 'Absorb it',             hint: 'ChooseTounsi pays: the seller keeps the payout, nothing is charged.' },
  { value: 'contact_client',   label: 'Contact the client',    hint: 'Only a note: the dispute stays open until you decide.' },
  { value: 'send_back',        label: 'Send the item back',    hint: 'Book the parcel by hand in Intigo and paste its number. It is cash on delivery: the refund already paid + the delivery fee (editable). The client sees the photos and the reason. If they refuse it, the item goes back to the seller and you decide again.' },
  { value: 'treat_as_conform', label: 'Treat as conforming',   hint: 'The photos do not convince: the item goes back to stock and the sale is reversed (the seller loses the payout).' },
]

export default function ReturnDrawer({ complaint, onClose, onRefresh }: {
  complaint: Complaint | null; onClose: () => void; onRefresh: () => void
}) {
  const [step,   setStep]   = useState<StepKind | null>(null)
  const [acting, setActing] = useState(false)
  const [toast,  setToast]  = useState('')

  if (!complaint) return null
  const c = complaint
  const cfg = statusConfig(c.status, c.resolution_type)
  const legacy = c.is_legacy_exchange ?? (c.resolution_type === 'exchange' && !c.fee_size)
  const exchange = c.resolution_type === 'exchange' && !legacy
  const items = c.complained_items ?? []
  const photos = c.image_urls?.length ? c.image_urls : (c.image_url ? [c.image_url] : [])
  const m = money(c, c.shipping_payer)
  const cash = !!c.cash_refund   // COD: the courier pays the client back in cash at pick-up
  const sync = c.exchange_sync_status === 'manual' && c.intigo_exchange_nid
    ? { label: 'Booked by hand in Intigo', color: GREEN }
    : c.exchange_sync_status ? SYNC_LABELS[c.exchange_sync_status] : null

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }
  const run = async (fn: () => Promise<any>, ok: string) => {
    setActing(true)
    try { const r = await fn(); showToast(r?.message ?? ok); onRefresh(); return true }
    catch (err: any) { showToast('Failed: ' + (err?.message ?? 'Action failed.')); return false }
    finally { setActing(false) }
  }

  const slip = () => run(() => adminComplaintApi.returnSlip(c.id, exchange).then(name => ({ message: `⬇ ${name}` })), 'Downloaded')

  // ── Next step per status ────────────────────────────────────────────────
  const next = (() => {
    const btn = (label: string, icon: React.ReactNode, cls: string, onClick: () => void) =>
      <button key={label} className={`ct-btn ${cls}`} disabled={acting} onClick={onClick} style={{ flex: 1 }}>{icon}{label}</button>
    const decide = [
      btn('Reject', <XCircle size={14} />, 'ct-btn--danger', () => setStep('reject')),
      btn(exchange ? 'Approve exchange' : 'Approve return', <CheckCircle size={14} />, 'ct-btn--success', () => setStep('approve')),
    ]
    if (legacy && ['requested', 'seller_accepted', 'seller_rejected', 'escalated', 'admin_approved', 'pickup_scheduled', 'picked_up'].includes(c.status)) {
      return { title: 'Legacy exchange', text: 'Filed as an exchange under the previous policy. Close it once handled.', color: '#94a3b8',
        actions: [btn('Close request', <CheckCircle size={14} />, 'ct-btn--success', () => run(() => adminComplaintApi.close(c.id), 'Closed'))] }
    }
    // ── Returns policy v2 (exchange-first): inspection + disputes ──
    const v2flow = !!c.v2?.inspection_flow
    if (c.dispute_status === 'open') {
      return { title: 'Non-conforming item — your decision', text: `The seller marked the returned item non conforming${c.inspection_comment ? `: “${c.inspection_comment}”` : ''}. The client was already refunded ${dt(c.refund_amount)} in cash and the payout stays frozen until you decide. Review the photos below.`, color: '#ef4444', actions: [
        btn('Decide', <ShieldAlert size={14} />, 'ct-btn--success', () => setStep('dispute'))] }
    }
    if (c.dispute_decision === 'send_back' && c.dispute_status === 'resolved' && !c.sent_back_refused_at) {
      return { title: 'Item sent back to the client', text: `Parcel ${c.sent_back_nid ?? '(number not entered)'}: the courier collects ${dt(c.sent_back_cod)} in cash (refund already paid ${dt(c.refund_amount)} + delivery ${dt(c.sent_back_fee)}). If the client refuses it, the item goes back to the seller and you decide again.`, color: '#f59e0b', actions: [
        btn('Client refused the parcel', <XCircle size={14} />, 'ct-btn--danger', () => run(() => adminComplaintApi.sentBackRefused(c.id), 'Marked as refused'))] }
    }
    if (v2flow && !exchange && c.status === 'picked_up') {
      return { title: 'On its way back — payout frozen', text: `The courier paid the client ${dt(c.refund_amount)} in cash (the figure frozen at approval). The shop clicks « Colis retour reçu » then inspects. If it does not, start the inspection yourself.${c.refund_amount_locked != null ? '' : ''}`, color: '#818cf8', actions: [
        btn('Start the inspection', <PackageCheck size={14} />, 'ct-btn--success', () => run(() => adminComplaintApi.startInspection(c.id), 'Inspection started'))] }
    }
    if (v2flow && !exchange && c.status === 'returned_to_seller' && !c.inspection_result) {
      return { title: 'Received — waiting for the shop’s inspection', text: `Due ${when(c.inspection_due_at)}. Conforme: stock +1 and the sale is reversed. Non conforme: the payout stays frozen and you decide. You can inspect on the shop’s behalf.`, color: '#2dd4bf', actions: [
        btn('Inspect on the shop’s behalf', <PackageCheck size={14} />, 'ct-btn--success', () => setStep('inspect'))] }
    }

    if (exchange) {
      const retry = () => run(() => adminComplaintApi.exchangeBook(c.id), 'Booked')
      switch (c.status) {
        case 'admin_approved':
          if (c.exchange_sync_status === 'needs_check') return { title: 'Check in Intigo & paste the tracking number', text: `Intigo did not answer clearly (${c.exchange_sync_error ?? 'no answer'}). The exchange parcel may exist: look for it in the Intigo dashboard and paste its tracking number. It is never re-sent automatically: if it does not exist, book it by hand and paste the new number.`, color: '#ef4444', actions: [
            btn('Cancel', <Ban size={14} />, 'ct-btn--ghost', () => setStep('cancel')),
            btn('Paste Intigo nid', <Send size={14} />, 'ct-btn--success', () => setStep('nid'))] }
          return { title: 'Exchange approved — book it in Intigo', text: `${c.exchange_sync_error ? `${c.exchange_sync_error.charAt(0).toUpperCase()}${c.exchange_sync_error.slice(1)}. ` : ''}Book the exchange in the Intigo dashboard with the details below (or try the API again once fixed), then paste its tracking number. The replacement stock is held.`, color: '#f59e0b', actions: [
            btn('Cancel', <Ban size={14} />, 'ct-btn--ghost', () => setStep('cancel')),
            ...(c.exchange?.can_book ? [btn('Book via Intigo API', <RotateCcw size={14} />, 'ct-btn--ghost', retry)] : []),
            btn('Paste Intigo nid', <Send size={14} />, 'ct-btn--success', () => setStep('nid'))] }
        case 'exchange_in_transit': return { title: 'Replacement on its way', text: `Intigo parcel ${c.intigo_exchange_nid ?? '—'}${c.intigo_exchange_status_label ? ` · ${c.intigo_exchange_status_label}` : ''}. The courier collects ${dt(m.clientFee)} and takes the old item back. Intigo updates this automatically; mark it by hand only if needed.${c.exchange_sync_status === 'cancelled' ? ' Intigo cancelled this parcel: mark it failed, then retry or switch to a return.' : ''}`, color: '#818cf8', actions: [
          btn('Mark failed', <XCircle size={14} />, 'ct-btn--danger', () => setStep('failed')),
          btn('Mark exchanged', <Repeat size={14} />, 'ct-btn--success', () => setStep('delivered'))] }
        case 'exchanged': return { title: c.old_item_overdue ? 'Old item not received' : 'Exchanged — waiting for the old item', text: `The client got the replacement on ${when(c.exchanged_at)}. The seller confirms the old item when it is back (or you can, below).${c.old_item_overdue ? ' More than 7 days: check with the seller and Intigo.' : ''}`, color: c.old_item_overdue ? '#ef4444' : '#2dd4bf', actions: [
          btn('Confirm old item received', <PackageCheck size={14} />, 'ct-btn--success', () => setStep(v2flow ? 'inspect' : 'receive'))] }
        case 'exchange_failed': return { title: 'Exchange failed — your decision', text: 'The client did not take the replacement; it goes back to the seller. Book a new exchange parcel, switch to a return (the pick-up follows, the return fee applies) or cancel. The replacement stock is released unless you retry.', color: '#ef4444', actions: [
          btn('Cancel', <Ban size={14} />, 'ct-btn--ghost', () => setStep('decide_cancel')),
          btn('Switch to return', <Truck size={14} />, 'ct-btn--ghost', () => setStep('decide_return')),
          btn('Retry exchange', <RotateCcw size={14} />, 'ct-btn--success', () => setStep('decide_retry'))] }
      }
    }
    switch (c.status) {
      case 'requested': return { title: 'Waiting for the seller (48h)', text: 'You may decide now without waiting for the shop.', color: '#f59e0b', actions: decide }
      case 'seller_accepted': return { title: 'Seller accepted — your validation is required', text: exchange ? 'Approve to hold the replacement and book the Intigo exchange, or reject (overrides the seller).' : 'Approve to open the pick-up, or reject (overrides the seller).', color: '#3b82f6', actions: decide }
      case 'seller_rejected': return { title: 'Seller refused — the client may escalate', text: 'You can override the refusal now or confirm it.', color: ORANGE, actions: [
        btn('Confirm refusal', <XCircle size={14} />, 'ct-btn--danger', () => setStep('reject')),
        btn('Override → approve', <CheckCircle size={14} />, 'ct-btn--success', () => setStep('approve'))] }
      case 'escalated': return { title: 'Escalated by the client — final decision', text: c.escalation_note ? `Client: “${c.escalation_note}”` : 'The client contests the shop’s refusal.', color: '#a78bfa', actions: [
        btn('Confirm refusal', <XCircle size={14} />, 'ct-btn--danger', () => setStep('reject')),
        btn('Override → approve', <CheckCircle size={14} />, 'ct-btn--success', () => setStep('approve'))] }
      case 'admin_approved': return { title: 'Approved — schedule the pick-up', text: `Download the return slip, send it to the delivery company, then mark the pick-up as scheduled (or assign a courier in the delivery app).${cash ? ` Cash on delivery: the courier pays the client back ${dt(c.refund_amount)} in cash at pick-up.` : ''}`, color: '#38bdf8', actions: [
        btn('Cancel', <Ban size={14} />, 'ct-btn--ghost', () => setStep('cancel')),
        btn('Pick-up scheduled', <Truck size={14} />, 'ct-btn--success', () => setStep('pickup'))] }
      case 'pickup_scheduled': return { title: 'Pick-up scheduled', text: cash
          ? `When the courier collected the parcel, he paid the client back ${dt(c.refund_amount)} in cash (out of the cash he holds for us). Confirm it here.`
          : 'Mark it picked up once the courier collected the parcel at the client.', color: '#818cf8', actions: [
        btn('Cancel', <Ban size={14} />, 'ct-btn--ghost', () => setStep('cancel')),
        btn(cash ? 'Picked up & client paid' : 'Mark picked up', <Truck size={14} />, 'ct-btn--success', () => setStep('pickedup'))] }
      case 'picked_up': return { title: 'On its way back to the seller', text: `${cash && c.refund_method === 'cash' ? `The client was paid back ${dt(c.refund_amount)} in cash by the courier. ` : ''}When the seller (or you) received it, confirm the condition of each item. Only resaleable items are restocked.`, color: '#818cf8', actions: [
        btn('Confirm reception', <PackageCheck size={14} />, 'ct-btn--success', () => setStep('receive'))] }
      case 'returned_to_seller': return { title: 'Received & inspected — refund due', text: `Refund ${dt(c.refund_amount)} to the client. The sale is reversed in finance at the same time.`, color: '#2dd4bf', actions: [
        btn('Issue refund', <Wallet size={14} />, 'ct-btn--success', () => setStep('refund'))] }
      default: return null
    }
  })()

  return (
    <>
      <div className="ct-backdrop" onClick={onClose} />
      <aside className="ct-drawer ct-animate-slide-in" aria-label={`Return ${c.reference ?? c.id}`}>

        {/* Header */}
        <div className="ct-drawer-header">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={chip}>{c.reference ?? `#${c.id}`}</span>
              <ReturnStatusBadge status={c.status} resolution={c.resolution_type} />
              {legacy && <span style={{ ...chip, color: ORANGE }}>Legacy exchange</span>}
              {!legacy && <span style={{ ...chip, color: exchange ? '#818cf8' : 'var(--drawer-t2)' }}>{exchange ? 'Exchange' : 'Return'}{c.fee_size ? ` · ${c.fee_size}` : ''}</span>}
              {c.return_scope && <span style={chip}>{c.return_scope === 'full' ? 'Whole order' : 'Partial'}</span>}
              {c.old_item_overdue && <span style={{ ...chip, color: '#ef4444' }}>Old item not received</span>}
              {c.fee_exceeds_refund && <span style={{ ...chip, color: '#ef4444' }}>Fee above refund</span>}
              {c.exchange_sync_status === 'needs_check' && <span style={{ ...chip, color: '#ef4444' }}>Check Intigo</span>}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--drawer-t1)', margin: 0, lineHeight: 1.3 }}>
              {COMPLAINT_TYPE_LABELS[c.complaint_type] ?? c.complaint_type}
              {c.complaint_type === 'other' && c.other_reason ? ` — ${c.other_reason}` : ''}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--drawer-t2)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CalendarDays size={11} /> Requested {when(c.created_at)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {!legacy && (
              <button className="ct-btn ct-btn--ghost" onClick={slip} disabled={acting} title={`${exchange ? 'Exchange' : 'Return'} slip PDF for the delivery company`}>
                <FileDown size={14} /> {exchange ? 'Exchange slip' : 'Return slip'}
              </button>
            )}
            <button className="ct-close-btn" onClick={onClose} aria-label="Close"><X size={14} /></button>
          </div>
        </div>

        <div className="ct-drawer-body">

          {/* Next step */}
          {next && (
            <div style={{ background: `${next.color}12`, border: `1.5px solid ${next.color}55`, borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: next.color, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={15} /> {next.title}
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--drawer-t1)', margin: '0 0 14px', lineHeight: 1.6 }}>{next.text}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{next.actions}</div>
            </div>
          )}

          {/* Intigo exchange parcel: details to book it by hand, or its state */}
          {exchange && ['admin_approved', 'exchange_in_transit', 'exchanged', 'exchange_failed', 'exchange_completed'].includes(c.status) && (
            <ExchangeBox c={c} sync={sync} />
          )}

          {/* Order & money */}
          <div>
            <p className="ct-section-title"><Package size={12} /> Original order</p>
            <div className="ct-info-card">
              <KV k="Order" v={<span style={{ fontFamily: 'monospace', fontWeight: 800 }}>#{c.order?.order_number ?? c.order_id}</span>} />
              <KV k="Ordered" v={when(c.order?.created_at)} />
              <KV k="Order status" v={c.order?.status ?? '—'} />
              <KV k="Payment" v={`${PAYMENT_LABELS[c.order?.payment_method ?? 'cod'] ?? c.order?.payment_method} · ${c.order?.payment_status ?? ''}`} />
              {c.refund_task && <KV k="Delivery app task" v={`#${c.refund_task.id} · ${c.refund_task.status}${c.refund_task.delivery_guy ? ` · ${c.refund_task.delivery_guy.name}` : ''}`} />}
            </div>
          </div>

          {/* Returned items */}
          <div>
            <p className="ct-section-title"><Package size={12} /> {exchange ? 'Items to exchange' : 'Returned items'}</p>
            <div className="ct-info-card" style={{ padding: 0, overflow: 'hidden' }}>
              {items.map(item => {
                const hex = item.variant_attributes?.find(a => a.color_hex)?.color_hex
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--drawer-card-bd)' }}>
                    {item.image_url
                      // eslint-disable-next-line @next/next/no-img-element -- order snapshot image
                      ? <img src={item.image_url} alt={item.product_name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--drawer-card-bd)' }} />
                      : <div aria-hidden style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, border: '1px solid var(--drawer-card-bd)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--drawer-t1)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--drawer-t2)', fontWeight: 600 }}>
                        {hex && <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: hex, border: '1px solid rgba(255,255,255,.25)' }} />}
                        {item.variant_label ?? 'No variant'} · {item.return_quantity} of {item.quantity} × {dt(item.return_unit_price)}
                      </span>
                      {exchange && item.replacement_label && (
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 800, marginTop: 3, color: '#818cf8' }}>
                          → {item.replacement_label}{item.replacement_reserved ? ' · stock held' : ''}
                        </span>
                      )}
                      {item.condition && (
                        <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, marginTop: 3, color: item.condition === 'resaleable' ? GREEN : '#ef4444' }}>
                          {item.condition === 'resaleable' ? `Resaleable · ${item.restocked_quantity} restocked` : 'Damaged · not restocked'}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--drawer-t1)', whiteSpace: 'nowrap' }}>{dt(item.return_amount)}</span>
                  </div>
                )
              })}
              <div style={{ padding: '10px 12px' }}>
                <KV k="Items (price paid)" v={dt(c.items_amount)} />
                {exchange ? (
                  <>
                    <KV k={`Exchange fee${c.fee_size ? ` (${c.fee_size})` : ''}`} v={`${dt(m.fee)} · paid by ${c.shipping_payer === 'seller' ? 'the seller (adjustment)' : 'the client (cash to the courier)'}`} />
                    <KV k="Courier collects" v={<b style={{ color: '#818cf8' }}>{dt(m.clientFee)}</b>} />
                  </>
                ) : (
                  <>
                    <KV k={`Return fee${c.fee_size ? ` (${c.fee_size})` : ''}`} v={`${dt(m.fee)} · paid by ${c.shipping_payer === 'seller' ? 'the seller (adjustment)' : 'the client (deducted)'}`} />
                    <KV k={c.status === 'refunded' ? 'Refunded' : 'Refund due'} v={<b style={{ color: GREEN }}>{dt(c.refund_amount)}</b>} />
                    {c.fee_exceeds_refund && <p style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 700, margin: '4px 0' }}>The return fee is above what the items are worth: the client gets 0.</p>}
                    {c.refund_method && <KV k="Method" v={REFUND_METHOD_LABELS[c.refund_method]} />}
                    {c.refund_reference && <KV k="Reference" v={<span style={{ fontFamily: 'monospace' }}>{c.refund_reference}</span>} />}
                    <IntigoReturnRef id={c.id} value={c.intigo_return_ref ?? null} onSaved={onRefresh} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Returns policy v2: frozen refund, payout hold, inspection and dispute */}
          {c.policy_version === 2 && (
            <div className="ct-info-card">
              <p className="ct-info-card-label"><ShieldAlert size={13} /> Exchange-first policy</p>
              {c.refund_amount_locked != null && <KV k="Refund frozen at approval" v={<b style={{ color: GREEN }}>{dt(c.refund_amount_locked)}</b>} />}
              <KV k="Seller payout" v={c.payout_frozen_at && !c.payout_released_at
                ? <b style={{ color: '#f59e0b' }}>En attente de retour (frozen since {when(c.payout_frozen_at)})</b>
                : c.payout_released_at ? `Released ${when(c.payout_released_at)}` : '—'} />
              {c.exchange_impossible_at && <KV k="Exchange impossible" v={`${when(c.exchange_impossible_at)}${c.exchange_impossible_reason ? ` · ${c.exchange_impossible_reason}` : ''}`} />}
              {c.inspection_result && (
                <KV k="Inspection" v={<b style={{ color: c.inspection_result === 'conform' ? GREEN : '#ef4444' }}>
                  {c.inspection_result === 'conform' ? 'Conforme' : 'Non conforme'} · {when(c.inspection_at)}</b>} />
              )}
              {c.inspection_comment && <KV k="Shop comment" v={c.inspection_comment} />}
              {!!c.v2?.inspection_photos?.length && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0' }}>
                  {c.v2.inspection_photos.map(url => (
                    <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Inspection" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--drawer-bd)' }} /></a>
                  ))}
                </div>
              )}
              {c.dispute_decision && (
                <KV k="Dispute" v={<b>{DISPUTE_OPTIONS.find(o => o.value === c.dispute_decision)?.label ?? c.dispute_decision}
                  {c.dispute_amount != null && Number(c.dispute_amount) > 0 ? ` · ${dt(c.dispute_amount)}` : ''}
                  {c.dispute_status === 'open' ? ' (still open)' : ''}</b>} />
              )}
              {c.dispute_note && <KV k="Decision note" v={c.dispute_note} />}
              {c.dispute_decision === 'send_back' && <KV k="Sent back" v={`${c.sent_back_nid ?? '—'} · COD ${dt(c.sent_back_cod)} (refund paid + ${dt(c.sent_back_fee)} delivery)${c.sent_back_refused_at ? ' · REFUSED by the client ' + when(c.sent_back_refused_at) : ''}`} />}
            </div>
          )}

          {/* Addresses: pickup = client, destination = seller */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="ct-info-card">
              <p className="ct-info-card-label"><User size={13} /> {exchange ? 'Client — delivery & old item' : 'Pickup — client'}</p>
              <AddressLines lines={[c.client_address?.name, c.client_address?.phone, c.client_address?.address, c.client_address?.delegation,
                [c.client_address?.postal_code, c.client_address?.wilaya].filter(Boolean).join(' ')]} />
              {c.buyer?.is_guest ? (
                <>
                  <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 800, margin: '6px 0 8px' }}>
                    GUEST · {[c.buyer.name, c.buyer.phone, c.buyer.email].filter(Boolean).join(' · ')}
                  </p>
                  {/* No account (often no e-mail): tell them the new status on WhatsApp, by hand */}
                  <GuestWhatsAppButton
                    phone={c.buyer.phone}
                    label="Send status on WhatsApp"
                    message={guestReturnMessage({
                      orderNumber: c.order?.order_number ?? String(c.order_id),
                      reference: c.reference, status: c.status, exchange, name: c.buyer.name,
                    })}
                  />
                </>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--drawer-t2)', margin: '6px 0 0' }}>{c.user?.email}</p>
              )}
            </div>
            <div className="ct-info-card">
              <p className="ct-info-card-label"><Store size={13} /> {exchange ? 'Seller — replacement pickup & old item back' : 'Destination — seller'}</p>
              <AddressLines lines={[c.seller_pickup?.shop_name, c.seller_pickup?.phone, c.seller_pickup?.address, c.seller_pickup?.city,
                [c.seller_pickup?.postal_code, c.seller_pickup?.wilaya].filter(Boolean).join(' ')]} />
              {c.seller_pickup && !c.seller_pickup.complete && (
                <p style={{ fontSize: 11, color: ORANGE, margin: '6px 0 0', display: 'flex', gap: 4 }}><AlertCircle size={11} /> Missing: {c.seller_pickup.missing.join(', ')}</p>
              )}
            </div>
          </div>

          {/* Reason */}
          <div>
            <p className="ct-section-title"><MessageSquare size={12} /> Client&apos;s description</p>
            <div style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`, borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${cfg.color}` }}>
              <p style={{ fontSize: 13, color: 'var(--drawer-t1)', margin: 0, lineHeight: 1.75, fontWeight: 500 }}>{c.description}</p>
            </div>
          </div>

          {/* Proof photos */}
          {photos.length > 0 && (
            <div>
              <p className="ct-section-title"><ImageIcon size={12} /> Proof photos ({photos.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                {photos.map(url => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" style={{ position: 'relative', display: 'block', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--drawer-card-bd)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Proof" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                    <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.6)', borderRadius: 6, padding: '2px 6px', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <ArrowUpRight size={10} /> View
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Seller answer */}
          {(c.seller_note || c.rejection_reason) && (
            <div>
              <p className="ct-section-title"><Store size={12} /> Seller answer
                {c.seller_decision && <span style={{ marginLeft: 6, color: c.seller_decision === 'approved' ? GREEN : ORANGE }}>· {c.seller_decision === 'approved' ? 'Accepted' : 'Refused'}</span>}
              </p>
              <div style={{ background: 'rgba(99,130,246,.1)', border: '1px solid rgba(99,130,246,.2)', borderRadius: 12, padding: '14px 16px' }}>
                {c.seller_note && <p style={{ fontSize: 13, color: 'var(--drawer-t1)', margin: 0, lineHeight: 1.7 }}>{c.seller_note}</p>}
                {c.rejection_reason && (
                  <p style={{ fontSize: 13, color: 'var(--drawer-t1)', margin: c.seller_note ? '10px 0 0' : 0 }}>
                    <b style={{ color: ORANGE }}>Reason:</b> {c.rejection_reason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Finance adjustments */}
          {!!c.adjustments?.length && (
            <div>
              <p className="ct-section-title"><Wallet size={12} /> Seller adjustments</p>
              <div className="ct-info-card">
                {c.adjustments.map(a => (
                  <KV key={a.id} k={a.description} v={
                    <span style={{ color: Number(a.amount) < 0 ? '#ef4444' : GREEN, fontWeight: 800 }}>
                      {dt(a.amount)} · {a.applied_at ? 'settled' : a.settlement_batch_id ? `batch #${a.settlement_batch_id}` : 'next settlement'}
                    </span>
                  } />
                ))}
              </div>
            </div>
          )}

          {/* What Intigo bills vs what was recovered */}
          {!!c.costs?.length && (
            <div>
              <p className="ct-section-title"><Wallet size={12} /> After-sale cost &amp; recovery</p>
              <div className="ct-info-card">
                {c.costs.map(k => (
                  <KV key={k.id} k={`${k.kind === 'return' ? 'Return parcel' : k.kind === 'exchange' ? 'Exchange parcel' : 'Exchange refused'}${k.size ? ` (${k.size})` : ''}`} v={
                    <span>
                      Intigo {dt(k.intigo_cost)} · client {dt(k.recovered_client)} · seller {dt(k.recovered_seller)} ·{' '}
                      <b style={{ color: k.margin < 0 ? '#ef4444' : GREEN }}>{dt(k.margin)}</b>
                    </span>
                  } />
                ))}
              </div>
            </div>
          )}

          {/* Audit trail */}
          {!!c.events?.length && (
            <div>
              <p className="ct-section-title"><History size={12} /> Timeline &amp; audit</p>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.events.map(e => (
                  <li key={e.id} style={{ display: 'flex', gap: 10 }}>
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: statusConfig(e.status, c.resolution_type).color }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--drawer-t1)' }}>
                        {EVENT_LABELS[e.status] ?? statusConfig(e.status, c.resolution_type).label}
                        <span style={{ fontWeight: 600, color: 'var(--drawer-t2)' }}> · {e.actor?.name ?? e.actor_role ?? 'system'} · {when(e.created_at)}</span>
                      </p>
                      {e.note && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--drawer-t2)', lineHeight: 1.5 }}>{e.note}</p>}
                      {e.status === 'payer_overridden' && e.meta && (
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--drawer-t2)' }}>
                          {String(e.meta.from)} → {String(e.meta.to)} · fee {dt(e.meta.fee as number)}
                        </p>
                      )}
                      {['exchange_in_transit', 'exchange_booking'].includes(e.status) && e.meta && (
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--drawer-t2)', fontFamily: 'monospace' }}>
                          {String(e.meta.nid ?? e.meta.result ?? '')} {e.meta.source ? `· ${String(e.meta.source)}` : ''} {e.meta.reason || e.meta.error ? `· ${String(e.meta.reason ?? e.meta.error)}` : ''}
                        </p>
                      )}
                      {e.status === 'refund_issued' && e.meta && (
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--drawer-t2)' }}>
                          {dt(e.meta.amount as number)} · {REFUND_METHOD_LABELS[e.meta.method as RefundMethod] ?? String(e.meta.method)} · {String(e.meta.reference ?? '')}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </aside>

      {step && (
        <StepModal kind={step} complaint={c} onClose={() => setStep(null)}
          onDone={msg => { setStep(null); showToast(msg); onRefresh() }} />
      )}

      {toast && <div className="ct-toast">{toast}</div>}
    </>
  )
}

const chip: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--drawer-t2)', background: 'rgba(255,255,255,.06)',
  padding: '3px 10px', borderRadius: 6, border: '1px solid var(--drawer-card-bd)',
}

/**
 * The Intigo exchange parcel: its state, and everything needed to book it by
 * hand in the Intigo dashboard (same as the manual return flow).
 */
function ExchangeBox({ c, sync }: { c: Complaint; sync: { label: string; color: string } | null }) {
  const [copied, setCopied] = useState(false)
  const x = c.exchange
  const items = (c.complained_items ?? [])
    .map(i => `${i.return_quantity} × ${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''} → ${i.replacement_label ?? i.product_name}`)
  const cod = x?.cod ?? 0
  const details = [
    `Exchange ${c.reference} — order #${c.order?.order_number ?? c.order_id}`,
    `Original Intigo parcel (delivered): ${x?.original_nid ?? '— not shipped through Intigo: create a normal parcel'}`,
    `Pickup (replacement): ${[c.seller_pickup?.shop_name, c.seller_pickup?.phone, c.seller_pickup?.address, c.seller_pickup?.city, c.seller_pickup?.wilaya].filter(Boolean).join(', ')}`,
    `Delivery: ${[c.client_address?.name, c.client_address?.phone, c.client_address?.address, c.client_address?.delegation, c.client_address?.wilaya].filter(Boolean).join(', ')}`,
    `Collect from the client: ${cod.toFixed(3)} DT${cod === 0 ? ' (nothing to collect)' : ''}`,
    `Package size: ${c.fee_size ?? 'S'} (${PACKAGE_SIZE[c.fee_size ?? 'S'] ?? 1})`,
    `Description: ${items.join(', ')}`,
    'Take the old item back to the seller.',
  ].join('\n')

  const copy = async () => {
    try { await navigator.clipboard.writeText(details); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }

  return (
    <div>
      <p className="ct-section-title"><Repeat size={12} /> Intigo exchange parcel</p>
      <div className="ct-info-card">
        <KV k="Tracking (nid)" v={<span style={{ fontFamily: 'monospace' }}>{c.intigo_exchange_nid ?? '—'}</span>} />
        {sync && <KV k="Booking" v={<span style={{ color: sync.color }}>{sync.label}</span>} />}
        {c.intigo_exchange_status_label && <KV k="Intigo status" v={`${c.intigo_exchange_status_label}${c.intigo_exchange_status_code ? ` (${c.intigo_exchange_status_code})` : ''}`} />}
        {c.exchange_sync_error && <p style={{ fontSize: 11.5, color: '#f59e0b', margin: '4px 0', lineHeight: 1.5 }}>{c.exchange_sync_error}</p>}
        {!!x?.problems.length && c.status === 'admin_approved' && !c.exchange_sync_error && (
          <p style={{ fontSize: 11.5, color: '#f59e0b', margin: '4px 0', lineHeight: 1.5 }}>Can&apos;t use the API: {x.problems.join('; ')}.</p>
        )}
        <KV k="Courier collects" v={<b>{dt(cod)}</b>} />
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 12, fontWeight: 800, cursor: 'pointer', color: 'var(--drawer-t1)' }}>Details to book it in the Intigo dashboard</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11.5, lineHeight: 1.6, margin: '8px 0', color: 'var(--drawer-t1)', fontFamily: 'inherit' }}>{details}</pre>
          <button type="button" className="ct-btn ct-btn--ghost" onClick={copy}><Copy size={13} /> {copied ? 'Copied' : 'Copy details'}</button>
        </details>
      </div>
    </div>
  )
}

/** Returns stay manual in the Intigo dashboard: paste its return reference here. */
function IntigoReturnRef({ id, value, onSaved }: { id: number; value: string | null; onSaved: () => void }) {
  const [ref, setRef] = useState(value ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const save = async () => {
    setState('saving')
    try { await adminComplaintApi.intigoReturnRef(id, ref.trim() || null); setState('saved'); onSaved() } catch { setState('error') }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11.5, color: 'var(--drawer-t2, #94a3b8)', fontWeight: 700 }}>Intigo return ref.</span>
      <input value={ref} onChange={e => { setRef(e.target.value); setState('idle') }} maxLength={64} placeholder="from the Intigo dashboard"
        style={{ flex: '1 1 140px', minWidth: 0, fontSize: 12, padding: '4px 8px', borderRadius: 7, border: '1px solid rgba(148,163,184,0.35)', background: 'transparent', color: 'inherit', fontFamily: 'monospace' }} />
      <button type="button" onClick={save} disabled={state === 'saving' || ref.trim() === (value ?? '')}
        style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(25,143,65,0.4)', background: 'rgba(25,143,65,0.12)', color: '#22b356', cursor: 'pointer' }}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
      </button>
      {state === 'error' && <span style={{ fontSize: 11, color: '#ef4444' }}>Could not save.</span>}
    </div>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: 'var(--drawer-t2)', fontWeight: 600 }}>{k}</span>
      <span style={{ color: 'var(--drawer-t1)', fontWeight: 700, textAlign: 'right' }}>{v}</span>
    </div>
  )
}

function AddressLines({ lines }: { lines: (string | null | undefined)[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {lines.filter(Boolean).map((l, i) => (
        <span key={i} style={{ fontSize: i === 0 ? 13 : 12, fontWeight: i === 0 ? 800 : 500, color: 'var(--drawer-t1)', display: 'flex', gap: 4 }}>
          {i === 2 && <MapPin size={11} style={{ marginTop: 2, flexShrink: 0 }} />}{l}
        </span>
      ))}
    </div>
  )
}

// ── Step modal ────────────────────────────────────────────────────────────────

function StepModal({ kind, complaint: c, onClose, onDone }: {
  kind: StepKind; complaint: Complaint; onClose: () => void; onDone: (msg: string) => void
}) {
  const methods = c.refund_methods ?? ['wallet']
  const exchange = c.resolution_type === 'exchange'
  const [text,       setText]       = useState('')
  const [payer,      setPayer]      = useState<Payer>(c.shipping_payer ?? 'seller')
  const [nid,        setNid]        = useState(c.intigo_exchange_nid ?? '')
  const live = money(c, payer)
  const defaultPayer = c.fees?.default_payer ?? c.shipping_payer
  const [carrier,    setCarrier]    = useState('')
  const [date,       setDate]       = useState('')
  const [tracking,   setTracking]   = useState('')
  const [method,     setMethod]     = useState<RefundMethod>(methods[0])
  const [reference,  setReference]  = useState('')
  const [conditions, setConditions] = useState<Record<number, ItemCondition>>({})
  const [result,     setResult]     = useState<'conform' | 'nonconform' | ''>('')
  const [photos,     setPhotos]     = useState<File[]>([])
  const [decision,   setDecision]   = useState<typeof DISPUTE_OPTIONS[number]['value']>('absorb')
  const [amount,     setAmount]     = useState(String(Number(c.refund_amount ?? 0)))
  const sbs = c.v2?.send_back_suggested
  const [cod,        setCod]        = useState(String(Number(sbs?.cod ?? (Number(c.refund_amount ?? 0) + Number(c.return_shipping_fee ?? 0)))))
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const kindWord = exchange ? 'exchange' : 'return'
  const TITLES: Record<StepKind, string> = {
    approve: `Approve the ${kindWord}`, reject: `Reject the ${kindWord}`, pickup: 'Pick-up scheduled',
    pickedup: c.cash_refund ? 'Picked up — courier paid the client in cash' : 'Picked up',
    receive: exchange ? 'Old item received — condition' : 'Confirm reception & condition', refund: 'Issue the refund', cancel: `Cancel the ${kindWord}`,
    nid: 'Intigo exchange parcel — tracking number', delivered: 'Mark exchanged (replacement delivered)', failed: 'Mark the exchange as failed',
    decide_retry: 'Retry the exchange (new Intigo parcel)', decide_return: 'Switch to a return', decide_cancel: 'Cancel the exchange',
    inspect: 'Inspection (on the shop’s behalf)', dispute: 'Non-conforming item — decision',
  }

  const submit = async () => {
    setError('')
    try {
      setSaving(true)
      let res: { message?: string } | undefined
      switch (kind) {
        case 'approve': res = await adminComplaintApi.approve(c.id, text || undefined, payer); break
        case 'reject':
          if (text.trim().length < 10) throw new Error('Give the client a reason (at least 10 characters).')
          res = await adminComplaintApi.reject(c.id, text.trim()); break
        case 'pickedup': res = await adminComplaintApi.pickedUp(c.id, carrier || undefined, text || undefined); break
        case 'pickup': res = await adminComplaintApi.schedulePickup(c.id, { carrier: carrier || undefined, date: date || undefined, tracking: tracking || undefined, note: text || undefined }); break
        case 'receive':
          if ((c.complained_items ?? []).some(i => !conditions[i.id])) throw new Error('Choose the condition of every item.')
          res = await adminComplaintApi.receive(c.id, conditions, text || undefined); break
        case 'refund':
          if (method === 'cash') throw new Error('Cash on delivery returns are paid back by the courier at pick-up.')
          if (['bank_transfer', 'd17'].includes(method) && !reference.trim()) throw new Error('Enter the transfer / D17 reference.')
          res = await adminComplaintApi.refund(c.id, method, reference.trim() || undefined, text || undefined); break
        case 'cancel':
          if (text.trim().length < 5) throw new Error('Give a reason.')
          res = await adminComplaintApi.cancel(c.id, text.trim()); break
        case 'nid':
          if (!nid.trim()) throw new Error('Paste the tracking number from the Intigo dashboard.')
          res = await adminComplaintApi.exchangeNid(c.id, nid.trim()); break
        case 'delivered': res = await adminComplaintApi.exchangeDelivered(c.id, text || undefined); break
        case 'failed': res = await adminComplaintApi.exchangeFailed(c.id, text || undefined); break
        case 'decide_retry': res = await adminComplaintApi.exchangeDecide(c.id, 'retry', text || undefined); break
        case 'decide_return': res = await adminComplaintApi.exchangeDecide(c.id, 'return', text || undefined); break
        case 'decide_cancel': res = await adminComplaintApi.exchangeDecide(c.id, 'cancel', text || undefined); break
        case 'inspect':
          if (!result) throw new Error('Choose Conforme or Non conforme.')
          if (result === 'nonconform' && (!text.trim() || photos.length < 1)) throw new Error('Non conforme needs a comment and at least one photo.')
          res = await adminComplaintApi.inspect(c.id, result, text.trim() || undefined, photos); break
        case 'dispute': {
          const amt = Number(amount)
          if (decision === 'charge_seller' && !(amt > 0)) throw new Error('Enter the amount to charge the seller.')
          if (decision === 'send_back' && !(Number(cod) >= 0)) throw new Error('Enter the cash-on-delivery amount of the parcel.')
          res = await adminComplaintApi.dispute(c.id, {
            decision, note: text.trim() || undefined,
            amount: decision === 'charge_seller' ? amt : undefined,
            nid: decision === 'send_back' ? (nid.trim() || undefined) : undefined,
            cod_amount: decision === 'send_back' ? Number(cod) : undefined,
          }); break
        }
      }
      onDone(res?.message ?? 'Done')
    } catch (err: any) {
      setError(err?.message ?? 'Action failed.')
    } finally { setSaving(false) }
  }

  const choice = (active: boolean, color: string): React.CSSProperties => ({
    flex: 1, padding: '8px 10px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
    border: `1.5px solid ${active ? color : 'var(--bd)'}`, background: active ? `${color}22` : 'transparent', color: active ? color : 'var(--t2)',
  })

  return (
    <>
      <div className="ct-backdrop" style={{ zIndex: 10000 }} onClick={onClose} />
      <div className="ct-modal" role="dialog" aria-modal="true" aria-label={TITLES[kind]} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--t1)', margin: '0 0 4px' }}>{TITLES[kind]}</h3>
        <p style={{ fontSize: 12, color: 'var(--t2)', margin: '0 0 16px' }}>{c.reference} · order #{c.order?.order_number}</p>

        {kind === 'approve' && (
          <>
            <label className="ct-label">{exchange ? 'Exchange' : 'Return'} fee ({dt(live.fee)}{c.fee_size ? ` · size ${c.fee_size}` : ''}) paid by</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <button type="button" style={choice(payer === 'seller', GREEN)} onClick={() => setPayer('seller')}>Seller (at fault)</button>
              <button type="button" style={choice(payer === 'client', ORANGE)} onClick={() => setPayer('client')}>Client (own choice)</button>
            </div>
            <div style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: '8px 10px', margin: '6px 0 6px', fontSize: 12.5, color: 'var(--t1)' }}>
              {exchange ? (
                <>Client pays the courier <b style={{ color: ORANGE }}>{dt(live.clientFee)}</b>{live.sellerFee > 0 && <> · seller is debited <b>{dt(live.sellerFee)}</b></>}</>
              ) : (
                <>Client refund <b style={{ color: GREEN }}>{dt(live.refund)}</b> (items {dt(c.items_amount)}{live.clientFee > 0 ? ` − fee ${dt(live.clientFee)}` : ''}){live.sellerFee > 0 && <> · seller is debited <b>{dt(live.sellerFee)}</b></>}</>
              )}
            </div>
            {live.exceeds && <p style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 700, margin: '0 0 6px' }}>The fee is above the items&apos; value: the client gets 0.</p>}
            <p style={{ fontSize: 11, color: 'var(--t3)', margin: '0 0 12px' }}>
              {payer === 'seller' ? 'Charged to the seller as an adjustment on their next settlement.' : exchange ? 'Collected in cash by the courier with the replacement.' : 'Deducted from the client’s refund.'}
              {defaultPayer && payer !== defaultPayer && ' Changed from the reason’s default: logged in the history.'}
              {exchange && ' The replacement stock is held and the Intigo exchange parcel is booked on approval.'}
            </p>
          </>
        )}

        {kind === 'nid' && (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--t1)', margin: '0 0 10px', lineHeight: 1.6 }}>
              {c.exchange_sync_status === 'needs_check'
                ? 'Find the exchange parcel in the Intigo dashboard (it may have been created despite the error). If it is not there, book it by hand. Then paste its tracking number.'
                : 'Book the exchange in the Intigo dashboard with the details shown in the drawer, then paste its tracking number.'}
              {' '}The courier collects <b>{dt(live.clientFee)}</b>.
            </p>
            <label className="ct-label">Intigo tracking number (nid)</label>
            <input className="ct-input" value={nid} onChange={e => { setNid(e.target.value); setError('') }} maxLength={32} style={{ marginBottom: 12, fontFamily: 'monospace' }} />
          </>
        )}

        {kind === 'decide_return' && (
          <p style={{ fontSize: 12.5, color: 'var(--t1)', margin: '0 0 12px', lineHeight: 1.6 }}>
            The replacement goes back to stock, the case becomes a return (pick-up at the client), and the return fee applies:
            refund {dt(Math.max(0, Number(c.items_amount ?? 0) - (payer === 'client' ? Number(c.return_shipping_fee ?? 0) : 0)))}.
          </p>
        )}

        {kind === 'pickup' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><label className="ct-label">Delivery company</label><input className="ct-input" value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. Aramex" /></div>
            <div><label className="ct-label">Pick-up date</label><input className="ct-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label className="ct-label">Tracking / reference</label><input className="ct-input" value={tracking} onChange={e => setTracking(e.target.value)} /></div>
          </div>
        )}

        {kind === 'pickedup' && (
          <>
            {c.cash_refund && (
              <p style={{ fontSize: 13, color: 'var(--t1)', margin: '0 0 12px', lineHeight: 1.6 }}>
                Confirm the courier checked the item against the photos and handed the client <b style={{ color: GREEN }}>{dt(c.refund_amount)}</b> in cash.
                {c.policy_version === 2
                  ? ' The seller payout of this parcel is frozen (excluded from every settlement) until the shop inspects the item.'
                  : ' The sale is reversed in finance now; the shop still inspects the item at reception.'}
              </p>
            )}
            <label className="ct-label">Courier</label>
            <input className="ct-input" value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="Courier name / company" style={{ marginBottom: 12 }} />
          </>
        )}

        {kind === 'inspect' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button type="button" style={choice(result === 'conform', GREEN)} onClick={() => setResult('conform')}>Conforme → stock +1, sale reversed</button>
              <button type="button" style={choice(result === 'nonconform', '#ef4444')} onClick={() => setResult('nonconform')}>Non conforme → dispute</button>
            </div>
            {result === 'nonconform' && (
              <>
                <label className="ct-label">Photos (at least one)</label>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ marginBottom: 10, color: 'var(--t1)' }}
                  onChange={e => setPhotos(Array.from(e.target.files ?? []).slice(0, 5))} />
                <p style={{ fontSize: 11.5, color: 'var(--t3)', margin: '0 0 8px' }}>{photos.length} selected · the note below is the comment (required).</p>
              </>
            )}
          </>
        )}

        {kind === 'dispute' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {DISPUTE_OPTIONS.filter(o => !(exchange && o.value === 'send_back')).map(o => (
                <button key={o.value} type="button" style={{ ...choice(decision === o.value, o.value === 'treat_as_conform' ? GREEN : ORANGE), flex: 'none', textAlign: 'start' }} onClick={() => setDecision(o.value)}>
                  {o.label}<span style={{ display: 'block', fontWeight: 500, fontSize: 11, marginTop: 2, color: 'var(--t2)' }}>{o.hint}</span>
                </button>
              ))}
            </div>
            {decision === 'charge_seller' && (
              <>
                <label className="ct-label">Amount charged to the seller (DT)</label>
                <input className="ct-input" type="number" step="0.001" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={{ marginBottom: 10 }} />
              </>
            )}
            {decision === 'send_back' && (
              <>
                <label className="ct-label">Intigo tracking number of the parcel back to the client</label>
                <input className="ct-input" value={nid} onChange={e => setNid(e.target.value)} maxLength={60} style={{ marginBottom: 6, fontFamily: 'monospace' }} />
                <div style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: '8px 10px', margin: '0 0 8px', fontSize: 12.5, color: 'var(--t1)' }}>
                  Refund already paid to the client <b>{dt(sbs?.refund ?? c.refund_amount)}</b> + delivery <b>{dt(sbs?.fee ?? c.return_shipping_fee)}</b> = suggested COD <b style={{ color: ORANGE }}>{dt(sbs?.cod ?? (Number(c.refund_amount ?? 0) + Number(c.return_shipping_fee ?? 0)))}</b>
                </div>
                <label className="ct-label">Cash on delivery of this parcel (DT, editable)</label>
                <input className="ct-input" type="number" step="0.001" min="0" value={cod} onChange={e => setCod(e.target.value)} style={{ marginBottom: 6 }} />
                <p style={{ fontSize: 11.5, color: 'var(--t3)', margin: '0 0 10px' }}>Use this amount when you book the parcel in Intigo. If the client refuses it, mark it from the return file: the item goes back to the seller and you decide again.</p>
              </>
            )}
          </>
        )}

        {kind === 'receive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {(c.complained_items ?? []).map(i => (
              <div key={i.id} style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 10 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>
                  {i.product_name}{i.variant_label ? ` — ${i.variant_label}` : ''} × {i.return_quantity}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={choice(conditions[i.id] === 'resaleable', GREEN)} onClick={() => setConditions(s => ({ ...s, [i.id]: 'resaleable' }))}>Resaleable → restock</button>
                  <button type="button" style={choice(conditions[i.id] === 'damaged', '#ef4444')} onClick={() => setConditions(s => ({ ...s, [i.id]: 'damaged' }))}>Damaged</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {kind === 'refund' && (
          <>
            <p style={{ fontSize: 22, fontWeight: 900, color: GREEN, margin: '0 0 12px' }}>{dt(c.refund_amount)}</p>
            <label className="ct-label">Refund method</label>
            <select className="ct-select" value={method} onChange={e => setMethod(e.target.value as RefundMethod)} style={{ marginBottom: 10 }}>
              {methods.map(m => <option key={m} value={m}>{REFUND_METHOD_LABELS[m]}</option>)}
            </select>
            {method !== 'wallet' && (
              <>
                <label className="ct-label">Reference {method === 'original' ? '(empty = refund through Stripe now)' : '(required)'}</label>
                <input className="ct-input" value={reference} onChange={e => setReference(e.target.value)} placeholder={method === 'd17' ? 'D17 transaction id' : method === 'bank_transfer' ? 'Transfer reference' : 're_…'} style={{ marginBottom: 10 }} />
              </>
            )}
            {method === 'wallet' && <p style={{ fontSize: 11.5, color: 'var(--t3)', margin: '0 0 10px' }}>Credited to the client’s ChooseTounsi wallet instantly.</p>}
          </>
        )}

        <label className="ct-label">{kind === 'reject' ? 'Reason (sent to the client)' : kind === 'cancel' ? 'Reason' : 'Internal note (optional)'}</label>
        <textarea className="ct-input" rows={3} value={text} onChange={e => { setText(e.target.value); setError('') }}
          style={{ resize: 'vertical', lineHeight: 1.6 }} />

        {error && <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}><AlertCircle size={12} /> {error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="ct-btn ct-btn--ghost" onClick={onClose} disabled={saving}>Back</button>
          <button className={`ct-btn ${['reject', 'cancel', 'failed', 'decide_cancel'].includes(kind) ? 'ct-btn--primary-danger' : 'ct-btn--success'}`} onClick={submit} disabled={saving}>
            {saving ? <BrandLoader variant="inline" size={14} /> : <CheckCircle size={14} />}
            {saving ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </>
  )
}
