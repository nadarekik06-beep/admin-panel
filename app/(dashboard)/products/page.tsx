'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Search, CheckCircle, XCircle, EyeOff, Trash2,
  Eye, X, Loader2, Edit2, RotateCcw, AlertTriangle,
} from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import AdminEditProductModal from './AdminEditProductModal'
import ModerationActionModal from './ModerationActionModal'
import { STATUS_META } from './reviewUtils'
import { productsApi, ProductUpdatePayload } from '@/lib/api/products'
import { PaginatedResponse } from '@/types'
import { format } from 'date-fns'

type ActionType = 'approve' | 'disable' | 'delete' | 'force_delete'

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/api$/, '')

interface ProductImage {
  id: number
  image_path: string
  is_primary: boolean
  url?: string
}

interface AdminProduct {
  id: number
  name: string
  slug: string
  description: string | null
  short_description: string | null
  price: string | number
  stock: number
  sku: string | null
  is_approved: boolean
  is_active: boolean
  featured: boolean
  views: number
  status?: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
  primary_image_url: string | null
  rejection_reason?: string | null
  seller: { id: number; name: string; email: string } | null
  category: { id: number; name: string } | null
  images: ProductImage[]
}

function formatCurrency(value: string | number) {
  return `${Number(value).toFixed(3)} DT`
}

/**
 * Derives the display status from the product object.
 * Must mirror AdminProductController::deriveStatus() exactly.
 *
 * deleted_by_seller → soft-deleted (deleted_at set) with __deleted_by_seller__ marker
 * pending           → not approved, no rejection_reason (never reviewed)
 * rejected          → not approved, has rejection_reason
 * disabled          → approved, not active
 * approved          → approved, active
 */
function deriveStatus(product: AdminProduct): string {
  if (product.status) return product.status
  if (product.rejection_reason === '__deleted_by_seller__') return 'deleted_by_seller'
  if (!product.is_approved) {
    return product.rejection_reason ? 'rejected' : 'pending'
  }
  if (!product.is_active) return 'disabled'
  return 'approved'
}

function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  const clean = path.replace(/^\/storage\//, '').replace(/^\//, '')
  return `${API_URL}/storage/${clean}`
}

