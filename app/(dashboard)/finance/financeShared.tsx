// admin-panel/app/finance/financeShared.tsx
// Helpers shared by the Finance page and the order details drawer.

export function fmt(v: number | string) {
  return `${Number(v).toFixed(3)} DT`
}

// Every order has a real agency shipping cost; this is who covered it.
export const SHIPPING_PAYER: Record<string, { label: string; color: string }> = {
  customer: { label: 'Customer', color: '#3b82f6' },
  seller:   { label: 'Seller (free shipping)', color: '#f59e0b' },
  mixed:    { label: 'Per parcel (customer / seller)', color: '#94a3b8' },
  platform: { label: 'Platform', color: '#ef4444' },
}

const PAYOUT_COLORS: Record<string, string> = {
  pending:   '#f59e0b',
  ready:     '#3b82f6',
  paid:      '#10b981',
  cancelled: '#ef4444',
  draft:     '#a78bfa',
}

/**
 * Parcels that are not a sale, never merged:
 *   cancelled  never handed to the courier (hidden from finance unless asked for)
 *   refused    refused at the door; the agency fee is our loss or billed to the seller
 */
const OUTCOMES: Record<string, { label: string; color: string }> = {
  cancelled:          { label: 'Cancelled',                  color: '#64748b' },
  refused:            { label: 'Refused',                    color: '#ef4444' },
  returned_to_seller: { label: 'Refused · back at seller',   color: '#ef4444' },
}

export function ParcelOutcomeBadge({ row }: { row: { status?: string; refused_agency_fee?: string | number | null; refused_fee_paid_by?: string | null } }) {
  const o = row.status ? OUTCOMES[row.status] : undefined
  if (!o) return null
  const fee = Number(row.refused_agency_fee ?? 0)
  return (
    <span
      title={row.status === 'cancelled' ? 'Never handed to the courier: no money, not counted anywhere' : 'Refused at the door: no cash, no commission, no payout'}
      style={{
        display: 'inline-block', marginTop: 4, marginRight: 4,
        fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
        background: `${o.color}18`, color: o.color, border: `1px solid ${o.color}30`,
      }}
    >
      {o.label}
      {row.status !== 'cancelled' && fee > 0 && ` · fee ${fmt(fee)} (${row.refused_fee_paid_by === 'seller' ? 'seller' : 'our loss'})`}
    </span>
  )
}

export function PayoutBadge({ status }: { status: string }) {
  const color = PAYOUT_COLORS[status] ?? '#94a3b8'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
      background: `${color}18`, color, border: `1px solid ${color}30`,
      textTransform: 'capitalize',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {status}
    </span>
  )
}
