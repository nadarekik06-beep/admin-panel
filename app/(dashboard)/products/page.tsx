'use client'

/**
 * app/(dashboard)/products/page.tsx — Admin Panel
 * Added: Edit button → AdminEditProductModal
 * Everything else unchanged.
 */

import { useEffect, useState, useCallback } from 'react'
import { Search, CheckCircle, EyeOff, Trash2, Eye, Pencil, X, Save, Loader2, Edit2 } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import AdminEditProductModal from './AdminEditProductModal'
import { productsApi, ProductUpdatePayload } from '@/lib/api/products'
import { PaginatedResponse } from '@/types'
import { format } from 'date-fns'

type ActionType = 'approve' | 'disable' | 'delete'

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
  primary_image_url: string | null
  seller: { id: number; name: string; email: string } | null
  category: { id: number; name: string } | null
  images: ProductImage[]
}

function formatCurrency(value: string | number) {
  return `${Number(value).toFixed(3)} DT`
}

function deriveStatus(product: AdminProduct): string {
  if (product.status) return product.status
  if (!product.is_approved) return 'pending'
  if (!product.is_active)   return 'disabled'
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

  const [viewProduct, setViewProduct]     = useState<AdminProduct | null>(null)
  const [toast, setToast]                 = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmModal, setConfirmModal]   = useState<{ type: ActionType; product: AdminProduct } | null>(null)

  // ── NEW: edit modal state ──────────────────────────────────────────────────
  const [editProductId, setEditProductId] = useState<number | null>(null)

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

  const openView = async (product: AdminProduct) => {
    try {
      const full: AdminProduct = await productsApi.get(product.id)
      setViewProduct(full)
    } catch {
      setToast({ message: 'Failed to load product details.', type: 'error' })
    }
  }

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

  const columns: Column<AdminProduct>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-bg-hover flex-shrink-0">
            {row.primary_image_url ? (
              <img src={resolveImageUrl(row.primary_image_url) ?? ''} alt={row.name} className="w-full h-full object-cover" />
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
        <span className={`text-sm font-medium ${row.stock === 0 ? 'text-accent-red' : row.stock < 10 ? 'text-accent-orange' : 'text-text-secondary'}`}>
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
        return <Badge variant={s as 'pending' | 'approved' | 'disabled'}>{s}</Badge>
      },
    },
    {
      key: 'created_at',
      header: 'Added',
      render: (row) => <span className="text-text-muted text-xs">{format(new Date(row.created_at), 'MMM d, yyyy')}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const s = deriveStatus(row)
        return (
          <div className="flex items-center gap-1.5">
            {/* View */}
            <button
              onClick={() => openView(row)}
              className="p-1.5 rounded-md text-text-muted hover:text-accent-purple-light hover:bg-accent-purple/10 transition-colors"
              title="View details"
            >
              <Eye size={15} />
            </button>

            {/* ── EDIT BUTTON ── */}
            <button
              onClick={() => setEditProductId(row.id)}
              className="p-1.5 rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
              title="Edit product"
            >
              <Edit2 size={15} />
            </button>

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
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
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
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            Products
            {products && <span className="ml-2 text-xs font-normal text-text-muted">({products.total} total)</span>}
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

      {/* View Modal (read-only details) */}
      <Modal open={!!viewProduct} onClose={() => setViewProduct(null)} title="Product Details" size="lg">
        {viewProduct && (
          <div className="space-y-5">
            {viewProduct.images?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {viewProduct.images.map((img) => {
                  const url = resolveImageUrl(img.url ?? img.image_path)
                  return url ? (
                    <div key={img.id} className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${img.is_primary ? 'border-accent-purple' : 'border-border'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : null
                })}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'Product ID', value: `#${viewProduct.id}` },
                { label: 'Status',     value: deriveStatus(viewProduct) },
                { label: 'Price',      value: formatCurrency(viewProduct.price) },
                { label: 'Stock',      value: String(viewProduct.stock) },
                { label: 'Category',   value: viewProduct.category?.name ?? '—' },
                { label: 'Seller',     value: viewProduct.seller?.name   ?? '—' },
                { label: 'Added',      value: format(new Date(viewProduct.created_at), 'MMM d, yyyy') },
                { label: 'Featured',   value: viewProduct.featured ? 'Yes' : 'No' },
              ] as { label: string; value: string }[]).map(({ label, value }) => (
                <div key={label} className="p-3 bg-bg-primary rounded-lg border border-border">
                  <p className="text-xs text-text-muted mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-text-primary">{value}</p>
                </div>
              ))}
            </div>
            {viewProduct.description && (
              <div className="p-3 bg-bg-primary rounded-lg border border-border">
                <p className="text-xs text-text-muted mb-1">Description</p>
                <p className="text-sm text-text-secondary leading-relaxed">{viewProduct.description}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setViewProduct(null)} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm">
                Close
              </button>
              <button
                onClick={() => { setViewProduct(null); setEditProductId(viewProduct.id) }}
                className="px-4 py-2 rounded-lg bg-accent-red hover:bg-accent-red/90 text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Edit2 size={14} /> Edit Product
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm action modal */}
      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={
          confirmModal?.type === 'approve' ? 'Approve Product' :
          confirmModal?.type === 'disable' ? 'Disable Product' : 'Delete Product'
        }
        size="sm"
      >
        <p className="text-text-secondary text-sm mb-5">
          {confirmModal?.type === 'approve' && `Approve "${confirmModal.product.name}" and make it visible?`}
          {confirmModal?.type === 'disable' && `Disable "${confirmModal?.product.name}"? It will be hidden from customers.`}
          {confirmModal?.type === 'delete'  && `Permanently delete "${confirmModal?.product.name}"? This cannot be undone.`}
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmModal(null)} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={handleAction}
            disabled={!!actionLoading}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60 ${
              confirmModal?.type === 'approve' ? 'bg-accent-green hover:bg-accent-green/90' :
              confirmModal?.type === 'disable' ? 'bg-accent-orange hover:bg-accent-orange/90' :
              'bg-accent-red hover:bg-accent-red/90'
            }`}
          >
            {actionLoading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </Modal>

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