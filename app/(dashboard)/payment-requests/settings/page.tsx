'use client'

// Manual WhatsApp payment settings: on/off switch, WhatsApp number, top-up limits and the
// French message templates the seller sends. Nothing here is hard-coded in the apps.

import { useEffect, useState } from 'react'
import { paymentRequestsApi, type ManualPaymentSettings } from '@/lib/paymentRequestsApi'
import { Btn, card, input, Notice } from '../../sponsoring/_components/ui'
import { PaymentsShell } from '../_components/shell'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import BrandLoader from '@/components/brand/BrandLoader'

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 5 }
const PLACEHOLDERS = '{reference} {type} {amount} {store} {seller_name} {seller_id} {email} {phone} {balance} {date} {current_plan} {requested_plan} {price} {period}'

export default function PaymentSettingsPage() {
  const [values, setValues] = useState<ManualPaymentSettings | null>(null)
  const [defaults, setDefaults] = useState<Partial<ManualPaymentSettings>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  // holds the navigation loader until the first load is done
  usePageLoading(!values && msg?.tone !== 'error')

  useEffect(() => {
    paymentRequestsApi.settings().then(d => { setValues(d.values); setDefaults(d.defaults) }).catch(e => setMsg({ tone: 'error', text: e.message }))
  }, [])

  const set = <K extends keyof ManualPaymentSettings>(k: K, v: ManualPaymentSettings[K]) => setValues(s => (s ? { ...s, [k]: v } : s))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!values) return
    setBusy(true); setMsg(null)
    try {
      const d = await paymentRequestsApi.saveSettings({ ...values, min_top_up: Number(values.min_top_up), max_top_up: Number(values.max_top_up) })
      setValues(d.values)
      setMsg({ tone: 'ok', text: 'Paramètres enregistrés.' })
    } catch (err: any) { setMsg({ tone: 'error', text: err.message }) } finally { setBusy(false) }
  }

  return (
    <PaymentsShell title="Demandes de paiement — paramètres">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!values ? <section style={card}><BrandLoader variant="section" minHeight={200} /></section> : (
        <form onSubmit={save} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={values.whatsapp_enabled} onChange={e => set('whatsapp_enabled', e.target.checked)} style={{ width: 18, height: 18 }} />
            Paiement manuel via WhatsApp activé
          </label>
          <p style={{ margin: '-8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Désactivé : les vendeurs ne peuvent plus créer de demande (les demandes en attente restent traitables ici).
          </p>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <label style={lbl}>Numéro WhatsApp
              <input required value={values.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)} style={input} placeholder={defaults.whatsapp_number} />
            </label>
            <label style={lbl}>Recharge minimum (DT)
              <input required type="number" min="1" step="0.001" value={values.min_top_up} onChange={e => set('min_top_up', e.target.value as unknown as number)} style={input} />
            </label>
            <label style={lbl}>Recharge maximum (DT)
              <input required type="number" min="1" step="0.001" value={values.max_top_up} onChange={e => set('max_top_up', e.target.value as unknown as number)} style={input} />
            </label>
          </div>

          <label style={lbl}>Message — recharge du portefeuille
            <textarea required rows={9} value={values.template_wallet_topup} onChange={e => set('template_wallet_topup', e.target.value)} style={{ ...input, resize: 'vertical', fontFamily: 'monospace' }} />
          </label>
          <label style={lbl}>Message — changement de plan
            <textarea required rows={9} value={values.template_plan_upgrade} onChange={e => set('template_plan_upgrade', e.target.value)} style={{ ...input, resize: 'vertical', fontFamily: 'monospace' }} />
          </label>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Variables disponibles : <code>{PLACEHOLDERS}</code>
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn type="submit" tone="gold" loading={busy}>Enregistrer</Btn>
            <Btn onClick={() => defaults.template_wallet_topup && setValues(v => v && ({ ...v, template_wallet_topup: defaults.template_wallet_topup!, template_plan_upgrade: defaults.template_plan_upgrade! }))}>
              Rétablir les messages par défaut
            </Btn>
          </div>
        </form>
      )}
    </PaymentsShell>
  )
}
