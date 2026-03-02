'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, CheckCircle, XCircle, Eye, X, ExternalLink, MapPin, Phone, Store, Tag } from 'lucide-react'
import { sellerApplicationsApi, SellerApplication, storageUrl } from '@/lib/api/sellerApplications'
import { format } from 'date-fns'

type Tab = 'pending' | 'approved' | 'rejected'

// ── Badge ──────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Tab }) {
  const styles = {
    pending:  'bg-amber-50  text-amber-600  border-amber-200',
    approved: 'bg-green-50  text-green-600  border-green-200',
    rejected: 'bg-red-50    text-red-600    border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ── Detail Modal ───────────────────────────────────────────────────────────────
function DetailModal({
  app,
  onClose,
  onApprove,
  onReject,
}: {
  app: SellerApplication
  onClose: () => void
  onApprove: (id: number) => void
  onReject: (id: number, reason: string) => void
}) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    try { await onApprove(app.id) } finally { setLoading(false) }
  }

  const handleReject = async () => {
    setLoading(true)
    try { await onReject(app.id, reason) } finally { setLoading(false) }
  }

  const pic = storageUrl(app.profile_picture)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
              {pic
                ? <img src={pic} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold">
                    {app.full_name.charAt(0)}
                  </div>}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{app.business_name}</h3>
              <p className="text-sm text-gray-500">{app.full_name} · {app.user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={app.status} />
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoCard icon={<Tag size={14} />} label="Category" value={app.business_category} />
            <InfoCard icon={<Phone size={14} />} label="Phone" value={app.phone_number} />
            <InfoCard icon={<MapPin size={14} />} label="Location" value={`${app.city}, ${app.wilaya}`} />
            <InfoCard icon={<Store size={14} />} label="Applied" value={format(new Date(app.created_at), 'MMM d, yyyy')} />
          </div>

          {/* Description */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Business Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{app.business_description}</p>
          </div>

          {/* Social links */}
          {(app.facebook_url || app.instagram_url || app.website_url) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Social / Web</p>
              <div className="flex flex-wrap gap-2">
                {app.facebook_url && (
                  <a href={app.facebook_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                    <ExternalLink size={11} />Facebook
                  </a>
                )}
                {app.instagram_url && (
                  <a href={app.instagram_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-pink-600 hover:underline">
                    <ExternalLink size={11} />Instagram
                  </a>
                )}
                {app.website_url && (
                  <a href={app.website_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:underline">
                    <ExternalLink size={11} />Website
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Sample images */}
          {app.sample_images && app.sample_images.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Product Samples</p>
              <div className="flex flex-wrap gap-2">
                {app.sample_images.map((img, i) => {
                  const url = storageUrl(img)
                  return url ? (
                    <img key={i} src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* Rejection reason (if rejected) */}
          {app.status === 'rejected' && app.rejection_reason && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{app.rejection_reason}</p>
            </div>
          )}

          {/* Reject form */}
          {showRejectForm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700">Provide rejection reason (optional)</p>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Why is this application rejected?…"
                rows={3}
                className="w-full bg-white border border-red-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-red-400 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowRejectForm(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-white transition-colors">
                  Cancel
                </button>
                <button onClick={handleReject} disabled={loading}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                  {loading ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions (only for pending) */}
        {app.status === 'pending' && !showRejectForm && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button
              onClick={() => setShowRejectForm(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold transition-colors"
            >
              <XCircle size={15} />
              Reject Application
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors disabled:opacity-60"
            >
              <CheckCircle size={15} />
              {loading ? 'Approving…' : 'Approve Seller'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-gray-400 mb-1">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SellerApplicationsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SellerApplication | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await sellerApplicationsApi.list({
        status: tab,
        search: search || undefined,
        page,
      })
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [tab, search, page])

  useEffect(() => {
    const t = setTimeout(fetchData, 300)
    return () => clearTimeout(t)
  }, [fetchData])

  const handleApprove = async (id: number) => {
    setActionLoading(true)
    try {
      await sellerApplicationsApi.approve(id)
      setSelected(null)
      fetchData()
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (id: number, reason: string) => {
    setActionLoading(true)
    try {
      await sellerApplicationsApi.reject(id, reason)
      setSelected(null)
      fetchData()
    } finally {
      setActionLoading(false)
    }
  }

  const TAB_LABELS: { key: Tab; label: string; color: string }[] = [
    { key: 'pending',  label: 'Pending',  color: 'text-amber-600  border-amber-500 bg-amber-50' },
    { key: 'approved', label: 'Approved', color: 'text-green-600  border-green-500 bg-green-50' },
    { key: 'rejected', label: 'Rejected', color: 'text-red-600    border-red-500   bg-red-50'   },
  ]

  const applications: SellerApplication[] = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      {/* ── Tabs + Search ─────────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          
          {/* Tabs */}
          <div className="flex gap-1 bg-bg-primary rounded-lg p-1 border border-border">
            {TAB_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setPage(1) }}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  tab === key
                    ? 'bg-accent-purple text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name, business, email…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-bg-primary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">
            Seller Applications
            <span className="ml-2 text-xs font-normal text-text-muted">({total} total)</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <p className="text-sm">No {tab} applications found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Applicant', 'Business', 'Category', 'Location', 'Applied', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {applications.map(app => {
                  const pic = storageUrl(app.profile_picture)
                  return (
                    <tr key={app.id} className="hover:bg-bg-hover transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-bg-primary overflow-hidden flex-shrink-0 border border-border">
                            {pic
                              ? <img src={pic} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-text-muted text-sm font-bold">
                                  {app.full_name.charAt(0)}
                                </div>}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary">{app.full_name}</p>
                            <p className="text-xs text-text-muted">{app.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary font-medium">{app.business_name}</td>
                      <td className="px-5 py-4 text-sm text-text-muted">{app.business_category}</td>
                      <td className="px-5 py-4 text-sm text-text-muted">{app.city}, {app.wilaya}</td>
                      <td className="px-5 py-4 text-xs text-text-muted">
                        {format(new Date(app.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {/* View details */}
                          <button
                            onClick={() => setSelected(app)}
                            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                          {/* Quick approve / reject for pending */}
                          {app.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(app.id)}
                                className="p-1.5 rounded-md text-accent-green hover:bg-accent-green/10 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button
                                onClick={() => setSelected(app)}
                                className="p-1.5 rounded-md text-accent-red hover:bg-accent-red/10 transition-colors"
                                title="Reject"
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-text-muted">
              Showing {data.from}–{data.to} of {data.total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary disabled:opacity-40 hover:bg-bg-hover transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.last_page, p + 1))}
                disabled={page === data.last_page}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary disabled:opacity-40 hover:bg-bg-hover transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ──────────────────────────────────────── */}
      {selected && (
        <DetailModal
          app={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}