function Toast({ message, type, onClose }: {
  message: string; type: 'success' | 'error'; onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium
      ${type === 'success' ? 'bg-accent-green' : 'bg-accent-red'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
      {message}
    </div>
  )
}

export default function ProductsPage() {
  const [products, setProducts]           = useState<PaginatedResponse<AdminProduct> | null>(null)
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [status, setStatus]               = useState('pending')
  const [page, setPage]                   = useState(1)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const [toast, setToast]               = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ type: ActionType; product: AdminProduct } | null>(null)

  const [editProductId, setEditProductId] = useState<number | null>(null)

  const [moderation, setModeration] = useState<{ mode: 'reject' | 'request_changes'; product: AdminProduct } | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
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

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAction = async () => {
    if (!confirmModal) return
    setActionLoading(confirmModal.product.id)
    try {
      if (confirmModal.type === 'approve')      await productsApi.approve(confirmModal.product.id)
      if (confirmModal.type === 'disable')      await productsApi.disable(confirmModal.product.id)
      if (confirmModal.type === 'delete')       await productsApi.delete(confirmModal.product.id)
      if (confirmModal.type === 'force_delete') await productsApi.forceDelete(confirmModal.product.id)
      setConfirmModal(null)
      fetchProducts()
    } catch (err) {
      console.error('Action failed:', err)
      setToast({ message: 'Action failed. Please try again.', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRestore = async (product: AdminProduct) => {
    setActionLoading(product.id)
    try {
      await productsApi.restore(product.id)
      setToast({ message: 'Product restored to pending review.', type: 'success' })
      fetchProducts()
    } catch {
      setToast({ message: 'Failed to restore product.', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<AdminProduct>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-bg-hover flex-shrink-0">
            {row.primary_image_url ? (
              <img
                src={resolveImageUrl(row.primary_image_url) ?? ''}
                alt={row.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-text-primary">{row.name}</p>
            <p className="text-xs text-text-muted">{row.category?.name ?? 'Uncategorized'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'seller',
      header: 'Seller',
      render: (row) => <span className="text-text-secondary text-sm">{row.seller?.name ?? '—'}</span>,
    },
    {
      key: 'price',
      header: 'Price',
      render: (row) => <span className="font-medium text-text-primary">{formatCurrency(row.price)}</span>,
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (row) => (
        <span className={`text-sm font-medium ${
          row.stock === 0 ? 'text-accent-red' : row.stock < 10 ? 'text-accent-orange' : 'text-text-secondary'
        }`}>
          {row.stock}
          {row.stock === 0 && <span className="text-xs ml-1">(Out)</span>}
          {row.stock > 0 && row.stock <= 10 && <span className="text-xs ml-1">(Low)</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const s = deriveStatus(row)
        return (
          <div className="space-y-1">
            {s === 'deleted_by_seller' ? (
              // Special badge for deleted by seller — not in the standard Badge variants
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.25)',
                textTransform: 'capitalize',
              }}>
                🗑 Deleted by Seller
              </span>
            ) : (
              <Badge variant={STATUS_META[s as keyof typeof STATUS_META]?.badge ?? 'info'}>
                {STATUS_META[s as keyof typeof STATUS_META]?.label ?? s}
              </Badge>
            )}
            {/* Truncated reason shown inline under badge when rejected */}
            {s === 'rejected' && row.rejection_reason && row.rejection_reason !== '__deleted_by_seller__' && (
              <p
                className="text-[10px] text-accent-red/70 max-w-[140px] truncate"
                title={row.rejection_reason}
              >
                {row.rejection_reason}
              </p>
            )}
            {/* Deleted at timestamp */}
            {s === 'deleted_by_seller' && row.deleted_at && (
              <p className="text-[10px] text-text-muted">
                {format(new Date(row.deleted_at), 'MMM d, yyyy')}
              </p>
            )}
          </div>
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
          <div className="flex items-center gap-1.5">

            {/* View — always */}
            <Link
              href={`/products/${row.id}`}
              className="p-1.5 rounded-md text-text-muted hover:text-accent-purple-light hover:bg-accent-purple/10 transition-colors"
              title="Review details"
            >
              <Eye size={15} />
            </Link>

            {/* Edit — not for deleted_by_seller */}
            {s !== 'deleted_by_seller' && (
              <button
                onClick={() => setEditProductId(row.id)}
                className="p-1.5 rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                title="Edit product"
              >
                <Edit2 size={15} />
              </button>
            )}

            {/* ── PENDING: approve or reject ── */}
            {(s === 'pending' || s === 'changes_requested') && (
              <>
                <button
                  onClick={() => setConfirmModal({ type: 'approve', product: row })}
                  className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors"
                  title="Approve"
                >
                  <CheckCircle size={15} />
                </button>
                <button
                  onClick={() => setModeration({ mode: 'reject', product: row })}
                  className="p-1.5 rounded-md text-accent-red hover:bg-accent-red/10 transition-colors"
                  title="Reject with reason"
                >
                  <XCircle size={15} />
                </button>
              </>
            )}

            {/* ── REJECTED: approve only ── */}
            {s === 'rejected' && (
              <button
                onClick={() => setConfirmModal({ type: 'approve', product: row })}
                className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors"
                title="Approve & re-list"
              >
                <CheckCircle size={15} />
              </button>
            )}

            {/* ── DISABLED: approve ── */}
            {s === 'disabled' && (
              <button
                onClick={() => setConfirmModal({ type: 'approve', product: row })}
                className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors"
                title="Approve"
              >
                <CheckCircle size={15} />
              </button>
            )}

            {/* ── APPROVED: disable ── */}
            {s === 'approved' && (
              <button
                onClick={() => setConfirmModal({ type: 'disable', product: row })}
                className="p-1.5 rounded-md text-accent-orange hover:bg-accent-orange/10 transition-colors"
                title="Disable"
              >
                <EyeOff size={15} />
              </button>
            )}

            {/* ── DELETED BY SELLER: restore or permanently delete ── */}
            {s === 'deleted_by_seller' && (
              <>
                <button
                  onClick={() => handleRestore(row)}
                  disabled={actionLoading === row.id}
                  className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors disabled:opacity-50"
                  title="Restore to pending review"
                >
                  {actionLoading === row.id
                    ? <Loader2 size={15} className="animate-spin" />
                    : <RotateCcw size={15} />
                  }
                </button>
                <button
                  onClick={() => setConfirmModal({ type: 'force_delete', product: row })}
                  disabled={actionLoading === row.id}
                  className="p-1.5 rounded-md text-accent-red hover:bg-accent-red/10 transition-colors disabled:opacity-50"
                  title="Permanently delete"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}

            {/* Delete — for all statuses EXCEPT deleted_by_seller (they get force_delete instead) */}
            {s !== 'deleted_by_seller' && (
              <button
                onClick={() => setConfirmModal({ type: 'delete', product: row })}
                className="p-1.5 rounded-md text-accent-red hover:bg-accent-red/10 transition-colors"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            )}

          </div>
        )
      },
    },
  ]

  // ── Confirm modal labels ───────────────────────────────────────────────────
  const confirmTitle = () => {
    if (!confirmModal) return ''
    if (confirmModal.type === 'approve')      return 'Approve Product'
    if (confirmModal.type === 'disable')      return 'Disable Product'
    if (confirmModal.type === 'force_delete') return 'Permanently Delete Product'
    return 'Delete Product'
  }

  const confirmBody = () => {
    if (!confirmModal) return ''
    if (confirmModal.type === 'approve')
      return `Approve "${confirmModal.product.name}" and make it visible to customers?`
    if (confirmModal.type === 'disable')
      return `Disable "${confirmModal.product.name}"? It will be hidden from customers.`
    if (confirmModal.type === 'force_delete')
      return `Permanently delete "${confirmModal.product.name}"? This product was deleted by the seller. This action cannot be undone and will remove all product data.`
    return `Permanently delete "${confirmModal.product.name}"? This cannot be undone.`
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── Deleted by seller info banner (shown when that tab is active) ── */}
      {status === 'deleted_by_seller' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, padding: '12px 16px',
        }}>
          <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', margin: '0 0 3px' }}>
              Products deleted by sellers
            </p>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              These products were removed by their sellers but had existing orders, so they were soft-deleted to preserve order history.
              You can <strong style={{ color: '#f1f5f9' }}>restore</strong> them back to pending review, or <strong style={{ color: '#ef4444' }}>permanently delete</strong> them if no longer needed.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
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
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="changes_requested">Changes requested</option>
            <option value="rejected">Rejected</option>
            <option value="approved">Approved</option>
            <option value="disabled">Disabled</option>
            <option value="deleted_by_seller">🗑 Deleted by Seller</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            {status === 'deleted_by_seller' ? '🗑 Deleted by Seller' : 'Products'}
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
          emptyMessage={
            status === 'deleted_by_seller'
              ? 'No seller-deleted products.'
              : 'No products found.'
          }
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

      {/* ── Confirm modal (approve / disable / delete / force_delete) ── */}
      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmTitle()}
        size="sm"
      >
        <p className="text-text-secondary text-sm mb-5">
          {confirmBody()}
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

      {/* ── Reject / request changes (reasons required) ── */}
      <ModerationActionModal
        open={!!moderation}
        mode={moderation?.mode ?? 'reject'}
        product={moderation?.product ?? null}
        onClose={() => setModeration(null)}
        onDone={(message) => {
          setModeration(null)
          setToast({ message, type: 'success' })
          fetchProducts()
        }}
      />

      {/* ── Admin Edit Product Modal ── */}
      {editProductId !== null && (
        <AdminEditProductModal
          productId={editProductId}
          onClose={() => setEditProductId(null)}
          onSaved={() => {
            setEditProductId(null)
            setToast({ message: 'Product updated successfully.', type: 'success' })
            fetchProducts()
          }}
        />
      )}

    </div>
  )
}