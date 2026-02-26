'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  Store,
  Package,
  ShoppingCart,
  Banknote,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import KPICard from '@/components/ui/KPICard'
import Badge from '@/components/ui/Badge'
import RevenueLineChart from '@/components/charts/RevenueLineChart'
import OrderPieChart from '@/components/charts/OrderPieChart'
import { dashboardApi } from '@/lib/api/dashboard'
import { DashboardData, Order } from '@/types'
import { format } from 'date-fns'

// ✅ Tunisian Dinar — 3 decimal places
function formatDT(value: number): string {
  return `${Number(value).toLocaleString('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} DT`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export default function DashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    dashboardApi
      .getStats()
      .then(setData)
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-bg-card border border-border rounded-xl h-72 animate-pulse" />
          <div className="bg-bg-card border border-border rounded-xl h-72 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-accent-red gap-2">
        <AlertTriangle size={18} /> {error || 'No data available.'}
      </div>
    )
  }

  const { kpis, order_status_distribution, monthly_revenue, recent_orders } = data

  return (
    <div className="space-y-6">

      {/* ── Primary KPI Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={formatDT(kpis.total_revenue)}
          icon={Banknote}        // ✅ replaced DollarSign with Banknote
          gradient="purple"
          trend={{ value: 12.5, label: 'vs last month' }}
        />
        <KPICard
          title="Total Users"
          value={formatNumber(kpis.total_users)}
          icon={Users}
          gradient="cyan"
        />
        <KPICard
          title="Total Orders"
          value={formatNumber(kpis.total_orders)}
          icon={ShoppingCart}
          gradient="green"
        />
        <KPICard
          title="Total Products"
          value={formatNumber(kpis.total_products)}
          icon={Package}
          gradient="orange"
        />
      </div>

      {/* ── Secondary KPI Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Total Sellers"
          value={formatNumber(kpis.total_sellers)}
          icon={Store}
          gradient="purple"
        />
        <KPICard
          title="Pending Sellers"
          value={kpis.pending_seller_approvals}
          subtitle="Awaiting approval"
          icon={Clock}
          gradient="orange"
        />
        <KPICard
          title="Pending Products"
          value={kpis.pending_product_approvals}
          subtitle="Awaiting moderation"
          icon={AlertTriangle}
          gradient="cyan"
        />
      </div>

      {/* ── Charts Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue line chart */}
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Revenue Overview</h2>
              <p className="text-xs text-text-muted">Last 6 months · DT</p>
            </div>
            <TrendingUp size={18} className="text-accent-purple-light" />
          </div>
          <RevenueLineChart data={monthly_revenue} />
        </div>

        {/* Order status pie */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-text-primary">Order Status</h2>
            <p className="text-xs text-text-muted">Distribution</p>
          </div>
          <OrderPieChart data={order_status_distribution} />
        </div>
      </div>

      {/* ── Recent Orders ────────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Recent Orders</h2>
          <a
            href="/orders"
            className="text-xs text-accent-purple-light hover:underline transition-colors"
          >
            View all →
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent_orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-text-muted text-sm">
                    No recent orders found.
                  </td>
                </tr>
              ) : (
                recent_orders.map((order: Order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-bg-hover/50 transition-colors"
                  >
                    <td className="px-5 py-3 font-mono text-text-secondary text-xs">
                      #{order.order_number ?? order.id}
                    </td>
                    <td className="px-5 py-3 text-text-primary">
                      {order.user?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={
                          order.status as
                            | 'pending'
                            | 'processing'
                            | 'delivered'
                            | 'canceled'
                        }
                      >
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-medium text-text-primary">
                      {/* ✅ DT formatting */}
                      {formatDT(Number(order.total_amount))}
                    </td>
                    <td className="px-5 py-3 text-text-muted text-xs">
                      {format(new Date(order.created_at), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}