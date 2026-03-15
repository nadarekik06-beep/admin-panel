'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, CheckCircle, XCircle, PauseCircle, Eye, Pencil, X, Save, Loader2 } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { sellersApi, SellerUpdatePayload } from '@/lib/api/sellers'
import { Seller, PaginatedResponse } from '@/types'
import { format } from 'date-fns'

type ActionType = 'approve' | 'reject' | 'suspend'

function getSellerStatus(seller: Seller): 'pending' | 'approved' | 'suspended' {
  if (!seller.is_active)  return 'suspended'
  if (seller.is_approved) return 'approved'
  return 'pending'
}

// ─── Toast notification ───────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all
      ${type === 'success' ? 'bg-accent-green' : 'bg-accent-red'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
      {message}
    </div>
  )
}

export default function SellersPage() {
  const [sellers, setSellers]             = useState<PaginatedResponse<Seller> | null>(null)
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [status, setStatus]               = useState('')
  const [page, setPage]                   = useState(1)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [rejectReason, setRejectReason]   = useState('')

  // View / Edit state
  const [viewSeller, setViewSeller]       = useState<Seller | null>(null)
  const [editMode, setEditMode]           = useState(false)
  const [editForm, setEditForm]           = useState<SellerUpdatePayload>({})
  const [saveLoading, setSaveLoading]     = useState(false)
  const [formErrors, setFormErrors]       = useState<Record<string, string>>({})
  const [toast, setToast]                 = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [confirmModal, setConfirmModal] = useState<{ type: ActionType; seller: Seller } | null>(null)

  const fetchSellers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await sellersApi.list({ search: search || undefined, status: status || undefined, page })
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

  // ── Open view modal ───────────────────────────────────────────────────────
  const openView = async (seller: Seller) => {
    try {
      const full = await sellersApi.get(seller.id)
      setViewSeller(full)
      setEditMode(false)
      setEditForm({
        name:       full.name       ?? '',
        email:      full.email      ?? '',
        phone:      full.phone      ?? '',
        store_name: full.store_name ?? '',
        address:    full.address    ?? '',
        is_active:  full.is_active,
      })
      setFormErrors({})
    } catch {
      setToast({ message: 'Failed to load seller details.', type: 'error' })
    }
  }

  // ── Validate edit form ────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!editForm.name?.trim())  errors.name  = 'Name is required.'
    if (!editForm.email?.trim()) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email))
      errors.email = 'Enter a valid email address.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Save edit ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!viewSeller || !validate()) return
    setSaveLoading(true)
    try {
      const updated = await sellersApi.update(viewSeller.id, editForm)
      setViewSeller(updated)
      setEditMode(false)
      setToast({ message: 'Seller updated successfully.', type: 'success' })
      fetchSellers()
    } catch {
      setToast({ message: 'Failed to update seller. Please try again.', type: 'error' })
    } finally {
      setSaveLoading(false)
    }
  }

  // ── Confirm action (approve / reject / suspend) ───────────────────────────
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
    } catch {
      console.error('Action failed')
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
      render: (row) => <span className="text-text-secondary">{row.products_count ?? 0}</span>,
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (row) => (
        <span className="text-text-muted text-xs">{format(new Date(row.created_at), 'MMM d, yyyy')}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const s = getSellerStatus(row)
        return (
          <div className="flex items-center gap-1.5">
            {/* 👁 View */}
            <button
              onClick={() => openView(row)}
              className="p-1.5 rounded-md text-text-muted hover:text-accent-purple-light hover:bg-accent-purple/10 transition-colors"
              title="View details"
            >
              <Eye size={15} />
            </button>

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
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Filters ── */}
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

      {/* ── Table ── */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            Sellers
            {sellers && <span className="ml-2 text-xs font-normal text-text-muted">({sellers.total} total)</span>}
          </h2>
        </div>
        <DataTable columns={columns} data={sellers?.data ?? []} loading={loading} emptyMessage="No sellers found." keyField="id" />
        {sellers && sellers.last_page > 1 && (
          <Pagination currentPage={sellers.current_page} lastPage={sellers.last_page} total={sellers.total} from={sellers.from} to={sellers.to} onPageChange={setPage} />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          VIEW / EDIT MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!viewSeller}
        onClose={() => { setViewSeller(null); setEditMode(false) }}
        title={editMode ? 'Edit Seller' : 'Seller Details'}
        size="md"
      >
        {viewSeller && (
          <div className="space-y-5">
            {/* ── View mode ── */}
            {!editMode && (
              <>
                {/* Header row */}
                <div className="flex items-center gap-4 p-4 bg-bg-primary rounded-xl border border-border">
                  <div className="w-12 h-12 rounded-full bg-gradient-purple flex items-center justify-center flex-shrink-0 shadow-glow">
                    <span className="text-white font-bold text-lg">{viewSeller.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary text-base truncate">{viewSeller.name}</p>
                    <p className="text-xs text-text-muted truncate">{viewSeller.email}</p>
                  </div>
                  <Badge variant={getSellerStatus(viewSeller)}>{getSellerStatus(viewSeller)}</Badge>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Seller ID',    value: `#${viewSeller.id}` },
                    { label: 'Products',     value: viewSeller.products_count ?? 0 },
                    { label: 'Phone',        value: (viewSeller as any).phone      || '—' },
                    { label: 'Store Name',   value: (viewSeller as any).store_name || '—' },
                    { label: 'Address',      value: (viewSeller as any).address    || '—' },
                    { label: 'Joined',       value: format(new Date(viewSeller.created_at), 'MMM d, yyyy') },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 bg-bg-primary rounded-lg border border-border">
                      <p className="text-xs text-text-muted mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-text-primary truncate">{String(value)}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-1">
                  <button
                    onClick={() => { setViewSeller(null); setEditMode(false) }}
                    className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 rounded-lg bg-accent-purple hover:bg-accent-purple/90 text-white text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Pencil size={14} /> Edit Seller
                  </button>
                </div>
              </>
            )}

            {/* ── Edit mode ── */}
            {editMode && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Name *</label>
                    <input
                      value={editForm.name ?? ''}
                      onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className={`w-full bg-bg-primary border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none transition-colors
                        ${formErrors.name ? 'border-accent-red' : 'border-border focus:border-accent-purple'}`}
                      placeholder="Full name"
                    />
                    {formErrors.name && <p className="text-xs text-accent-red mt-1">{formErrors.name}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Email *</label>
                    <input
                      type="email"
                      value={editForm.email ?? ''}
                      onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                      className={`w-full bg-bg-primary border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none transition-colors
                        ${formErrors.email ? 'border-accent-red' : 'border-border focus:border-accent-purple'}`}
                      placeholder="email@example.com"
                    />
                    {formErrors.email && <p className="text-xs text-accent-red mt-1">{formErrors.email}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Phone</label>
                    <input
                      value={editForm.phone ?? ''}
                      onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
                      placeholder="+216 XX XXX XXX"
                    />
                  </div>

                  {/* Store name */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Store Name</label>
                    <input
                      value={editForm.store_name ?? ''}
                      onChange={(e) => setEditForm(f => ({ ...f, store_name: e.target.value }))}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
                      placeholder="Store name"
                    />
                  </div>

                  {/* Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-muted mb-1">Address</label>
                    <input
                      value={editForm.address ?? ''}
                      onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
                      placeholder="Full address"
                    />
                  </div>

                  {/* Status */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-muted mb-1">Account Status</label>
                    <select
                      value={editForm.is_active ? 'active' : 'suspended'}
                      onChange={(e) => setEditForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 justify-end pt-1">
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saveLoading}
                    className="px-4 py-2 rounded-lg bg-accent-green hover:bg-accent-green/90 text-white text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-60"
                  >
                    {saveLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saveLoading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Confirm action modal ── */}
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
          {confirmModal?.type === 'approve' && `Approve "${confirmModal.seller.name}" as a seller?`}
          {confirmModal?.type === 'reject'  && `Reject "${confirmModal?.seller.name}"'s seller account?`}
          {confirmModal?.type === 'suspend' && `Suspend "${confirmModal?.seller.name}"? They won't be able to sell.`}
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
          <button onClick={() => { setConfirmModal(null); setRejectReason('') }} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm">Cancel</button>
          <button
            onClick={handleAction}
            disabled={!!actionLoading}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60 ${
              confirmModal?.type === 'approve' ? 'bg-accent-green hover:bg-accent-green/90' :
              confirmModal?.type === 'suspend' ? 'bg-accent-orange hover:bg-accent-orange/90' :
              'bg-accent-red hover:bg-accent-red/90'
            }`}
          >
            {actionLoading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </Modal>
    </div>
  )
}