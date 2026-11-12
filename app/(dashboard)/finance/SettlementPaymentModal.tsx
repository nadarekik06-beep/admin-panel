// admin-panel/app/(dashboard)/finance/SettlementPaymentModal.tsx
// Payment details + proof of payment (bank transfer receipt / D17 screenshot) of a settlement batch.
'use client'

import { useState } from 'react'
import { X, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import api from '@/lib/axios'
import BrandLoader from '@/components/brand/BrandLoader'

export interface PaymentValues {
  method: string
  reference: string
  date: string
  file: File | null
}

export const emptyPayment = (): PaymentValues => ({
  method: '', reference: '', date: format(new Date(), 'yyyy-MM-dd'), file: null,
})

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export const NO_PROOF_WARNING = 'Aucune preuve jointe, le vendeur ne verra pas de reçu. Continuer ?'

const METHODS = [
  { value: 'bank_transfer', label: 'Virement bancaire' },
  { value: 'd17',           label: 'D17' },
  { value: 'cash',          label: 'Espèces' },
]

export const methodLabel = (m?: string | null) => METHODS.find(x => x.value === m)?.label ?? m ?? '—'

/** Client-side pre-check (the API re-checks the real MIME type of the content). */
export function checkProofFile(f: File): string | null {
  if (!ALLOWED.includes(f.type)) return 'Fichier non accepté : JPG, PNG, WEBP ou PDF uniquement.'
  if (f.size > MAX_BYTES) return 'Fichier trop volumineux (5 Mo maximum).'
  return null
}

/** Only fields with a value are sent, so a blank field never overwrites saved data by accident. */
export function paymentFormData(v: PaymentValues, extra: Record<string, string> = {}): FormData {
  const fd = new FormData()
  Object.entries(extra).forEach(([k, val]) => fd.append(k, val))
  if (v.method)    fd.append('payment_method', v.method)
  if (v.reference) fd.append('payment_reference', v.reference)
  if (v.date)      fd.append('payment_date', v.date)
  if (v.file)      fd.append('proof', v.file)
  return fd
}

export const uploadConfig = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90_000 }

/** The proof is private: fetched with the admin token, then shown from a temporary blob URL. */
export async function fetchProofBlob(batchId: number): Promise<{ blob: Blob; url: string }> {
  const res = await api.get(`/admin/settlements/${batchId}/payment-proof`, { responseType: 'blob', timeout: 60_000 })
  const blob = res.data as Blob
  return { blob, url: URL.createObjectURL(blob) }
}

export async function openProof(batchId: number) {
  const w = window.open('', '_blank')   // opened first so the popup is not blocked
  try {
    const { url } = await fetchProofBlob(batchId)
    if (w) w.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    w?.close()
    alert('Impossible d’ouvrir la preuve.')
  }
}

