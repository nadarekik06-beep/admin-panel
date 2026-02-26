'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { RevenuePoint } from '@/types'

// ✅ DT tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 shadow-card">
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <p className="text-accent-purple-light font-semibold text-sm">
        {Number(payload[0]?.value ?? 0).toLocaleString('fr-TN', {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })} DT
      </p>
    </div>
  )
}

export default function RevenueLineChart({ data }: { data: RevenuePoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    month: d.month.slice(5), // "2024-03" → "03"
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          // ✅ DT axis labels
          tickFormatter={(v) =>
            v >= 1000
              ? `${(v / 1000).toFixed(0)}k`
              : `${v}`
          }
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#7c3aed"
          strokeWidth={2.5}
          dot={{ fill: '#7c3aed', strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, fill: '#a78bfa' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}