'use client'

/**
 * Intigo block of one parcel in the order drawer: nid, send status, error,
 * carrier status + history, size override (before sending), Retry send and
 * Cancel parcel (pickup phase only). The backend enforces every rule
 * (no duplicate parcel, cancel only before pickup); buttons follow its flags.
 */

import { useState } from 'react'
import { Truck, RefreshCw, XCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { intigoApi, intigoTone, type ParcelIntigo, type ParcelSize } from '@/lib/intigoApi'

const SIZE_LABEL: Record<ParcelSize, string> = { S: 'S · small', L: 'L · large', XL: 'XL · extra large' }

const btn = (color: string, busy: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 8, border: `1px solid ${color}66`, background: `${color}1a`, color,
  fontSize: 11, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
  display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
})

export default function ParcelIntigoBlock({ intigo, onChanged, notify }: {
  intigo: ParcelIntigo
  onChanged: () => void
  notify: (type: 'success' | 'error', msg: string) => void
}) {
  const [busy, setBusy] = useState<null | 'retry' | 'cancel' | 'size' | 'dismiss'>(null)
  const [detail, setDetail] = useState<ParcelIntigo | null>(null)
  const [open, setOpen] = useState(false)
  const i = detail ?? intigo
  const tone = intigoTone(i.status_code, i.sync_status)

  const run = async (kind: 'retry' | 'cancel' | 'dismiss', fn: () => Promise<{ message?: string; data?: ParcelIntigo } | { success: boolean }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(kind)
    try {
      const res: any = await fn()
      if (res?.data) setDetail(res.data)
      notify('success', res?.message ?? 'Done.')
      onChanged()
    } catch (e: any) {
      if (e?.data) setDetail(e.data)
      notify('error', e?.message ?? 'Request failed')
    } finally { setBusy(null) }
  }

  const changeSize = async (size: ParcelSize) => {
    setBusy('size')
    try {
      const res = await intigoApi.setSize(i.seller_order_id, size)
      setDetail(res.data)
      notify('success', res.message ?? 'Parcel size updated.')
      onChanged()
    } catch (e: any) { notify('error', e?.message ?? 'Request failed') } finally { setBusy(null) }
  }

  const toggleHistory = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      try { setDetail(await intigoApi.parcel(i.seller_order_id)) } catch (e: any) { notify('error', e?.message ?? 'Could not load the history') }
    }
  }

  const syncLabel = i.nid && i.sync_status !== 'cancelled' ? 'Sent' : i.sync_status === 'pending' ? 'Sending…' : i.sync_status === 'failed' ? 'Failed' : i.sync_status === 'cancelled' ? 'Cancelled at Intigo' : 'Not sent yet'

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(96,165,250,0.05)', border: `1px solid ${i.attention || i.sync_status === 'failed' ? 'rgba(239,68,68,0.45)' : 'rgba(96,165,250,0.2)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#60a5fa' }}>
          <Truck size={11} /> Intigo{i.mode === 'fake' && <span style={{ color: '#f59e0b', letterSpacing: 0, textTransform: 'none' }}> · fake mode</span>}
          <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 800, color: tone }}>· {syncLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {i.can_retry && (
            <button type="button" style={btn('#60a5fa', busy !== null)} disabled={busy !== null}
              onClick={() => run('retry', () => intigoApi.retry(i.seller_order_id), i.nid ? `Parcel ${i.nid} was cancelled at Intigo. Create a NEW parcel (a driver will come)?` : 'Send this parcel to Intigo now?')}>
              <RefreshCw size={11} /> {busy === 'retry' ? 'Sending…' : 'Retry send'}
            </button>
          )}
          {i.can_cancel && (
            <button type="button" style={btn('#f97316', busy !== null)} disabled={busy !== null}
              onClick={() => run('cancel', () => intigoApi.cancel(i.seller_order_id), `Cancel Intigo parcel ${i.nid}? The order itself stays as it is.`)}>
              <XCircle size={11} /> {busy === 'cancel' ? 'Cancelling…' : 'Cancel parcel'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, color: '#94a3b8' }}>
        <span>Ref <strong style={{ fontFamily: 'monospace', color: '#f1f5f9' }}>{i.nid ?? '—'}</strong></span>
        <span>Status <strong style={{ color: tone }}>{i.status_label ?? (i.nid ? 'Waiting for pickup' : '—')}{i.status_code ? ` (${i.status_code})` : ''}</strong></span>
        <span>COD <strong style={{ color: '#f1f5f9' }}>{i.cod_amount.toFixed(3)} TND</strong></span>
        <span>Pickup index <strong style={{ color: i.pickup_index === null ? '#ef4444' : '#f1f5f9' }}>{i.pickup_index ?? 'not set'}</strong></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Size
          {i.can_change_size ? (
            <select value={i.parcel_size} disabled={busy !== null} onChange={e => changeSize(e.target.value as ParcelSize)}
              style={{ background: '#0f172a', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, fontSize: 11, padding: '2px 4px' }}>
              {(['S', 'L', 'XL'] as ParcelSize[]).map(s => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}
            </select>
          ) : <strong style={{ color: '#f1f5f9' }}>{i.parcel_size}</strong>}
          {i.parcel_size_computed && i.parcel_size_computed !== i.parcel_size && <span title="Size computed at checkout">(computed {i.parcel_size_computed})</span>}
        </span>
      </div>

      {i.error && i.sync_status !== 'sent' && (
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: i.sync_status === 'failed' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{i.error}</p>
      )}
      {i.attention && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: '#fca5a5', fontWeight: 700 }}>
          <span style={{ display: 'inline-flex', gap: 6 }}><AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} /> {i.attention}</span>
          <button type="button" style={btn('#94a3b8', busy !== null)} disabled={busy !== null}
            onClick={() => run('dismiss', async () => { await intigoApi.dismiss(i.seller_order_id); setDetail({ ...i, attention: null }); return { message: 'Dismissed.' } })}>
            Dismiss
          </button>
        </div>
      )}
      {i.district_fallback && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f59e0b' }}>Delegation not recognised: Intigo used “{i.district_name}”.</p>
      )}
      {i.previous_nids.length > 0 && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>Earlier cancelled parcels: {i.previous_nids.join(', ')}</p>
      )}

      <button type="button" onClick={toggleHistory} style={{ marginTop: 8, background: 'none', border: 'none', color: '#60a5fa', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, fontFamily: 'inherit' }}>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Carrier history &amp; logs
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {detail?.payload_problems && detail.payload_problems.length > 0 && (
            <p style={{ margin: 0, fontSize: 11, color: '#ef4444' }}>Can&apos;t be sent yet: {detail.payload_problems.join('; ')}</p>
          )}
          <div style={{ fontSize: 11, color: '#cbd5e1' }}>
            {!detail?.history ? 'Loading…' : detail.history.length === 0 ? <span style={{ color: '#64748b' }}>No carrier status received yet.</span> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {detail.history.map(h => (
                    <tr key={h.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '4px 6px', whiteSpace: 'nowrap', color: '#64748b' }}>{new Date(h.created_at).toLocaleString()}</td>
                      <td style={{ padding: '4px 6px', fontWeight: 800 }}>{h.new_status}</td>
                      <td style={{ padding: '4px 6px' }}>{h.status_label}</td>
                      <td style={{ padding: '4px 6px', color: '#64748b' }}>{h.source}</td>
                      <td style={{ padding: '4px 6px', color: '#94a3b8' }}>{h.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {detail?.logs && detail.logs.length > 0 && (
            <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
              {detail.logs.map(l => (
                <div key={l.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#64748b' }}>{new Date(l.created_at).toLocaleString()}</span>
                  <span style={{ fontFamily: 'monospace' }}>{l.method} {l.endpoint}</span>
                  <span style={{ fontWeight: 800, color: l.http_status && l.http_status < 300 ? '#14b8a6' : '#ef4444' }}>{l.http_status ?? 'no answer'}</span>
                  {l.error && <span style={{ color: '#fca5a5' }}>{l.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
