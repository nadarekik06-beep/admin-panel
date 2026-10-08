'use client'

/**
 * Admin return detail: the whole file (order, returned lines as bought with
 * qty / price paid / totals, reason, proof photos, both addresses, audit
 * trail, finance adjustments) and the next step for its status. Uses the
 * ct-* classes injected by the complaints page.
 */

import { useState } from 'react'
import {
  CheckCircle, XCircle, X, User, Store, Package, Image as ImageIcon, CalendarDays, MessageSquare,
  FileDown, Truck, PackageCheck, Wallet, Ban, History, MapPin, AlertCircle, ShieldAlert, ArrowUpRight,
} from 'lucide-react'
import { adminComplaintApi } from '@/lib/complaintApi'
import BrandLoader from '@/components/brand/BrandLoader'
import type { Complaint, ItemCondition, RefundMethod } from '@/types/complaint'
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
  finance_applied: 'Sale reversed (finance)', refund_issued: 'Refund issued', slip_exported: 'Return slip exported',
}

export function ReturnStatusBadge({ status }: { status: string }) {
  const cfg = statusConfig(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, padding: '4px 10px',
      borderRadius: 100, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}28`,
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

type StepKind = 'approve' | 'reject' | 'pickup' | 'pickedup' | 'receive' | 'refund' | 'cancel'

export default function ReturnDrawer({ complaint, onClose, onRefresh }: {
  complaint: Complaint | null; onClose: () => void; onRefresh: () => void
}) {
  const [step,   setStep]   = useState<StepKind | null>(null)
  const [acting, setActing] = useState(false)
  const [toast,  setToast]  = useState('')

  if (!complaint) return null
  const c = complaint
  const cfg = statusConfig(c.status)
  const legacy = c.resolution_type === 'exchange'
  const items = c.complained_items ?? []
  const photos = c.image_urls?.length ? c.image_urls : (c.image_url ? [c.image_url] : [])
  const fee = Number(c.return_shipping_fee ?? 0)
  const cash = !!c.cash_refund   // COD: the courier pays the client back in cash at pick-up

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }
  const run = async (fn: () => Promise<any>, ok: string) => {
    setActing(true)
    try { const r = await fn(); showToast(r?.message ?? ok); onRefresh(); return true }
    catch (err: any) { showToast('Failed: ' + (err?.message ?? 'Action failed.')); return false }
    finally { setActing(false) }
  }

  const slip = () => run(() => adminComplaintApi.returnSlip(c.id).then(name => ({ message: `⬇ ${name}` })), 'Downloaded')

  // ── Next step per status ────────────────────────────────────────────────
  const next = (() => {
    const btn = (label: string, icon: React.ReactNode, cls: string, onClick: () => void) =>
      <button key={label} className={`ct-btn ${cls}`} disabled={acting} onClick={onClick} style={{ flex: 1 }}>{icon}{label}</button>
    const decide = [
      btn('Reject', <XCircle size={14} />, 'ct-btn--danger', () => setStep('reject')),
      btn('Approve return', <CheckCircle size={14} />, 'ct-btn--success', () => setStep('approve')),
    ]
    if (legacy && ['admin_approved', 'pickup_scheduled', 'picked_up'].includes(c.status)) {
      return { title: 'Legacy exchange', text: 'Filed as an exchange under the previous policy. Close it once handled.', color: '#94a3b8',
        actions: [btn('Close request', <CheckCircle size={14} />, 'ct-btn--success', () => run(() => adminComplaintApi.close(c.id), 'Closed'))] }
    }
    switch (c.status) {
      case 'requested': return { title: 'Waiting for the seller (48h)', text: 'You may decide now without waiting for the shop.', color: '#f59e0b', actions: decide }
      case 'seller_accepted': return { title: 'Seller accepted — your validation is required', text: 'Approve to open the pick-up, or reject (overrides the seller).', color: '#3b82f6', actions: decide }
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
              <ReturnStatusBadge status={c.status} />
              {legacy && <span style={{ ...chip, color: ORANGE }}>Legacy exchange</span>}
              {c.return_scope && <span style={chip}>{c.return_scope === 'full' ? 'Whole order' : 'Partial'}</span>}
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
              <button className="ct-btn ct-btn--ghost" onClick={slip} disabled={acting} title="Return slip PDF for the delivery company">
                <FileDown size={14} /> Return slip
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
              <div style={{ display: 'flex', gap: 10 }}>{next.actions}</div>
            </div>
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
            <p className="ct-section-title"><Package size={12} /> Returned items</p>
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
                <KV k="Return shipping" v={`${dt(fee)} · paid by ${c.shipping_payer === 'seller' ? 'the seller (adjustment)' : 'the client (deducted)'}`} />
                <KV k={c.status === 'refunded' ? 'Refunded' : 'Refund due'} v={<b style={{ color: GREEN }}>{dt(c.refund_amount)}</b>} />
                {c.refund_method && <KV k="Method" v={REFUND_METHOD_LABELS[c.refund_method]} />}
                {c.refund_reference && <KV k="Reference" v={<span style={{ fontFamily: 'monospace' }}>{c.refund_reference}</span>} />}
              </div>
            </div>
          </div>

          {/* Addresses: pickup = client, destination = seller */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="ct-info-card">
              <p className="ct-info-card-label"><User size={13} /> Pickup — client</p>
              <AddressLines lines={[c.client_address?.name, c.client_address?.phone, c.client_address?.address, c.client_address?.delegation,
                [c.client_address?.postal_code, c.client_address?.wilaya].filter(Boolean).join(' ')]} />
              <p style={{ fontSize: 11, color: 'var(--drawer-t2)', margin: '6px 0 0' }}>{c.user?.email}</p>
            </div>
            <div className="ct-info-card">
              <p className="ct-info-card-label"><Store size={13} /> Destination — seller</p>
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

          {/* Audit trail */}
          {!!c.events?.length && (
            <div>
              <p className="ct-section-title"><History size={12} /> Timeline &amp; audit</p>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.events.map(e => (
                  <li key={e.id} style={{ display: 'flex', gap: 10 }}>
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: statusConfig(e.status).color }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--drawer-t1)' }}>
                        {EVENT_LABELS[e.status] ?? statusConfig(e.status).label}
                        <span style={{ fontWeight: 600, color: 'var(--drawer-t2)' }}> · {e.actor?.name ?? e.actor_role ?? 'system'} · {when(e.created_at)}</span>
                      </p>
                      {e.note && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--drawer-t2)', lineHeight: 1.5 }}>{e.note}</p>}
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
  const [text,       setText]       = useState('')
  const [payer,      setPayer]      = useState<'seller' | 'client'>(c.shipping_payer ?? 'seller')
  const [carrier,    setCarrier]    = useState('')
  const [date,       setDate]       = useState('')
  const [tracking,   setTracking]   = useState('')
  const [method,     setMethod]     = useState<RefundMethod>(methods[0])
  const [reference,  setReference]  = useState('')
  const [conditions, setConditions] = useState<Record<number, ItemCondition>>({})
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const TITLES: Record<StepKind, string> = {
    approve: 'Approve the return', reject: 'Reject the return', pickup: 'Pick-up scheduled',
    pickedup: c.cash_refund ? 'Picked up — courier paid the client in cash' : 'Picked up',
    receive: 'Confirm reception & condition', refund: 'Issue the refund', cancel: 'Cancel the return',
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
            <label className="ct-label">Return shipping ({dt(c.return_shipping_fee)}) paid by</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <button type="button" style={choice(payer === 'seller', GREEN)} onClick={() => setPayer('seller')}>Seller (wrong / defective)</button>
              <button type="button" style={choice(payer === 'client', ORANGE)} onClick={() => setPayer('client')}>Client (change of mind)</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--t3)', margin: '0 0 12px' }}>
              {payer === 'seller' ? 'Charged to the seller as an adjustment on their next settlement.' : 'Deducted from the client’s refund.'}
            </p>
          </>
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
                The sale is reversed in finance now; the shop still inspects the item at reception.
              </p>
            )}
            <label className="ct-label">Courier</label>
            <input className="ct-input" value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="Courier name / company" style={{ marginBottom: 12 }} />
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
          <button className={`ct-btn ${['reject', 'cancel'].includes(kind) ? 'ct-btn--primary-danger' : 'ct-btn--success'}`} onClick={submit} disabled={saving}>
            {saving ? <BrandLoader variant="inline" size={14} /> : <CheckCircle size={14} />}
            {saving ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </>
  )
}
