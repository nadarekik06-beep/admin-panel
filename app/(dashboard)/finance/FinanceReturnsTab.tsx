'use client'

/**
 * Finance › Returns: every return / exchange with what it cost and who paid.
 *   refund (cash at pick-up, frozen at approval), who paid the shipping, the seller's
 *   charges (return fee, delivery fee, dispute), the payout hold « En attente de retour »,
 *   and the admin's decision on a non-conforming item.
 */

import { useCallback, useEffect, useState } from 'react'
import { adminComplaintApi } from '@/lib/complaintApi'
import { fmt } from './financeShared'
import BrandLoader from '@/components/brand/BrandLoader'

interface ReturnRow {
  id: number; reference: string | null; status: string; resolution_type: string; complaint_type: string; policy_version: number | null
  order_number: string | null; seller_name: string | null; shipping_payer: 'client' | 'seller' | null
  items_amount: string; refund_amount: string; refund_amount_locked: string | null; refund_method: string | null
  payout_held: boolean; inspection_result: 'conform' | 'nonconform' | null
  dispute_status: 'open' | 'resolved' | null; dispute_decision: string | null; dispute_amount: string | null
  sent_back_fee: string | null; seller_charges: string | number; created_at: string
}

const DECISION: Record<string, string> = {
  charge_seller: 'Seller charged', absorb: 'Absorbed by ChooseTounsi', contact_client: 'Client contacted',
  send_back: 'Item sent back', treat_as_conform: 'Treated as conforming',
}

export default function FinanceReturnsTab() {
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [disputesOnly, setDisputesOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminComplaintApi.financeReturns({ per_page: 50, dispute_open: disputesOnly ? 1 : undefined })
      setRows(res.data?.data ?? [])
    } catch { setRows([]) }
    finally { setLoading(false) }
  }, [disputesOnly])

  useEffect(() => { load() }, [load])

  const th: React.CSSProperties = { padding: '9px 14px', fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '10px 14px', fontSize: 12, color: '#cbd5e1', borderTop: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>
        <input type="checkbox" checked={disputesOnly} onChange={e => setDisputesOnly(e.target.checked)} />
        Open disputes only
      </label>

      <div style={{ overflowX: 'auto', background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Return', 'Order', 'Seller', 'Refund (cash at pick-up)', 'Shipping paid by', 'Seller charges', 'Payout', 'Inspection', 'Dispute decision'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ ...td, textAlign: 'center' }}><BrandLoader variant="inline" size={16} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#64748b' }}>No returns.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>
                  {r.reference ?? `#${r.id}`}
                  <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontFamily: 'inherit' }}>{r.resolution_type === 'exchange' ? 'Exchange' : 'Return'} · {r.status}</p>
                </td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{r.order_number ?? '—'}</td>
                <td style={td}>{r.seller_name ?? '—'}</td>
                <td style={{ ...td, fontWeight: 800, color: '#10b981' }}>
                  {r.resolution_type === 'exchange' ? '—' : fmt(r.refund_amount)}
                  {r.refund_amount_locked != null && <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontWeight: 600 }}>frozen {fmt(r.refund_amount_locked)}</p>}
                  {r.refund_method && <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontWeight: 600 }}>{r.refund_method}</p>}
                </td>
                <td style={td}>{r.shipping_payer === 'seller' ? 'Seller' : r.shipping_payer === 'client' ? 'Client' : '—'}</td>
                <td style={{ ...td, color: Number(r.seller_charges) < 0 ? '#ef4444' : '#94a3b8', fontWeight: 700 }}>{fmt(r.seller_charges)}</td>
                <td style={td}>{r.payout_held ? <b style={{ color: '#f59e0b' }}>En attente de retour</b> : '—'}</td>
                <td style={td}>{r.inspection_result ? (r.inspection_result === 'conform' ? 'Conforme' : <b style={{ color: '#ef4444' }}>Non conforme</b>) : '—'}</td>
                <td style={td}>
                  {r.dispute_decision
                    ? <>{DECISION[r.dispute_decision] ?? r.dispute_decision}{r.dispute_amount != null && Number(r.dispute_amount) > 0 ? ` · ${fmt(r.dispute_amount)}` : ''}{r.dispute_status === 'open' ? ' (open)' : ''}
                        {r.dispute_decision === 'send_back' && r.sent_back_fee != null && <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>client pays {fmt(r.sent_back_fee)}</p>}</>
                    : r.dispute_status === 'open' ? <b style={{ color: '#ef4444' }}>To decide</b> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
