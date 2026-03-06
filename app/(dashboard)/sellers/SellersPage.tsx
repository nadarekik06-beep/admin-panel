'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, CheckCircle, XCircle, PauseCircle } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { sellersApi } from '@/lib/api/sellers'
import { Seller, PaginatedResponse } from '@/types'
import { format } from 'date-fns'

type ActionType = 'approve' | 'reject' | 'suspend'

function getSellerStatus(seller: Seller): 'pending' | 'approved' | 'suspended' {
  if (!seller.is_active)  return 'suspended'
  if (seller.is_approved) return 'approved'
  return 'pending'
}

export default function SellersPage() {
  const [sellers, setSellers]             = useState<PaginatedResponse<Seller> | null>(null)
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [status, setStatus]               = useState('')   // '' = All sellers
  const [page, setPage]                   = useState(1)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [rejectReason, setRejectReason]   = useState('')
  const [confirmModal, setConfirmModal]   = useState<{
    type: ActionType
    seller: Seller
  } | null>(null)

  const fetchSellers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await sellersApi.list({
        search: search || undefined,
        status: status || undefined,
        page,
      })
      setSellers(res)
    } catch (err) {
      console.error('Failed to fetch sellers:', err)
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => {
    const timer = setTimeout(fetchSellers, 300)
    return () => clearTimeout(timer)
  }, [fetchSellers])

  const handleAction = async () => {
    if (!confirmModal) return
    setActionLoading(confirmModal.seller.id)
    try {
      if (confirmModal.type === 'approve') await sellersApi.approve(confirmModal.seller.id)
      if (confirmModal.type === 'reject')  await sellersApi.reject(confirmModal.seller.id, rejectReason)
      if (confirmModal.type === 'suspend') await sellersApi.suspend(confirmModal.seller.id)
      setConfirmModal(null)
      setRejectReason('')
      fetchSellers()
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const columns: Column<Seller>[] = [
    {
      key: 'name',
      header: 'Seller',
      render: (row) => (
        <div>
          <p className="font-medium text-text-primary">{row.name}</p>
          <p className="text-xs text-text-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'is_approved',
      header: 'Status',
      render: (row) => {
        const s = getSellerStatus(row)
        return <Badge variant={s}>{s}</Badge>
      },
    },
    {
      key: 'products_count',
      header: 'Products',
      render: (row) => (
        <span className="text-text-secondary">{row.products_count ?? 0}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (row) => (
        // Safe: this component is client-only (ssr:false), no hydration mismatch
        <span className="text-text-muted text-xs">
          {format(new Date(row.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const s = getSellerStatus(row)
        return (
          <div className="flex items-center gap-2">
            {(s === 'pending' || s === 'suspended') && (
              <button
                onClick={() => setConfirmModal({ type: 'approve', seller: row })}
                className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors"
                title="Approve"
              >
                <CheckCircle size={15} />
              </button>
            )}
            {s === 'pending' && (
              <button
                onClick={() => setConfirmModal({ type: 'reject', seller: row })}
                className="p-1.5 rounded-md text-accent-red hover:bg-accent-red/10 transition-colors"
                title="Reject"
              >
                <XCircle size={15} />
              </button>
            )}
            {s === 'approved' && (
              <button
                onClick={() => setConfirmModal({ type: 'suspend', seller: row })}
                className="p-1.5 rounded-md text-accent-orange hover:bg-accent-orange/10 transition-colors"
                title="Suspend"
              >
                <PauseCircle size={15} />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search sellers…"
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
            <option value="">All Sellers</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            Sellers
            {sellers && (
              <span className="ml-2 text-xs font-normal text-text-muted">
                ({sellers.total} total)
              </span>
            )}
          </h2>
        </div>

        <DataTable
          columns={columns}
          data={sellers?.data ?? []}
          loading={loading}
          emptyMessage="No sellers found."
          keyField="id"
        />

        {sellers && sellers.last_page > 1 && (
          <Pagination
            currentPage={sellers.current_page}
            lastPage={sellers.last_page}
            total={sellers.total}
            from={sellers.from}
            to={sellers.to}
            onPageChange={setPage}
          />
        )}
      </div>

      <Modal
        open={!!confirmModal}
        onClose={() => { setConfirmModal(null); setRejectReason('') }}
        title={
          confirmModal?.type === 'approve' ? 'Approve Seller' :
          confirmModal?.type === 'reject'  ? 'Reject Seller'  :
          'Suspend Seller'
        }
        size="sm"
      >
        <p className="text-text-secondary text-sm mb-4">
          {confirmModal?.type === 'approve' &&
            `Approve "${confirmModal.seller.name}" as a seller on the platform?`}
          {confirmModal?.type === 'reject' &&
            `Reject "${confirmModal?.seller.name}"'s seller account?`}
          {confirmModal?.type === 'suspend' &&
            `Suspend "${confirmModal?.seller.name}"? They won't be able to sell.`}
        </p>

        {confirmModal?.type === 'reject' && (
          <textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple mb-4 resize-none transition-colors"
          />
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => { setConfirmModal(null); setRejectReason('') }}
            className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleAction}
            disabled={!!actionLoading}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60 ${
              confirmModal?.type === 'approve'
                ? 'bg-accent-green hover:bg-accent-green/90'
                : confirmModal?.type === 'suspend'
                ? 'bg-accent-orange hover:bg-accent-orange/90'
                : 'bg-accent-red hover:bg-accent-red/90'
            }`}
          >
            {actionLoading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </Modal>
    </div>
  )
}