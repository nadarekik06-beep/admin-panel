'use client'

/**
 * Guest orders (no account, often no e-mail): the admin sends the buyer their
 * tracking link on WhatsApp — manual, from the business WhatsApp, no paid API.
 * Opens the chat with a French + Arabic message pre-filled (same opener as
 * "Notify seller": WhatsApp app / Web on a computer, wa.me on a phone) and
 * copies it in case the chat opens empty.
 *
 * The link is /track-order?order=ORD-…: the buyer types their phone to open it
 * (device tokens are stored hashed, so no direct link can be rebuilt here).
 */

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { openWhatsApp, WA_GREEN } from '@/components/whatsapp/SellerWhatsApp'

/** The business WhatsApp the messages are sent from (shown to the admin). */
export const BUSINESS_WHATSAPP = '+216 57 252 576'

const STOREFRONT = (process.env.NEXT_PUBLIC_STOREFRONT_URL || 'https://choosetounsi.tn').replace(/\/+$/, '')

/** "+216 57 252 576", "0021657252576", "57252576" → "21657252576"; null when not a Tunisian mobile. */
export function tunisianWhatsApp(phone?: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^(00)?216(?=\d{8}$)/, '')
  return /^[2459]\d{7}$/.test(digits) ? `216${digits}` : null
}

export function trackOrderUrl(orderNumber: string): string {
  return `${STOREFRONT}/track-order?order=${encodeURIComponent(orderNumber)}`
}

/** Return / exchange status, as told to the buyer (FR, AR). */
const RETURN_STATUS: Record<string, [string, string]> = {
  requested:           ['reçue, la boutique va répondre', 'تم استلامه، سيجيب المتجر قريباً'],
  seller_accepted:     ['acceptée par la boutique, notre équipe valide', 'قبله المتجر، فريقنا بصدد المصادقة'],
  seller_rejected:     ['refusée par la boutique (vous pouvez contester depuis le lien)', 'رفضه المتجر (يمكنك الاعتراض من الرابط)'],
  escalated:           ['en cours d’examen par notre équipe', 'قيد الدراسة من طرف فريقنا'],
  admin_approved:      ['acceptée, le livreur va vous contacter', 'تمت الموافقة، سيتصل بك عون التوصيل'],
  pickup_scheduled:    ['enlèvement programmé, le livreur va passer', 'تمت برمجة الاستلام، سيمرّ عون التوصيل'],
  picked_up:           ['colis récupéré par le livreur', 'استلم عون التوصيل الطرد'],
  returned_to_seller:  ['colis arrivé à la boutique', 'وصل الطرد إلى المتجر'],
  refunded:            ['remboursée', 'تم استرجاع المبلغ'],
  rejected:            ['refusée par notre équipe', 'رفضه فريقنا'],
  cancelled:           ['annulée', 'أُلغي'],
  closed:              ['clôturée', 'أُغلق'],
  exchange_in_transit: ['nouvel article en route, le livreur reprend l’ancien', 'المنتج الجديد في الطريق، وسيسترجع عون التوصيل القديم'],
  exchanged:           ['nouvel article livré', 'تم تسليم المنتج الجديد'],
  exchange_failed:     ['échange non abouti, notre équipe vous contacte', 'لم يتم الاستبدال، سيتصل بك فريقنا'],
  exchange_completed:  ['échange terminé', 'تم الاستبدال'],
}

/** Guest order: the tracking link and how to open it. */
export function guestOrderMessage(orderNumber: string, name?: string | null): string {
  const url = trackOrderUrl(orderNumber)
  const first = (name ?? '').trim().split(/\s+/)[0] || ''
  return [
    `Bonjour${first ? ` ${first}` : ''} 👋`,
    `Merci pour votre commande ${orderNumber} sur ChooseTounsi.`,
    `Suivez-la ici : ${url}`,
    'Pour l’ouvrir, tapez le numéro de téléphone utilisé pour la commande.',
    '',
    `مرحباً${first ? ` ${first}` : ''} 👋`,
    `شكراً على طلبك ${orderNumber} على ChooseTounsi.`,
    `تابعه من هنا: ${url}`,
    'لفتح الرابط، اكتب رقم الهاتف الذي استعملته في الطلب.',
  ].join('\n')
}

/** Guest return / exchange: its new status + the same tracking link. */
export function guestReturnMessage(opts: {
  orderNumber: string; reference?: string | null; status: string; exchange: boolean; name?: string | null
}): string {
  const url = trackOrderUrl(opts.orderNumber)
  const first = (opts.name ?? '').trim().split(/\s+/)[0] || ''
  const [fr, ar] = RETURN_STATUS[opts.status] ?? [opts.status, opts.status]
  const ref = opts.reference ? ` ${opts.reference}` : ''
  return [
    `Bonjour${first ? ` ${first}` : ''} 👋`,
    `Votre demande ${opts.exchange ? 'd’échange' : 'de retour'}${ref} (commande ${opts.orderNumber}) : ${fr}.`,
    `Suivi : ${url}`,
    'Pour l’ouvrir, tapez le numéro de téléphone utilisé pour la commande.',
    '',
    `مرحباً${first ? ` ${first}` : ''} 👋`,
    `طلب ${opts.exchange ? 'الاستبدال' : 'الإرجاع'}${ref} (الطلب ${opts.orderNumber}): ${ar}.`,
    `المتابعة: ${url}`,
    'لفتح الرابط، اكتب رقم الهاتف الذي استعملته في الطلب.',
  ].join('\n')
}

/** Green WhatsApp button (same look as "Notify seller on WhatsApp"); nothing is sent automatically. */
export function GuestWhatsAppButton({ phone, message, label }: { phone?: string | null; message: string; label: string }) {
  const to = tunisianWhatsApp(phone)
  const [note, setNote] = useState<string | null>(null)

  const send = async () => {
    if (!to) return
    const copied = await openWhatsApp(`https://wa.me/${to}?text=${encodeURIComponent(message)}`)
    setNote(copied ? 'Message copied: if the chat opens empty, paste it (Ctrl+V).' : null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" onClick={send} disabled={!to}
        title={to ? `From the business WhatsApp ${BUSINESS_WHATSAPP} to +${to}` : 'No valid Tunisian mobile number for this guest'}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap', alignSelf: 'flex-start',
          padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 800,
          border: `1px solid ${WA_GREEN}`, background: `linear-gradient(135deg, ${WA_GREEN}, #146f33)`, color: '#fff',
          cursor: to ? 'pointer' : 'not-allowed', opacity: to ? 1 : 0.45, fontFamily: 'inherit',
        }}>
        <MessageCircle size={14} /> {label}
      </button>
      <span style={{ fontSize: 11, color: '#64748b' }}>
        {to ? `Opens the chat with +${to} (send it from ${BUSINESS_WHATSAPP}).` : 'No valid Tunisian mobile number.'}
        {note ? ` ${note}` : ''}
      </span>
    </div>
  )
}
