'use client'

/**
 * Bordereau of one seller sub-order in the order drawer (one per seller):
 * attach the PDF downloaded from the Intigo dashboard (drag & drop or file button),
 * then Preview / Replace / Delete, and follow its delivery to the seller in 3 steps:
 * uploaded → seller notified → seller printed. The backend enforces every rule
 * (PDF only, 5 MB, prepared live orders only).
 */

import { useRef, useState } from 'react'
import { FileText, UploadCloud, Eye, RefreshCw, Trash2, Send, CheckCircle2, Circle, AlertTriangle } from 'lucide-react'
import BrandLoader from '@/components/brand/BrandLoader'
import { bordereauApi, bordereauError, type BordereauSummary } from '@/lib/bordereauApi'

const MAX_BYTES = 5 * 1024 * 1024

const btn = (color: string, busy: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 8, border: `1px solid ${color}66`, background: `${color}1a`, color,
  fontSize: 11, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
  display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
})

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '')

function Step({ state, title, detail, children }: {
  state: 'done' | 'todo' | 'error'
  title: string
  detail?: string
  children?: React.ReactNode
}) {
  const color = state === 'done' ? '#10b981' : state === 'error' ? '#ef4444' : '#64748b'
  const Icon = state === 'done' ? CheckCircle2 : state === 'error' ? AlertTriangle : Circle
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <Icon size={14} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: state === 'todo' ? '#94a3b8' : color }}>{title}</div>
        {detail && <div style={{ fontSize: 11, color: '#94a3b8', overflowWrap: 'anywhere' }}>{detail}</div>}
        {children}
      </div>
    </div>
  )
}

