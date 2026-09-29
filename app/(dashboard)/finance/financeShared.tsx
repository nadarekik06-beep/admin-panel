// admin-panel/app/finance/financeShared.tsx
// Helpers shared by the Finance page and the order details drawer.

export function fmt(v: number | string) {
  return `${Number(v).toFixed(3)} DT`
}

// Every order has a real agency shipping cost; this is who covered it.
export const SHIPPING_PAYER: Record<string, { label: string; color: string }> = {
  customer: { label: 'Customer', color: '#3b82f6' },
  seller:   { label: 'Seller (free shipping)', color: '#f59e0b' },
  platform: { label: 'Platform', color: '#ef4444' },
}

const PAYOUT_COLORS: Record<string, string> = {
  pending:   '#f59e0b',
  ready:     '#3b82f6',
  paid:      '#10b981',
  cancelled: '#ef4444',
  draft:     '#a78bfa',
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
