'use client'

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Users, FlaskConical, CalendarClock, CalendarX, Wallet, Percent } from 'lucide-react'
import type { SubscriptionStats } from '@/types/subscriptions'
import { formatDT } from './ui'

function Card({ icon: Icon, label, value, sub, tone, onClick }: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode
  tone: 'green' | 'cyan' | 'orange' | 'red' | 'purple'; onClick?: () => void
}) {
  const toneCls = {
    green: 'bg-accent-green/15 text-accent-green', cyan: 'bg-accent-cyan/15 text-accent-cyan',
    orange: 'bg-accent-orange/15 text-accent-orange', red: 'bg-accent-red/15 text-accent-red',
    purple: 'bg-accent-purple/15 text-accent-purple-light',
  }[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className="text-left bg-bg-card border border-border rounded-xl p-4 hover:border-border-light transition-colors w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-text-muted">{label}</p>
          <p className="text-xl font-bold text-text-primary mt-1 tabular-nums">{value}</p>
          {sub && <div className="text-[11px] text-text-muted mt-1">{sub}</div>}
        </div>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${toneCls}`}><Icon size={17} /></span>
      </div>
    </Tag>
  )
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 shadow-card text-xs space-y-1">
      <p className="text-text-muted">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="font-medium text-text-primary">{p.dataKey === 'new_paid' ? p.value : formatDT(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function SubscriptionKpis({ stats, onFilter }: { stats: SubscriptionStats | null; onFilter: (status: string) => void }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[92px] bg-bg-card border border-border rounded-xl animate-pulse" />)}
      </div>
    )
  }
  const totalActive = stats.per_plan.reduce((n, p) => n + p.count, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card icon={Users} tone="green" label="Active subscriptions" value={totalActive}
          sub={<span className="flex flex-wrap gap-x-2">{stats.per_plan.filter((p) => p.count > 0 || !p.archived).map((p) => (
            <span key={p.slug}><span style={{ color: p.color }}>●</span> {p.name.replace(' Pepper', '')} {p.count}</span>
          ))}</span>} />
        <Card icon={FlaskConical} tone="cyan" label="Trials" value={stats.trials} onClick={() => onFilter('trial')} sub="click to filter" />
        <Card icon={CalendarClock} tone="orange" label="Expiring this week" value={stats.expiring_this_week} onClick={() => onFilter('expiring_soon')}
          sub={stats.grace_period > 0 ? `${stats.grace_period} in grace period` : 'next 7 days'} />
        <Card icon={CalendarX} tone="red" label="Expired" value={stats.expired} onClick={() => onFilter('expired')}
          sub={stats.suspended > 0 ? `${stats.suspended} suspended` : 'moved to default plan'} />
        <Card icon={Wallet} tone="purple" label="Monthly recurring revenue" value={formatDT(stats.mrr, 0)}
          sub={`${formatDT(stats.revenue_this_month, 0)} collected this month`} />
        <Card icon={Percent} tone="green" label="Commission this month" value={formatDT(stats.commission_this_month, 0)}
          sub={stats.overrides > 0 ? `${stats.overrides} seller override(s) active` : 'from seller orders'} />
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-text-primary">Revenue over the last 12 months</p>
          <p className="text-[11px] text-text-muted">Subscriptions paid · commission earned · new paid plans</p>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={stats.chart} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="dt" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="n" orientation="right" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend formatter={(v) => <span className="text-text-secondary text-xs">{v}</span>} />
            <Bar yAxisId="dt" dataKey="subscription_revenue" name="Subscriptions (DT)" fill="#db142e" radius={[3, 3, 0, 0]} barSize={12} />
            <Bar yAxisId="dt" dataKey="commission" name="Commission (DT)" fill="#198f41" radius={[3, 3, 0, 0]} barSize={12} />
            <Line yAxisId="n" type="monotone" dataKey="new_paid" name="New paid plans" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
