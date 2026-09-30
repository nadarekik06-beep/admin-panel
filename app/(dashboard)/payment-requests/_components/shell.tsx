'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RED } from '../../sponsoring/_components/ui'
import type { RequestStatus } from '@/lib/paymentRequestsApi'
import { STATUS_LABELS } from '@/lib/paymentRequestsApi'

const TABS = [
  { href: '/payment-requests', label: 'Demandes' },
  { href: '/payment-requests/settings', label: 'Paramètres' },
]

export function PaymentsShell({ title, children }: { title: string; children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Paiements manuels via WhatsApp (D17 / virement) — recharges du portefeuille publicitaire et changements de plan.
        </p>
      </div>
      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const on = tab.href === '/payment-requests' ? path === tab.href : path?.startsWith(tab.href)
          return (
            <Link key={tab.href} href={tab.href} style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 800, textDecoration: 'none',
              background: on ? RED : 'rgba(255,255,255,.04)', color: on ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
            }}>{tab.label}</Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}

const STATUS_COLOR: Record<RequestStatus, string> = { pending: '#f59e0b', approved: '#4ade80', rejected: '#f87171', cancelled: '#94a3b8' }

export function RequestStatusChip({ status }: { status: RequestStatus }) {
  const c = STATUS_COLOR[status]
  return (
    <span style={{ fontSize: 11, fontWeight: 800, color: c, background: `${c}1a`, border: `1px solid ${c}40`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>
      {STATUS_LABELS[status]}
    </span>
  )
}
