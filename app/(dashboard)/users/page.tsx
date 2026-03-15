'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Trash2, UserX, UserCheck, Eye, Pencil, X, Save, Loader2, CheckCircle } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { usersApi, UserUpdatePayload } from '@/lib/api/users'
import { User, PaginatedResponse } from '@/types'
import { format } from 'date-fns'

// ─── Toast notification ───────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
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

export default function UsersPage() {
  const [users, setUsers]             = useState<PaginatedResponse<User> | null>(null)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [status, setStatus]           = useState('')
  const [page, setPage]               = useState(1)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // View / Edit
  const [viewUser, setViewUser]       = useState<User | null>(null)
  const [editMode, setEditMode]       = useState(false)
  const [editForm, setEditForm]       = useState<UserUpdatePayload>({})
  const [saveLoading, setSaveLoading] = useState(false)
  const [formErrors, setFormErrors]   = useState<Record<string, string>>({})
  const [toast, setToast]             = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [confirmModal, setConfirmModal] = useState<{ type: 'ban' | 'unban' | 'delete'; user: User } | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await usersApi.list({ search: search || undefined, status: (status as 'active' | 'banned') || undefined, page })
      setUsers(res)
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300)
    return () => clearTimeout(timer)
  }, [fetchUsers])

  const openView = async (user: User) => {
    try {
      const full = await usersApi.get(user.id)
      setViewUser(full)
      setEditMode(false)
      setEditForm({
        name:      full.name      ?? '',
        email:     full.email     ?? '',
        phone:     full.phone     ?? '',
        address:   full.address   ?? '',
        is_active: full.is_active,
      })
      setFormErrors({})
    } catch {
      setToast({ message: 'Failed to load user details.', type: 'error' })
    }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!editForm.name?.trim())  errors.name  = 'Name is required.'
    if (!editForm.email?.trim()) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email))
      errors.email = 'Enter a valid email address.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!viewUser || !validate()) return
    setSaveLoading(true)
    try {
      const updated = await usersApi.update(viewUser.id, editForm)
      setViewUser(updated)
      setEditMode(false)
      setToast({ message: 'User updated successfully.', type: 'success' })
      fetchUsers()
    } catch {
      setToast({ message: 'Failed to update user. Please try again.', type: 'error' })
    } finally {
      setSaveLoading(false)
    }
  }

  const handleAction = async () => {
    if (!confirmModal) return
    setActionLoading(confirmModal.user.id)
    try {
      if (confirmModal.type === 'ban')    await usersApi.ban(confirmModal.user.id)
      if (confirmModal.type === 'unban')  await usersApi.unban(confirmModal.user.id)
      if (confirmModal.type === 'delete') await usersApi.delete(confirmModal.user.id)
      setConfirmModal(null)
      fetchUsers()
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      render: (row) => (
        <div>
          <p className="font-medium text-text-primary">{row.name}</p>
          <p className="text-xs text-text-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => <Badge variant={row.is_active ? 'active' : 'banned'}>{row.is_active ? 'Active' : 'Banned'}</Badge>,
    },
    {
      key: 'orders_count',
      header: 'Orders',
      render: (row) => <span className="text-text-secondary">{row.orders_count ?? 0}</span>,
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (row) => <span className="text-text-muted text-xs">{format(new Date(row.created_at), 'MMM d, yyyy')}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {/* 👁 View */}
          <button
            onClick={() => openView(row)}
            className="p-1.5 rounded-md text-text-muted hover:text-accent-purple-light hover:bg-accent-purple/10 transition-colors"
            title="View details"
          >
            <Eye size={15} />
          </button>
          {!row.is_active ? (
            <button onClick={() => setConfirmModal({ type: 'unban', user: row })} className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors" title="Unban user">
              <UserCheck size={15} />
            </button>
          ) : (
            <button onClick={() => setConfirmModal({ type: 'ban', user: row })} className="p-1.5 rounded-md text-accent-orange hover:bg-accent-orange/10 transition-colors" title="Ban user">
              <UserX size={15} />
            </button>
          )}
          <button onClick={() => setConfirmModal({ type: 'delete', user: row })} className="p-1.5 rounded-md text-accent-red hover:bg-accent-red/10 transition-colors" title="Delete user">
            <Trash2 size={15} />
          </button>
        </div>
      ),
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
            <input type="text" placeholder="Search by name or email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-bg-primary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple transition-colors" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">
            Users {users && <span className="ml-2 text-xs font-normal text-text-muted">({users.total} total)</span>}
          </h2>
        </div>
        <DataTable columns={columns} data={users?.data ?? []} loading={loading} emptyMessage="No users found." keyField="id" />
        {users && users.last_page > 1 && (
          <Pagination currentPage={users.current_page} lastPage={users.last_page} total={users.total} from={users.from} to={users.to} onPageChange={setPage} />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          VIEW / EDIT MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal open={!!viewUser} onClose={() => { setViewUser(null); setEditMode(false) }} title={editMode ? 'Edit User' : 'User Details'} size="md">
        {viewUser && (
          <div className="space-y-5">
            {!editMode && (
              <>
                {/* Header */}
                <div className="flex items-center gap-4 p-4 bg-bg-primary rounded-xl border border-border">
                  <div className="w-12 h-12 rounded-full bg-gradient-purple flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-lg">{viewUser.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary text-base truncate">{viewUser.name}</p>
                    <p className="text-xs text-text-muted truncate">{viewUser.email}</p>
                  </div>
                  <Badge variant={viewUser.is_active ? 'active' : 'banned'}>{viewUser.is_active ? 'Active' : 'Banned'}</Badge>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'User ID',   value: `#${viewUser.id}` },
                    { label: 'Orders',    value: viewUser.orders_count ?? 0 },
                    { label: 'Phone',     value: (viewUser as any).phone   || '—' },
                    { label: 'Address',   value: (viewUser as any).address || '—' },
                    { label: 'Joined',    value: format(new Date(viewUser.created_at), 'MMM d, yyyy') },
                    { label: 'Status',    value: viewUser.is_active ? 'Active' : 'Banned' },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 bg-bg-primary rounded-lg border border-border">
                      <p className="text-xs text-text-muted mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-text-primary truncate">{String(value)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 justify-end pt-1">
                  <button onClick={() => { setViewUser(null); setEditMode(false) }} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm">Close</button>
                  <button onClick={() => setEditMode(true)} className="px-4 py-2 rounded-lg bg-accent-purple hover:bg-accent-purple/90 text-white text-sm font-medium flex items-center gap-2 transition-colors">
                    <Pencil size={14} /> Edit User
                  </button>
                </div>
              </>
            )}

            {editMode && (
              <>
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
                    <label className="block text-xs font-medium text-text-muted mb-1">Account Status</label>
                    <select value={editForm.is_active ? 'active' : 'banned'} onChange={(e) => setEditForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors">
                      <option value="active">Active</option>
                      <option value="banned">Banned</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-muted mb-1">Address</label>
                    <input value={editForm.address ?? ''} onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
                      placeholder="Full address" />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-1">
                  <button onClick={() => setEditMode(false)} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm">Cancel</button>
                  <button onClick={handleSave} disabled={saveLoading}
                    className="px-4 py-2 rounded-lg bg-accent-green hover:bg-accent-green/90 text-white text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-60">
                    {saveLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saveLoading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Confirm modal ── */}
      <Modal open={!!confirmModal} onClose={() => setConfirmModal(null)} title={confirmModal?.type === 'ban' ? 'Ban User' : confirmModal?.type === 'unban' ? 'Unban User' : 'Delete User'} size="sm">
        <p className="text-text-secondary text-sm mb-5">
          {confirmModal?.type === 'ban'    && `Are you sure you want to ban "${confirmModal.user.name}"?`}
          {confirmModal?.type === 'unban'  && `Restore access for "${confirmModal?.user.name}"?`}
          {confirmModal?.type === 'delete' && `Permanently delete "${confirmModal?.user.name}"? This cannot be undone.`}
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmModal(null)} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm">Cancel</button>
          <button onClick={handleAction} disabled={actionLoading === confirmModal?.user.id}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60 ${confirmModal?.type === 'delete' || confirmModal?.type === 'ban' ? 'bg-accent-red hover:bg-accent-red/90' : 'bg-accent-green hover:bg-accent-green/90'}`}>
            {actionLoading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </Modal>
    </div>
  )
}