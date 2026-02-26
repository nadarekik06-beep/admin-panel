'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CategoryPoint } from '@/types'

const COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#8b5cf6']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 shadow-card">
      <p className="text-text-primary text-sm font-medium">{payload[0]?.name}</p>
      <p className="text-text-muted text-xs">{payload[0]?.value} products</p>
    </div>
  )
}

export default function CategoryPieChart({ data }: { data: CategoryPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  const chartData = data.map((d) => ({
    name: d.name,
    value: d.count,
    percent: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          outerRadius={75}
          innerRadius={35}
          dataKey="value"
          paddingAngle={2}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value, entry: any) => (
            <span className="text-text-secondary text-xs">
              {value} <span className="text-text-muted">({entry.payload.percent}%)</span>
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}