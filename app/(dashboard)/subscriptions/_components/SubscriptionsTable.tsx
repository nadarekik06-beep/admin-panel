'use client'

import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import Pagination from '@/components/ui/Pagination'
import type { PaginatedResponse } from '@/types'
import type { Plan, SellerSubscriptionRow } from '@/types/subscriptions'
import { PlanBadge, StatusBadge, SourceBadge, inputCls } from './ui'

export interface TableFilters {
  search: string
  plan: string
  status: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

const STATUS_OPTIONS = [
  ['', 'All statuses'], ['active', 'Active'], ['trial', 'Trial'], ['expiring_soon', 'Expiring soon (7 days)'],
  ['grace_period', 'Grace period'], ['expired', 'Expired'], ['suspended', 'Suspended'], ['cancelled', 'Cancelled'],
  ['has_override', 'Has commission override'],
]

export default function SubscriptionsTable({ data, loading, plans, filters, onChange, onOpen }: {
  data: PaginatedResponse<SellerSubscriptionRow> | null
  loading: boolean
  plans: Plan[]
  filters: TableFilters
  onChange: (f: Partial<TableFilters>) => void
  onOpen: (row: SellerSubscriptionRow) => void
}) {
  const sortBy = (key: string) =>
    onChange({ sort: key, dir: filters.sort === key && filters.dir === 'asc' ? 'desc' : 'asc', page: 1 })

  const SortIcon = ({ k }: { k: string }) =>
    filters.sort !== k ? <ArrowUpDown size={11} className="opacity-40" /> : filters.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />

  const th = 'text-left text-[10px] font-bold uppercase tracking-widest text-text-muted px-4 py-2.5 whitespace-nowrap'
  const sortable = (k: string, label: string) => (
    <th className={th}>
      <button onClick={() => sortBy(k)} className="inline-flex items-center gap-1 hover:text-text-primary uppercase tracking-widest">
        {label} <SortIcon k={k} />
      </button>
    </th>
  )

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            placeholder="Search seller name, email or store…"
            className={clsx(inputCls, 'pl-9')}
          />
        </div>
        <select value={filters.plan} onChange={(e) => onChange({ plan: e.target.value, page: 1 })} className={clsx(inputCls, 'lg:w-48')}>
          <option value="">All plans</option>
          {plans.map((p) => <option key={p.slug} value={p.slug}>{p.name}{p.archived_at ? ' (archived)' : ''}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => onChange({ status: e.target.value, page: 1 })} className={clsx(inputCls, 'lg:w-56')}>
          {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="border-b border-border">
            <tr>
              {sortable('seller', 'Seller')}
              {sortable('plan', 'Plan')}
              {sortable('status', 'Status')}
              {sortable('end_date', 'Period ends')}
              <th className={th}>Commission</th>
              <th className={th}>Products</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={7} className="px-4 py-3"><div className="h-8 rounded bg-bg-hover animate-pulse" /></td>
                </tr>
              ))
            ) : (data?.data ?? []).length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-text-muted">No subscriptions match these filters.</td></tr>
            ) : (
              data!.data.map((row) => (
                <tr key={row.id} onClick={() => onOpen(row)}
                  className={clsx('border-b border-border last:border-0 cursor-pointer hover:bg-bg-hover/40 transition-colors', loading && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{row.business_name || row.seller_name}</p>
                    <p className="text-xs text-text-muted">{row.seller_name} · {row.seller_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <PlanBadge name={row.plan.name} color={row.plan.color} tierKey={row.plan.tier_key} />
                      {row.pending && (
                        <span className="text-[10px] text-accent-orange">→ {row.pending.name} at period end</span>
                      )}
                      {row.billing_period === 'yearly' && <span className="text-[10px] text-text-muted">yearly</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                    {row.expiring_soon && (
                      <p className="mt-1 text-[10px] text-accent-orange inline-flex items-center gap-1"><AlertTriangle size={10} /> expiring soon</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.billing_cycle_end ? (
                      <>
                        <p className="text-text-primary tabular-nums">{row.billing_cycle_end}</p>
                        <p className={clsx('tabular-nums', row.days_remaining <= 7 ? 'text-accent-orange' : 'text-text-muted')}>
                          {row.status === 'grace_period' ? 'grace' : `${row.days_remaining}d left`}
                        </p>
                      </>
                    ) : <span className="text-text-muted">No end date</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs text-text-primary">{row.commission.rate !== null ? `${row.commission.rate}%` : `${row.commission.range?.min}–${row.commission.range?.max}%`}</span>
                      <SourceBadge source={row.commission.source} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    <span className="text-text-primary">{row.products?.visible ?? 0}</span>
                    <span className="text-text-muted"> / {row.max_products ?? '∞'}</span>
                    {(row.products?.hidden ?? 0) > 0 && <p className="text-accent-orange">{row.products!.hidden} hidden</p>}
                  </td>
                  <td className="px-4 py-3 text-right"><ChevronRight size={16} className="text-text-muted inline" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.last_page > 1 && (
        <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} from={data.from} to={data.to}
          onPageChange={(page) => onChange({ page })} />
      )}
    </div>
  )
}
