'use client'

/**
 * Admin — Subscriptions
 *
 *   Seller subscriptions : search / filter / sort, per-seller drawer with every
 *                          admin action (plan, dates, trial, commission, status)
 *                          and the full audit history
 *   Plans                : create / edit / activate / archive plans, limits, features
 *   Default commission   : platform tier table used when no plan rate / override applies
 */

import { useCallback, useEffect, useState } from 'react'
import { Users, Layers, Percent } from 'lucide-react'
import clsx from 'clsx'
import type { PaginatedResponse } from '@/types'
import type { PlansPayload, SellerSubscriptionRow, SubscriptionStats } from '@/types/subscriptions'
import { subscriptionsApi, plansApi, apiError } from '@/lib/api/subscriptions'
import SubscriptionKpis from './_components/SubscriptionKpis'
import SubscriptionsTable, { type TableFilters } from './_components/SubscriptionsTable'
import SubscriptionDrawer from './_components/SubscriptionDrawer'
import PlansManager from './_components/PlansManager'
import DefaultCommission from './_components/DefaultCommission'
import { Toast } from './_components/ui'

type Tab = 'sellers' | 'plans' | 'commission'

export default function SubscriptionsPage() {
  const [tab, setTab]             = useState<Tab>('sellers')
  const [stats, setStats]         = useState<SubscriptionStats | null>(null)
  const [plans, setPlans]         = useState<PlansPayload | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [rows, setRows]           = useState<PaginatedResponse<SellerSubscriptionRow> | null>(null)
  const [loading, setLoading]     = useState(true)
  const [filters, setFilters]     = useState<TableFilters>({ search: '', plan: '', status: '', sort: '', dir: 'desc', page: 1 })
  const [openSeller, setOpenSeller] = useState<number | null>(null)
  const [toast, setToast]         = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Deep link: /subscriptions?seller=ID opens that seller's drawer
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('seller'))
    if (id) setOpenSeller(id)
  }, [])

  const loadStats = useCallback(() => {
    subscriptionsApi.stats().then(setStats).catch((err) => setToast({ message: apiError(err, 'Could not load KPIs.'), type: 'error' }))
  }, [])

  const loadPlans = useCallback(() => {
    plansApi.list(showArchived).then(setPlans).catch((err) => setToast({ message: apiError(err, 'Could not load plans.'), type: 'error' }))
  }, [showArchived])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await subscriptionsApi.list({
        search: filters.search || undefined,
        plan: filters.plan || undefined,
        status: filters.status || undefined,
        sort: filters.sort || undefined,
        dir: filters.dir,
        page: filters.page,
      }))
    } catch (err) {
      // Previously errors were swallowed and the page silently showed "No subscriptions"
      setToast({ message: apiError(err, 'Could not load subscriptions.'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadPlans() }, [loadPlans])
  useEffect(() => { const t = setTimeout(loadRows, filters.search ? 300 : 0); return () => clearTimeout(t) }, [loadRows, filters.search])

  const refreshAll = (message: string) => {
    setToast({ message, type: 'success' })
    loadStats(); loadPlans(); loadRows()
  }
  const showError = useCallback((message: string) => setToast({ message, type: 'error' }), [])
  const closeDrawer = useCallback(() => setOpenSeller(null), [])

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'sellers', label: 'Seller subscriptions', icon: Users },
    { key: 'plans', label: 'Plans', icon: Layers },
    { key: 'commission', label: 'Default commission', icon: Percent },
  ]

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <SubscriptionKpis stats={stats} onFilter={(status) => { setTab('sellers'); setFilters((f) => ({ ...f, status, page: 1 })) }} />

      <div className="flex overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.key ? 'border-accent-red text-text-primary font-medium' : 'border-transparent text-text-muted hover:text-text-secondary')}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'sellers' && (
        <SubscriptionsTable
          data={rows}
          loading={loading}
          plans={plans?.plans ?? []}
          filters={filters}
          onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
          onOpen={(row) => setOpenSeller(row.user_id)}
        />
      )}

      {tab === 'plans' && (
        <PlansManager data={plans} showArchived={showArchived} onShowArchived={setShowArchived} onChanged={refreshAll} onError={showError} />
      )}

      {tab === 'commission' && (
        <DefaultCommission table={plans?.commission_default ?? null} plans={plans?.plans ?? []} onChanged={refreshAll} onError={showError} />
      )}

      <SubscriptionDrawer
        sellerId={openSeller}
        plans={plans?.plans ?? []}
        onClose={closeDrawer}
        onChanged={refreshAll}
        onError={showError}
      />
    </div>
  )
}
