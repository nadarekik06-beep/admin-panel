'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, AlertTriangle } from 'lucide-react'
import RevenueLineChart from '@/components/charts/RevenueLineChart'
import OrderPieChart from '@/components/charts/OrderPieChart'
import ProductBarChart from '@/components/charts/ProductBarChart'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import { statisticsApi } from '@/lib/api/statistics'
import { RevenuePoint, OrderTrendPoint, CategoryPoint } from '@/types'

interface StatsData {
  revenue: RevenuePoint[]
  orders: OrderTrendPoint[]
  categories: CategoryPoint[]
  users_growth: Array<{ month: string; users: number }>
}

export default function StatisticsPage() {
  const [data, setData]       = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    statisticsApi
      .getAll()
      .then(setData)
      .catch(() => setError('Failed to load statistics.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-bg-card border border-border rounded-xl h-72 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-accent-red gap-2">
        <AlertTriangle size={18} /> {error}
      </div>
    )
  }

  // Convert orders to distribution map for pie chart
  const orderStatusTotals = data.orders.reduce<Record<string, number>>(
    (acc, point) => {
      acc.pending    = (acc.pending    ?? 0) + point.pending
      acc.processing = (acc.processing ?? 0) + point.processing
      acc.delivered  = (acc.delivered  ?? 0) + point.delivered
      acc.canceled   = (acc.canceled   ?? 0) + point.canceled
      return acc
    },
    {}
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-text-primary">Revenue</h2>
              <p className="text-xs text-text-muted">Last 12 months</p>
            </div>
            <TrendingUp size={16} className="text-accent-purple-light" />
          </div>
          <RevenueLineChart data={data.revenue} />
        </div>

        {/* Order Status Distribution */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-text-primary">Order Status Distribution</h2>
            <p className="text-xs text-text-muted">All time</p>
          </div>
          <OrderPieChart data={orderStatusTotals} />
        </div>

        {/* Orders Trend */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-text-primary">Orders Trend</h2>
            <p className="text-xs text-text-muted">Last 6 months</p>
          </div>
          <ProductBarChart data={data.orders} />
        </div>

        {/* Category Distribution */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-text-primary">Category Distribution</h2>
            <p className="text-xs text-text-muted">By product count</p>
          </div>
          <CategoryPieChart data={data.categories} />
        </div>
      </div>
    </div>
  )
}