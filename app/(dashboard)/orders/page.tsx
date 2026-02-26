'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import { ordersApi } from '@/lib/api/orders'
import { Order, PaginatedResponse, OrderStatus } from '@/types'
import { format } from 'date-fns'

function formatCurrency(v: number) {
  return `${Number(v).toFixed(3)} DT`
}

export default function OrdersPage() {
  const [orders, setOrders]   = useState<PaginatedResponse<Order> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [page, setPage]         = useState(1)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ordersApi.list({
        search: search || undefined,
        status: status || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
      })
      setOrders(res)
    } finally {
      setLoading(false)
    }
  }, [search, status, dateFrom, dateTo, page])

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 300)
    return () => clearTimeout(timer)
  }, [fetchOrders])

  const columns: Column<Order>[] = [
    {
      key: 'id',
      header: 'Order ID',
      render: (row) => (
        <span className="font-mono text-xs text-text-secondary">#{row.id}</span>
      ),
    },
    {
      key: 'user',
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-medium text-text-primary">{row.user?.name ?? '—'}</p>
          <p className="text-xs text-text-muted">{row.user?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status as OrderStatus}>{row.status}</Badge>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total',
      render: (row) => (
        <span className="font-semibold text-text-primary">{formatCurrency(row.total_amount)}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => (
        <span className="text-text-muted text-xs">
          {format(new Date(row.created_at), 'MMM d, yyyy · HH:mm')}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by customer or order ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-bg-primary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple transition-colors"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-muted focus:outline-none focus:border-accent-purple transition-colors"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-muted focus:outline-none focus:border-accent-purple transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            Orders
            {orders && (
              <span className="ml-2 text-xs font-normal text-text-muted">
                ({orders.total} total)
              </span>
            )}
          </h2>
        </div>

        <DataTable
          columns={columns}
          data={orders?.data ?? []}
          loading={loading}
          emptyMessage="No orders found."
          keyField="id"
        />

        {orders && orders.last_page > 1 && (
          <Pagination
            currentPage={orders.current_page}
            lastPage={orders.last_page}
            total={orders.total}
            from={orders.from}
            to={orders.to}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}