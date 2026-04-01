'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
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

// ── Animation variants ─────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' },
  }),
}

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: 'easeOut' },
  }),
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
      {/* FIX: [&>*]:h-28 forces every card to the same fixed height */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 [&>*]:h-28">
        {[
          { title: 'Total Revenue',  value: formatDT(kpis.total_revenue),      icon: Banknote,     gradient: 'purple', trend: { value: 12.5, label: 'vs last month' } },
          { title: 'Total Users',    value: formatNumber(kpis.total_users),     icon: Users,        gradient: 'cyan',   trend: undefined },
          { title: 'Total Orders',   value: formatNumber(kpis.total_orders),    icon: ShoppingCart, gradient: 'green',  trend: undefined },
          { title: 'Total Products', value: formatNumber(kpis.total_products),  icon: Package,      gradient: 'orange', trend: undefined },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="h-full"
          >
            <KPICard
              title={card.title}
              value={card.value}
              icon={card.icon}
              gradient={card.gradient as any}
              trend={card.trend as any}
            />
          </motion.div>
        ))}
      </div>

      {/* ── Secondary KPI Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
        {[
          { title: 'Total Sellers',    value: formatNumber(kpis.total_sellers),  icon: Store,         gradient: 'purple', subtitle: undefined },
          { title: 'Pending Sellers',  value: kpis.pending_seller_approvals,     icon: Clock,         gradient: 'orange', subtitle: 'Awaiting approval' },
          { title: 'Pending Products', value: kpis.pending_product_approvals,    icon: AlertTriangle, gradient: 'cyan',   subtitle: 'Awaiting moderation' },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            custom={i + 4}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -4, transition: { duration: 0.3 } }}
            className="h-full"
          >
            <KPICard
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon}
              gradient={card.gradient as any}
            />
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue line chart */}
        <motion.div
          className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-5"
          custom={7}
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Revenue Overview</h2>
              <p className="text-xs text-text-muted">Last 6 months · DT</p>
            </div>
            <TrendingUp size={18} className="text-accent-purple-light" />
          </div>
          <RevenueLineChart data={monthly_revenue} />
        </motion.div>

        {/* Order status pie */}
        <motion.div
          className="bg-bg-card border border-border rounded-xl p-5"
          custom={8}
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold text-text-primary">Order Status</h2>
            <p className="text-xs text-text-muted">Distribution</p>
          </div>
          <OrderPieChart data={order_status_distribution} />
        </motion.div>
      </div>

      {/* ── Recent Orders ────────────────────────────────────── */}
      <motion.div
        className="bg-bg-card border border-border rounded-xl overflow-hidden"
        custom={9}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
      >
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
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">Order ID</th>
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">Customer</th>
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 text-left text-xs text-text-muted uppercase tracking-wider">Date</th>
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
                recent_orders.map((order: Order, i: number) => (
                  <motion.tr
                    key={order.id}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
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
                        variant={order.status as 'pending' | 'processing' | 'delivered' | 'canceled'}
                      >
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-medium text-text-primary">
                      {formatDT(Number(order.total_amount))}
                    </td>
                    <td className="px-5 py-3 text-text-muted text-xs">
                      {format(new Date(order.created_at), 'MMM d, yyyy')}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}