export async function downloadProof(row: { id: number; batch_reference: string; proof_mime?: string | null }) {
  try {
    const { url } = await fetchProofBlob(row.id)
    const a = document.createElement('a')
    const ext = row.proof_mime === 'application/pdf' ? 'pdf' : row.proof_mime === 'image/png' ? 'png' : row.proof_mime === 'image/webp' ? 'webp' : 'jpg'
    a.href = url
    a.download = `preuve-${row.batch_reference}.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch {
    alert('Téléchargement impossible.')
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '10px 14px', fontSize: 13, color: '#f1f5f9', outline: 'none',
  fontFamily: 'inherit', colorScheme: 'dark',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
  color: '#64748b', display: 'block', marginBottom: 8,
}

/** Method / reference / date / proof upload — used by the create modal and the pay / proof modal. */
export function PaymentFields({
  values, onChange, onError, fileLabel = 'Preuve de paiement (optionnel)',
}: {
  values: PaymentValues
  onChange: (v: PaymentValues) => void
  onError: (msg: string) => void
  fileLabel?: string
}) {
  const set = (patch: Partial<PaymentValues>) => onChange({ ...values, ...patch })

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Mode de paiement</label>
          <select value={values.method} onChange={e => set({ method: e.target.value })} style={inputStyle}>
            <option value="" style={{ background: '#0f1623' }}>—</option>
            {METHODS.map(m => <option key={m.value} value={m.value} style={{ background: '#0f1623' }}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Date de paiement</label>
          <input type="date" value={values.date} onChange={e => set({ date: e.target.value })} style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Référence (optionnel)</label>
        <input
          value={values.reference} maxLength={120}
          onChange={e => set({ reference: e.target.value })}
          placeholder="ex. n° de virement" style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>{fileLabel}</label>
        <input
          type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={e => {
            const f = e.target.files?.[0] ?? null
            if (!f) { set({ file: null }); return }
            const err = checkProofFile(f)
            if (err) { onError(err); e.target.value = ''; set({ file: null }); return }
            onError('')
            set({ file: f })
          }}
          style={{ ...inputStyle, padding: '8px 12px' }}
        />
        <p style={{ fontSize: 10, color: '#475569', margin: '6px 0 0' }}>JPG, PNG, WEBP ou PDF — 5 Mo max. Stocké en privé.</p>
      </div>
    </>
  )
}

/**
 * mode 'pay'  — draft batch: "Marquer comme payé" (confirm) with payment details + optional proof.
 * mode 'edit' — paid batch: view / download / replace / remove the proof and edit the details.
 */
export default function SettlementPaymentModal({
  row, mode, onClose, onDone,
}: {
  row: any
  mode: 'pay' | 'edit'
  onClose: () => void
  onDone: () => void | Promise<void>
}) {
  const [values, setValues] = useState<PaymentValues>({
    method: row.payment_method ?? '',
    reference: row.payment_reference ?? '',
    date: row.payment_date ? String(row.payment_date).slice(0, 10) : format(new Date(), 'yyyy-MM-dd'),
    file: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const hasProof = !!row.has_proof

  const submit = async () => {
    setError('')
    if (mode === 'pay') {
      if (!values.file && !hasProof && !window.confirm(NO_PROOF_WARNING)) return
    } else if (!values.file && !values.method && !values.reference && !values.date) {
      setError('Rien à enregistrer.')
      return
    }
    setLoading(true)
    try {
      const url = mode === 'pay' ? `/admin/settlements/${row.id}/confirm` : `/admin/settlements/${row.id}/payment-proof`
      await api.post(url, paymentFormData(values), uploadConfig)
      await onDone()
      onClose()
    } catch (e: any) {
      const errs = e?.response?.data?.errors
      setError((errs && Object.values(errs).flat()[0] as string) || e?.response?.data?.message || 'Échec de l’enregistrement.')
    } finally {
      setLoading(false)
    }
  }

  const removeProof = async () => {
    if (!window.confirm('Supprimer la preuve de paiement ? Le vendeur ne verra plus le reçu.')) return
    setLoading(true)
    try {
      await api.delete(`/admin/settlements/${row.id}/payment-proof`)
      await onDone()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Suppression impossible.')
    } finally {
      setLoading(false)
    }
  }

  const btn: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', fontSize: 11, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 201, width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
        background: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
              {mode === 'pay' ? 'Marquer comme payé' : 'Preuve de paiement'}
            </p>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              {row.batch_reference} · {row.seller_name}
            </p>
          </div>
          <button onClick={onClose} style={{ ...btn, width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
              ⚠ {error}
            </div>
          )}

          {hasProof && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Paperclip size={13} /> {row.proof_original_name || 'Preuve jointe'}
              </p>
              <p style={{ margin: '4px 0 10px', fontSize: 10, color: '#64748b' }}>
                Ajoutée par {row.proof_uploaded_by_name ?? (row.proof_uploaded_by ? `admin #${row.proof_uploaded_by}` : '—')}
                {row.proof_uploaded_at ? ` le ${format(new Date(row.proof_uploaded_at), 'dd/MM/yyyy HH:mm')}` : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={btn} onClick={() => openProof(row.id)}>Voir</button>
                <button style={btn} onClick={() => downloadProof(row)}>Télécharger</button>
                <button style={{ ...btn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={removeProof} disabled={loading}>Supprimer</button>
              </div>
            </div>
          )}

          <PaymentFields
            values={values} onChange={setValues} onError={setError}
            fileLabel={hasProof ? 'Remplacer la preuve' : 'Preuve de paiement (optionnel)'}
          />

          {mode === 'pay' && (
            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
              Le lot sera marqué <strong>payé</strong> (irréversible). Si une preuve est jointe, le vendeur est notifié.
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ ...btn, flex: 1, padding: '11px 0', fontSize: 13 }}>Annuler</button>
            <button onClick={submit} disabled={loading} style={{
              flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
              background: loading ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#10b981,#059669)',
              color: '#fff', fontSize: 13, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading && <BrandLoader variant="inline" size={14} />}
              {mode === 'pay' ? '✓ Marquer comme payé' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
