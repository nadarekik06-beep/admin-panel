'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { OrderTrendPoint } from '@/types'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 shadow-card text-xs">
      <p className="text-text-muted mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-text-secondary capitalize">{p.name}:</span>
          <span className="font-medium text-text-primary">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ProductBarChart({ data }: { data: OrderTrendPoint[] }) {
  const formatted = data.map((d) => ({ ...d, month: d.month.slice(5) }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={10}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span className="text-text-secondary text-xs capitalize">{value}</span>
          )}
        />
        <Bar dataKey="delivered"  fill="#10b981" radius={[3, 3, 0, 0]} />
        <Bar dataKey="processing" fill="#06b6d4" radius={[3, 3, 0, 0]} />
        <Bar dataKey="pending"    fill="#f59e0b" radius={[3, 3, 0, 0]} />
        <Bar dataKey="canceled"   fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}