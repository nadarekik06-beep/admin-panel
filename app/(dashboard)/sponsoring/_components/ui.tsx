'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CampaignStatus } from '@/lib/adsAdminApi'

export const RED = '#db142e'
export const GREEN = '#198f41'
export const GOLD = '#f59e0b'

export const card: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, boxShadow: 'var(--shadow-card)', minWidth: 0,
}
export const input: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}

export function Btn({ children, onClick, tone = 'ghost', disabled, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; tone?: 'ghost' | 'red' | 'green' | 'gold'; disabled?: boolean; type?: 'button' | 'submit'
}) {
  const c = { ghost: 'var(--text-secondary)', red: '#f87171', green: '#4ade80', gold: GOLD }[tone]
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 800,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'inherit',
      background: tone === 'ghost' ? 'rgba(255,255,255,.04)' : `${c}1a`, border: `1px solid ${tone === 'ghost' ? 'var(--border-subtle)' : `${c}55`}`, color: c,
    }}>{children}</button>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 900, color: tone ?? 'var(--text-primary)', margin: '6px 0 0' }}>{value}</p>
      {hint && <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  )
}

const STATUS: Record<CampaignStatus, string> = {
  draft: '#94a3b8', active: '#4ade80', paused: GOLD, completed: '#60a5fa', cancelled: '#94a3b8', rejected: '#f87171', expired: '#94a3b8',
}
export function StatusChip({ status, reason }: { status: CampaignStatus; reason?: string | null }) {
  const c = STATUS[status] ?? '#94a3b8'
  return (
    <span title={reason ?? undefined} style={{ fontSize: 11, fontWeight: 800, color: c, background: `${c}1a`, border: `1px solid ${c}40`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
      {status}{reason ? ` · ${reason.replace(/_/g, ' ')}` : ''}
    </span>
  )
}

const TABS = [
  { href: '/sponsoring', label: 'Overview' },
  { href: '/sponsoring/campaigns', label: 'Campaigns' },
  { href: '/sponsoring/wallets', label: 'Wallets & top-ups' },
  { href: '/sponsoring/settings', label: 'Settings' },
]

export function SponsoringShell({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const path = usePathname()
  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
        {actions}
      </div>
      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const on = tab.href === '/sponsoring' ? path === tab.href : path?.startsWith(tab.href)
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

export function Notice({ tone, children }: { tone: 'ok' | 'error' | 'info'; children: React.ReactNode }) {
  const c = { ok: '#4ade80', error: '#f87171', info: '#60a5fa' }[tone]
  return <div role={tone === 'error' ? 'alert' : 'status'} style={{ background: `${c}14`, border: `1px solid ${c}40`, color: c, borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{children}</div>
}