export default function ParcelBordereauBlock({ sellerOrderId, bordereau, sellerName, shopName, onChanged, notify }: {
  sellerOrderId: number
  bordereau: BordereauSummary
  sellerName: string
  shopName?: string | null
  onChanged: () => void
  notify: (type: 'success' | 'error', msg: string) => void
}) {
  const [b, setB] = useState<BordereauSummary>(bordereau)
  const [busy, setBusy] = useState<null | 'upload' | 'delete' | 'notify' | 'preview'>(null)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const apply = (next: BordereauSummary) => { setB(next); onChanged() }

  const upload = async (file: File | undefined) => {
    if (!file || busy) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return notify('error', 'The bordereau must be a PDF file.')
    if (file.size > MAX_BYTES) return notify('error', 'The bordereau must not be larger than 5 MB.')
    if (b.has_upload && !window.confirm(`Replace the current bordereau (${b.original_name ?? 'PDF'}) for ${sellerName}? The seller will be told to print the new one.`)) return
    setBusy('upload'); setProgress(0)
    try {
      const res = await bordereauApi.upload(sellerOrderId, file, setProgress)
      notify('success', res.message)
      apply(res.data)
    } catch (e) {
      notify('error', bordereauError(e))
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    if (busy || !window.confirm(`Delete the bordereau of ${sellerName}? The seller will no longer see it (the file stays in the history).`)) return
    setBusy('delete')
    try {
      const res = await bordereauApi.remove(sellerOrderId)
      notify('success', res.message)
      apply(res.data)
    } catch (e) {
      notify('error', bordereauError(e))
    } finally {
      setBusy(null)
    }
  }

  const resend = async () => {
    if (busy) return
    setBusy('notify')
    try {
      const res = await bordereauApi.resendNotification(sellerOrderId)
      notify('success', res.message)
      apply(res.data)
    } catch (e) {
      notify('error', bordereauError(e))
    } finally {
      setBusy(null)
    }
  }

  const preview = async () => {
    if (busy) return
    const tab = window.open('', '_blank')
    setBusy('preview')
    try {
      const url = URL.createObjectURL(await bordereauApi.pdf(sellerOrderId))
      setTimeout(() => URL.revokeObjectURL(url), 120_000)
      if (tab && !tab.closed) tab.location.href = url
      else window.location.assign(url)
    } catch (e) {
      tab?.close()
      notify('error', bordereauError(e))
    } finally {
      setBusy(null)
    }
  }

  const who = shopName && shopName !== sellerName ? `${sellerName} · ${shopName}` : sellerName
  const intigoOnly = !b.has_upload && b.source === 'intigo'

  return (
    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={12} /> Bordereau · <span style={{ color: '#e2e8f0', textTransform: 'none', letterSpacing: 0 }}>{who}</span>
        </div>
        {b.has_upload && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={preview} disabled={busy !== null} style={btn('#60a5fa', busy !== null)}>
              {busy === 'preview' ? <BrandLoader variant="inline" size={11} /> : <Eye size={12} />} Preview
            </button>
            {b.can_upload && (
              <button type="button" onClick={() => input.current?.click()} disabled={busy !== null} style={btn('#f59e0b', busy !== null)}>
                <RefreshCw size={12} /> Replace
              </button>
            )}
            <button type="button" onClick={remove} disabled={busy !== null} style={btn('#ef4444', busy !== null)}>
              {busy === 'delete' ? <BrandLoader variant="inline" size={11} /> : <Trash2 size={12} />} Delete
            </button>
          </div>
        )}
      </div>

      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={e => upload(e.target.files?.[0])} />

      {/* Upload zone: before the first file */}
      {!b.has_upload && b.can_upload && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') input.current?.click() }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files?.[0]) }}
          style={{
            padding: '14px 12px', borderRadius: 10, textAlign: 'center', cursor: busy ? 'not-allowed' : 'pointer',
            border: `1.5px dashed ${dragOver ? '#60a5fa' : 'rgba(255,255,255,0.18)'}`,
            background: dragOver ? 'rgba(96,165,250,0.08)' : 'transparent', color: '#94a3b8', fontSize: 12,
          }}
        >
          <UploadCloud size={18} style={{ display: 'block', margin: '0 auto 4px', color: '#60a5fa' }} />
          <strong style={{ color: '#e2e8f0' }}>Attach bordereau</strong> — drop the PDF here or click to choose (PDF, max 5 MB)
          {intigoOnly && <div style={{ marginTop: 4, fontSize: 11 }}>The Intigo bordereau is already available to the seller; uploading one replaces it.</div>}
        </div>
      )}
      {!b.has_upload && !b.can_upload && !intigoOnly && (
        <div style={{ fontSize: 11.5, color: '#64748b' }}>{b.upload_block_reason ?? 'A bordereau cannot be attached to this order.'}</div>
      )}

      {busy === 'upload' && (
        <div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#60a5fa', transition: 'width .2s' }} />
          </div>
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>Uploading… {progress}%</div>
        </div>
      )}

      {/* Delivery to the seller, step by step */}
      {(b.has_upload || intigoOnly) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {b.has_upload ? (
            <Step state="done" title={`Uploaded ✓${b.versions > 1 ? ` (version ${b.versions})` : ''}`}
              detail={`${b.original_name ?? 'PDF'} · ${fmt(b.uploaded_at)}${b.uploaded_by ? ` · by ${b.uploaded_by.name}` : ''}`} />
          ) : (
            <Step state="done" title="Intigo bordereau available ✓" detail="Fetched from the Intigo API" />
          )}

          {b.has_upload && (
            b.notified_at ? (
              <Step state="done" title="Seller notified ✓" detail={fmt(b.notified_at)} />
            ) : (
              <Step state={b.notify_error ? 'error' : 'todo'}
                title={b.notify_error ? 'Seller notification failed' : 'Seller not notified yet'}
                detail={b.notify_error ?? 'The notification is queued; it shows here once the seller received it.'}>
                <button type="button" onClick={resend} disabled={busy !== null} style={{ ...btn('#a78bfa', busy !== null), marginTop: 4 }}>
                  {busy === 'notify' ? <BrandLoader variant="inline" size={11} /> : <Send size={12} />} Resend notification
                </button>
              </Step>
            )
          )}

          {b.first_printed_at ? (
            <Step state="done" title="Seller downloaded / printed ✓"
              detail={`First ${fmt(b.first_printed_at)} · ${b.print_count}×${b.last_printed_at && b.print_count > 1 ? ` · last ${fmt(b.last_printed_at)}` : ''}`} />
          ) : (
            <Step state="todo" title="Not opened yet" detail="The seller has not downloaded it." />
          )}
        </div>
      )}
    </div>
  )
}
