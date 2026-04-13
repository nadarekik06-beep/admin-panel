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

// ─── Extended type: merges User + SellerApplication fields ───────────────────
interface SellerDetail extends Seller {
  full_name?:            string | null
  phone_number?:         string | null
  business_name?:        string | null
  business_category?:    string | null
  business_description?: string | null
  wilaya?:               string | null
  city?:                 string | null
  profile_picture?:      string | null
  facebook_url?:         string | null
  instagram_url?:        string | null
  website_url?:          string | null
  app_status?:           string | null
  reviewed_at?:          string | null
  active_plan?:          'free' | 'red' | 'black' | null  // ← ADD THIS
  preferred_plan?:       'green' | 'red' | 'black' | null // ← ADD THIS

}

function getSellerStatus(seller: Seller): 'pending' | 'approved' | 'suspended' {
  if (!seller.is_active)  return 'suspended'
  if (seller.is_approved) return 'approved'
  return 'pending'
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'success' ? 'bg-accent-green' : 'bg-accent-red'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
      {message}
    </div>
  )
}

// ─── Info card used in the view modal ────────────────────────────────────────
function InfoCard({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="p-3 rounded-lg border" style={{ background: '#0d0f14', borderColor: '#1e2128' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: value && value !== '—' ? '#fcfdfd' : '#4b5563' }}>
        {value || '—'}
      </p>
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

  const [viewSeller, setViewSeller]       = useState<SellerDetail | null>(null)
  const [viewLoading, setViewLoading]     = useState(false)
  const [editMode, setEditMode]           = useState(false)
  const [editForm, setEditForm]           = useState<SellerUpdatePayload>({})
  const [saveLoading, setSaveLoading]     = useState(false)
  const [formErrors, setFormErrors]       = useState<Record<string, string>>({})
  const [toast, setToast]                 = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmModal, setConfirmModal]   = useState<{ type: ActionType; seller: Seller } | null>(null)

  const fetchSellers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await sellersApi.list({ search: search || undefined, status: status || undefined, page })
      setSellers(res)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [search, status, page])

  useEffect(() => { const t = setTimeout(fetchSellers, 300); return () => clearTimeout(t) }, [fetchSellers])

  // ── Open view modal ──────────────────────────────────────────────────────
  const openView = async (seller: Seller) => {
    setViewLoading(true)
    setViewSeller(null)
    setEditMode(false)
    try {
      const full: SellerDetail = await sellersApi.get(seller.id)
      setViewSeller(full)
      setEditForm({
        name:       full.name       ?? '',
        email:      full.email      ?? '',
        phone:      full.phone_number ?? '',
        store_name: full.business_name ?? '',
        address:    full.city ? `${full.city}, ${full.wilaya ?? ''}`.trim() : '',
        is_active:  full.is_active,
      })
      setFormErrors({})
    } catch { setToast({ message: 'Failed to load seller details.', type: 'error' }) }
    finally { setViewLoading(false) }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!editForm.name?.trim())  errors.name  = 'Name is required.'
    if (!editForm.email?.trim()) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) errors.email = 'Enter a valid email.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!viewSeller || !validate()) return
    setSaveLoading(true)
    try {
      const updated = await sellersApi.update(viewSeller.id, editForm)
      setViewSeller(prev => prev ? { ...prev, ...updated } : prev)
      setEditMode(false)
      setToast({ message: 'Seller updated successfully.', type: 'success' })
      fetchSellers()
    } catch { setToast({ message: 'Failed to update seller.', type: 'error' }) }
    finally { setSaveLoading(false) }
  }

  const handleAction = async () => {
    if (!confirmModal) return
    setActionLoading(confirmModal.seller.id)
    try {
      if (confirmModal.type === 'approve') await sellersApi.approve(confirmModal.seller.id)
      if (confirmModal.type === 'reject')  await sellersApi.reject(confirmModal.seller.id, rejectReason)
      if (confirmModal.type === 'suspend') await sellersApi.suspend(confirmModal.seller.id)
      setConfirmModal(null); setRejectReason(''); fetchSellers()
    } catch { console.error('Action failed') }
    finally { setActionLoading(null) }
  }

  const columns: Column<Seller>[] = [
    {
      key: 'name', header: 'Seller',
      render: (row) => (
        <div>
          <p className="font-medium text-text-primary">{row.name}</p>
          <p className="text-xs text-text-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'is_approved', header: 'Status',
      render: (row) => { const s = getSellerStatus(row); return <Badge variant={s}>{s}</Badge> },
    },
        {
      key: 'products_count', header: 'Products',
      render: (row) => <span className="text-text-secondary">{row.products_count ?? 0}</span>,
    },
    {
      key: 'active_plan' as keyof Seller, header: 'Plan',
      render: (row) => {
        const plan = (row as SellerDetail).active_plan ?? 'free'
        const cfg = {
          free:  { label: '🟢 Free',  color: '#198f41', bg: 'rgba(25,143,65,0.12)'   },
          red:   { label: '🔴 Red',   color: '#db142e', bg: 'rgba(219,20,46,0.12)'   },
          black: { label: '⚫ Black', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
        } as const
        const { label, color, bg } = cfg[plan as keyof typeof cfg] ?? cfg.free
        return (
          <span style={{
            background: bg, color, border: `1px solid ${color}33`,
            padding: '2px 10px', borderRadius: 999,
            fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
          }}>
            {label}
          </span>
        )
      },
    },
    {
      key: 'created_at', header: 'Joined',
      render: (row) => <span className="text-text-muted text-xs">{format(new Date(row.created_at), 'MMM d, yyyy')}</span>,
    },
    {
      key: 'actions', header: 'Actions',
      render: (row) => {
        const s = getSellerStatus(row)
        return (
          <div className="flex items-center gap-1.5">
            <button onClick={() => openView(row)} className="p-1.5 rounded-md text-text-muted hover:text-accent-purple-light hover:bg-accent-purple/10 transition-colors" title="View details">
              <Eye size={15} />
            </button>
            {(s === 'pending' || s === 'suspended') && (
              <button onClick={() => setConfirmModal({ type: 'approve', seller: row })} className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors" title="Approve">
                <CheckCircle size={15} />
              </button>
            )}
            {s === 'pending' && (
              <button onClick={() => setConfirmModal({ type: 'reject', seller: row })} className="p-1.5 rounded-md text-accent-red hover:bg-accent-red/10 transition-colors" title="Reject">
                <XCircle size={15} />
              </button>
            )}
            {s === 'approved' && (
              <button onClick={() => setConfirmModal({ type: 'suspend', seller: row })} className="p-1.5 rounded-md text-accent-orange hover:bg-accent-orange/10 transition-colors" title="Suspend">
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Filters ── */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Search sellers…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-bg-primary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple transition-colors" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors">
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
            Sellers {sellers && <span className="ml-2 text-xs font-normal text-text-muted">({sellers.total} total)</span>}
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
        open={!!viewSeller || viewLoading}
        onClose={() => { setViewSeller(null); setEditMode(false) }}
        title={editMode ? 'Edit Seller' : 'Seller Details'}
        size="lg"
      >
        {/* Loading state */}
        {viewLoading && !viewSeller && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin" style={{ color: '#db142e' }} />
          </div>
        )}

        {viewSeller && !editMode && (
          <div className="space-y-5">

            {/* ── Header: avatar + name + status ── */}
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#0d0f14', border: '1px solid #1e2128' }}>
              {/* Profile picture or initial */}
              {viewSeller.profile_picture ? (
                <img src={viewSeller.profile_picture} alt={viewSeller.full_name ?? viewSeller.name}
                  className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                  style={{ border: '2px solid #db142e' }} />
              ) : (
                <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xl text-white"
                  style={{ background: 'linear-gradient(135deg, #db142e 0%, #9b0d1f 100%)', boxShadow: '0 0 12px rgba(219,20,46,0.4)' }}>
                  {(viewSeller.full_name ?? viewSeller.name).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate" style={{ color: '#fcfdfd' }}>
                  {viewSeller.full_name ?? viewSeller.name}
                </p>
                <p className="text-xs truncate" style={{ color: '#6b7280' }}>{viewSeller.email}</p>
                {viewSeller.business_category && (
                  <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(25,143,65,0.15)', color: '#22b356' }}>
                    {viewSeller.business_category}
                  </span>
                )}
              </div>
              <Badge variant={getSellerStatus(viewSeller)}>{getSellerStatus(viewSeller)}</Badge>
            </div>

            {/* ── Info grid — all seller_application fields ── */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Seller ID"     value={`#${viewSeller.id}`} />
              <InfoCard label="Products"      value={viewSeller.products_count ?? 0} />
              <InfoCard label="Phone"         value={viewSeller.phone_number} />
              <InfoCard label="Store / Business Name" value={viewSeller.business_name} />
              <InfoCard label="Wilaya"        value={viewSeller.wilaya} />
              <InfoCard label="City"          value={viewSeller.city} />
              <InfoCard label="Joined"        value={format(new Date(viewSeller.created_at), 'MMM d, yyyy')} />
              <InfoCard label="App Status"    value={viewSeller.app_status} />
              <InfoCard label="Active Plan"   value={
                viewSeller.active_plan === 'red'   ? '🔴 Red Pepper'   :
                viewSeller.active_plan === 'black' ? '⚫ Black Pepper' :
                '🟢 Free (Green Pepper)'
              } />
              <InfoCard label="Preferred Plan" value={
                viewSeller.preferred_plan === 'red'   ? '🔴 Red Pepper'   :
                viewSeller.preferred_plan === 'black' ? '⚫ Black Pepper' :
                '🟢 Green Pepper'
              } />
            </div>

            {/* ── Business description ── */}
            {viewSeller.business_description && (
              <div className="p-3 rounded-lg border" style={{ background: '#0d0f14', borderColor: '#1e2128' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>Business Description</p>
                <p className="text-sm leading-relaxed" style={{ color: '#c8cad0' }}>{viewSeller.business_description}</p>
              </div>
            )}

            {/* ── Social links ── */}
            {(viewSeller.facebook_url || viewSeller.instagram_url || viewSeller.website_url) && (
              <div className="grid grid-cols-1 gap-2">
                {viewSeller.facebook_url && (
                  <a href={viewSeller.facebook_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg text-xs truncate transition-colors"
                    style={{ background: '#0d0f14', border: '1px solid #1e2128', color: '#6b7280' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fcfdfd')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                    <span className="font-semibold" style={{ color: '#4267B2' }}>fb</span>
                    {viewSeller.facebook_url}
                  </a>
                )}
                {viewSeller.instagram_url && (
                  <a href={viewSeller.instagram_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg text-xs truncate transition-colors"
                    style={{ background: '#0d0f14', border: '1px solid #1e2128', color: '#6b7280' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fcfdfd')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                    <span className="font-semibold" style={{ color: '#E1306C' }}>ig</span>
                    {viewSeller.instagram_url}
                  </a>
                )}
                {viewSeller.website_url && (
                  <a href={viewSeller.website_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg text-xs truncate transition-colors"
                    style={{ background: '#0d0f14', border: '1px solid #1e2128', color: '#6b7280' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fcfdfd')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                    <span className="font-semibold" style={{ color: '#198f41' }}>🌐</span>
                    {viewSeller.website_url}
                  </a>
                )}
              </div>
            )}

            {/* ── Actions ── */}
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => { setViewSeller(null); setEditMode(false) }}
                className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm">
                Close
              </button>
              <button onClick={() => setEditMode(true)}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-colors"
                style={{ background: 'linear-gradient(135deg, #db142e 0%, #9b0d1f 100%)', boxShadow: '0 4px 12px rgba(219,20,46,0.3)' }}>
                <Pencil size={14} /> Edit Seller
              </button>
            </div>
          </div>
        )}

        {/* ── EDIT MODE ── */}
        {viewSeller && editMode && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Name *</label>
                <input value={editForm.name ?? ''} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className={`w-full bg-bg-primary border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none transition-colors ${formErrors.name ? 'border-accent-red' : 'border-border focus:border-accent-purple'}`}
                  placeholder="Full name" />
                {formErrors.name && <p className="text-xs text-accent-red mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Email *</label>
                <input type="email" value={editForm.email ?? ''} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className={`w-full bg-bg-primary border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none transition-colors ${formErrors.email ? 'border-accent-red' : 'border-border focus:border-accent-purple'}`}
                  placeholder="email@example.com" />
                {formErrors.email && <p className="text-xs text-accent-red mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Phone</label>
                <input value={editForm.phone ?? ''} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
                  placeholder="+216 XX XXX XXX" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Store Name</label>
                <input value={editForm.store_name ?? ''} onChange={(e) => setEditForm(f => ({ ...f, store_name: e.target.value }))}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
                  placeholder="Store name" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-text-muted mb-1">Address</label>
                <input value={editForm.address ?? ''} onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
                  placeholder="Full address" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-text-muted mb-1">Account Status</label>
                <select value={editForm.is_active ? 'active' : 'suspended'} onChange={(e) => setEditForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setEditMode(false)} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saveLoading}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-60"
                style={{ background: '#198f41' }}>
                {saveLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saveLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirm action modal ── */}
      <Modal
        open={!!confirmModal}
        onClose={() => { setConfirmModal(null); setRejectReason('') }}
        title={confirmModal?.type === 'approve' ? 'Approve Seller' : confirmModal?.type === 'reject' ? 'Reject Seller' : 'Suspend Seller'}
        size="sm"
      >
        <p className="text-text-secondary text-sm mb-4">
          {confirmModal?.type === 'approve' && `Approve "${confirmModal.seller.name}" as a seller?`}
          {confirmModal?.type === 'reject'  && `Reject "${confirmModal?.seller.name}"'s seller account?`}
          {confirmModal?.type === 'suspend' && `Suspend "${confirmModal?.seller.name}"? They won't be able to sell.`}
        </p>
        {confirmModal?.type === 'reject' && (
          <textarea placeholder="Reason for rejection (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple mb-4 resize-none transition-colors" />
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={() => { setConfirmModal(null); setRejectReason('') }} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm">Cancel</button>
          <button onClick={handleAction} disabled={!!actionLoading}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60 ${
              confirmModal?.type === 'approve' ? 'bg-accent-green hover:bg-accent-green/90' :
              confirmModal?.type === 'suspend' ? 'bg-accent-orange hover:bg-accent-orange/90' :
              'bg-accent-red hover:bg-accent-red/90'
            }`}>
            {actionLoading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </Modal>
    </div>
  )
}