'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, CheckCircle, EyeOff, Trash2 } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { productsApi } from '@/lib/api/products'
import { Product, PaginatedResponse } from '@/types'
import { format } from 'date-fns'

type ActionType = 'approve' | 'disable' | 'delete'

// ✅ Tunisian Dinar formatting
function formatCurrency(value: number) {
  return `${Number(value).toFixed(3)} DT`
}

// ✅ Derive status from real boolean columns (fallback if backend doesn't send it)
function deriveStatus(product: Product): string {
  if (product.status) return product.status
  if (!product.is_approved) return 'pending'
  if (!product.is_active)   return 'disabled'
  return 'approved'
}

export default function ProductsPage() {
  const [products, setProducts]           = useState<PaginatedResponse<Product> | null>(null)
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [status, setStatus]               = useState('pending')
  const [page, setPage]                   = useState(1)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [confirmModal, setConfirmModal]   = useState<{
    type: ActionType
    product: Product
  } | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productsApi.list({
        search: search || undefined,
        status: status || undefined,
        page,
      })
      setProducts(res)
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300)
    return () => clearTimeout(timer)
  }, [fetchProducts])

  const handleAction = async () => {
    if (!confirmModal) return
    setActionLoading(confirmModal.product.id)
    try {
      if (confirmModal.type === 'approve') await productsApi.approve(confirmModal.product.id)
      if (confirmModal.type === 'disable') await productsApi.disable(confirmModal.product.id)
      if (confirmModal.type === 'delete')  await productsApi.delete(confirmModal.product.id)
      setConfirmModal(null)
      fetchProducts()
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (row) => (
        <div>
          <p className="font-medium text-text-primary">{row.name}</p>
          <p className="text-xs text-text-muted">{row.category?.name ?? 'Uncategorized'}</p>
        </div>
      ),
    },
    {
      key: 'seller',
      header: 'Seller',
      render: (row) => (
        <span className="text-text-secondary text-sm">{row.seller?.name ?? '—'}</span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (row) => (
        <span className="font-medium text-text-primary">
          {formatCurrency(Number(row.price))}
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (row) => (
        <span className={`text-sm font-medium ${
          row.stock === 0
            ? 'text-accent-red'
            : row.stock < 10
            ? 'text-accent-orange'
            : 'text-text-secondary'
        }`}>
          {row.stock}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const s = deriveStatus(row)
        return (
          <Badge variant={s as 'pending' | 'approved' | 'disabled'}>
            {s}
          </Badge>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Added',
      render: (row) => (
        <span className="text-text-muted text-xs">
          {format(new Date(row.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const s = deriveStatus(row)
        return (
          <div className="flex items-center gap-2">
            {(s === 'pending' || s === 'disabled') && (
              <button
                onClick={() => setConfirmModal({ type: 'approve', product: row })}
                className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors"
                title="Approve"
              >
                <CheckCircle size={15} />
              </button>
            )}
            {s === 'approved' && (
              <button
                onClick={() => setConfirmModal({ type: 'disable', product: row })}
                className="p-1.5 rounded-md text-accent-orange hover:bg-accent-orange/10 transition-colors"
                title="Disable"
              >
                <EyeOff size={15} />
              </button>
            )}
            <button
              onClick={() => setConfirmModal({ type: 'delete', product: row })}
              className="p-1.5 rounded-md text-accent-red hover:bg-accent-red/10 transition-colors"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="Search products…"
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
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            Products
            {products && (
              <span className="ml-2 text-xs font-normal text-text-muted">
                ({products.total} total)
              </span>
            )}
          </h2>
        </div>

        <DataTable
          columns={columns}
          data={products?.data ?? []}
          loading={loading}
          emptyMessage="No products found."
          keyField="id"
        />

        {products && products.last_page > 1 && (
          <Pagination
            currentPage={products.current_page}
            lastPage={products.last_page}
            total={products.total}
            from={products.from}
            to={products.to}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* ── Confirm Modal ────────────────────────────────────── */}
      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={
          confirmModal?.type === 'approve' ? 'Approve Product' :
          confirmModal?.type === 'disable' ? 'Disable Product' :
          'Delete Product'
        }
        size="sm"
      >
        <p className="text-text-secondary text-sm mb-5">
          {confirmModal?.type === 'approve' &&
            `Approve "${confirmModal.product.name}" and make it visible on the platform?`}
          {confirmModal?.type === 'disable' &&
            `Disable "${confirmModal?.product.name}"? It will be hidden from customers.`}
          {confirmModal?.type === 'delete' &&
            `Permanently delete "${confirmModal?.product.name}"? This cannot be undone.`}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setConfirmModal(null)}
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
                : confirmModal?.type === 'disable'
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