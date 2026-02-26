'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Trash2, UserX, UserCheck } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { usersApi } from '@/lib/api/users'
import { User, PaginatedResponse } from '@/types'
import { format } from 'date-fns'

export default function UsersPage() {
  const [users, setUsers]             = useState<PaginatedResponse<User> | null>(null)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [status, setStatus]           = useState('')
  const [page, setPage]               = useState(1)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [confirmModal, setConfirmModal]   = useState<{
    type: 'ban' | 'unban' | 'delete'
    user: User
  } | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await usersApi.list({
        search: search || undefined,
        status: (status as 'active' | 'banned') || undefined,
        page,
      })
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
      // ✅ Use is_active (real column) instead of banned_at
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'active' : 'banned'}>
          {row.is_active ? 'Active' : 'Banned'}
        </Badge>
      ),
    },
    {
      key: 'orders_count',
      header: 'Orders',
      render: (row) => (
        <span className="text-text-secondary">{row.orders_count ?? 0}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (row) => (
        <span className="text-text-muted text-xs">
          {format(new Date(row.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          {/* ✅ Use is_active to decide ban/unban button */}
          {!row.is_active ? (
            <button
              onClick={() => setConfirmModal({ type: 'unban', user: row })}
              className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors"
              title="Unban user"
            >
              <UserCheck size={15} />
            </button>
          ) : (
            <button
              onClick={() => setConfirmModal({ type: 'ban', user: row })}
              className="p-1.5 rounded-md text-accent-orange hover:bg-accent-orange/10 transition-colors"
              title="Ban user"
            >
              <UserX size={15} />
            </button>
          )}
          <button
            onClick={() => setConfirmModal({ type: 'delete', user: row })}
            className="p-1.5 rounded-md text-accent-red hover:bg-accent-red/10 transition-colors"
            title="Delete user"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="Search by name or email…"
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
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">
            Users
            {users && (
              <span className="ml-2 text-xs font-normal text-text-muted">
                ({users.total} total)
              </span>
            )}
          </h2>
        </div>

        <DataTable
          columns={columns}
          data={users?.data ?? []}
          loading={loading}
          emptyMessage="No users found."
          keyField="id"
        />

        {users && users.last_page > 1 && (
          <Pagination
            currentPage={users.current_page}
            lastPage={users.last_page}
            total={users.total}
            from={users.from}
            to={users.to}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* ── Confirm Modal ──────────────────────────────────────── */}
      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={
          confirmModal?.type === 'ban'
            ? 'Ban User'
            : confirmModal?.type === 'unban'
            ? 'Unban User'
            : 'Delete User'
        }
        size="sm"
      >
        <p className="text-text-secondary text-sm mb-5">
          {confirmModal?.type === 'ban' &&
            `Are you sure you want to ban "${confirmModal.user.name}"? They will lose access to the platform.`}
          {confirmModal?.type === 'unban' &&
            `Are you sure you want to restore access for "${confirmModal?.user.name}"?`}
          {confirmModal?.type === 'delete' &&
            `Permanently delete "${confirmModal?.user.name}"? This cannot be undone.`}
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
            disabled={actionLoading === confirmModal?.user.id}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-60 ${
              confirmModal?.type === 'delete' || confirmModal?.type === 'ban'
                ? 'bg-accent-red hover:bg-accent-red/90'
                : 'bg-accent-green hover:bg-accent-green/90'
            }`}
          >
            {actionLoading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </Modal>
    </div>
  )
}