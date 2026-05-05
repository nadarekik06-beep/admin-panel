'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Search, CheckCircle, XCircle, Eye, X,
  ExternalLink, MapPin, Phone, Store, Tag,
  Trash2, UserCog, Loader2, Sparkles,
} from 'lucide-react'
import {
  sellerApplicationsApi,
  SellerApplication,
  storageUrl,
  preferredPlanMeta,
  PreferredPlan,
} from '@/lib/api/sellerApplications'
import { sellersApi } from '@/lib/api/sellers'
import { format } from 'date-fns'

type Tab = 'pending' | 'approved' | 'rejected'

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium animate-fade-in"
      style={{ background: type === 'success' ? '#198f41' : '#db142e' }}>
      {type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
      {message}
    </div>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmColor, loading, onConfirm, onClose, children }: {
  title: string; message: string; confirmLabel: string; confirmColor: string
  loading: boolean; onConfirm: () => void; onClose: () => void; children?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#16191f', border: '1px solid #1e2128' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: '#1e2128' }}>
          <h3 className="font-bold text-base" style={{ color: '#fcfdfd' }}>{title}</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm" style={{ color: '#9ca3af' }}>{message}</p>
          {children}
        </div>
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid #1e2128' }}>
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ border: '1px solid #1e2128', color: '#9ca3af' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1c2028')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: confirmColor }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Tab }) {
  const styles = {
    pending:  { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' },
    approved: { background: 'rgba(25,143,65,0.12)',  color: '#22b356', border: '1px solid rgba(25,143,65,0.25)'  },
    rejected: { background: 'rgba(219,20,46,0.12)',  color: '#db142e', border: '1px solid rgba(219,20,46,0.25)'  },
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={styles[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Preferred Plan Badge ─────────────────────────────────────────────────────
function PreferredPlanBadge({ plan }: { plan: PreferredPlan }) {
  const meta = preferredPlanMeta(plan)
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
      {plan === 'black' && <Sparkles size={10} />}
      {meta.label}
    </span>
  )
}

// ─── Section divider for the modal ───────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 8px' }}>
      {children}
    </p>
  )
}

// ─── Info Card ────────────────────────────────────────────────────────────────
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: '#0d0f14', border: '1px solid #1e2128' }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: '#6b7280' }}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-medium truncate" style={{ color: '#fcfdfd' }}>{value}</p>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({
  app, onClose, onApprove, onReject, onDelete, onChangeRole,
}: {
  app: SellerApplication
  onClose: () => void
  onApprove: (id: number) => Promise<void>
  onReject: (id: number, reason: string) => Promise<void>
  onDelete: (userId: number, name: string) => void
  onChangeRole: (userId: number, name: string) => void
}) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const pic = storageUrl(app.profile_picture)
  const planMeta = preferredPlanMeta(app.preferred_plan)

  const handleApprove = async () => { setLoading(true); try { await onApprove(app.id) } finally { setLoading(false) } }
  const handleReject  = async () => { setLoading(true); try { await onReject(app.id, reason) } finally { setLoading(false) } }

  // Pricing range display
  const pricingDisplay =
    app.pricing_range === 'budget'  ? { emoji: '💚', label: 'Budget',    color: '#22c55e' } :
    app.pricing_range === 'mid'     ? { emoji: '💛', label: 'Mid-range', color: '#f59e0b' } :
    app.pricing_range === 'premium' ? { emoji: '🖤', label: 'Premium',   color: '#94a3b8' } :
    null

  // Categories
  const categories: string[] = (app as any).business_categories?.length
    ? (app as any).business_categories
    : app.business_category ? [app.business_category] : []

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: '#16191f', border: '1px solid #1e2128' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1e2128' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ border: '2px solid #1e2128' }}>
              {pic
                ? <img src={pic} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold"
                    style={{ background: 'linear-gradient(135deg, #db142e, #9b0d1f)' }}>
                    {app.full_name.charAt(0)}
                  </div>}
            </div>
            <div>
              <h3 className="font-bold" style={{ color: '#fcfdfd' }}>{app.business_name}</h3>
              <p className="text-sm" style={{ color: '#6b7280' }}>{app.full_name} · {app.user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={app.status} />
            <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: '#6b7280' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1c2028')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── SECTION A: Plan preference ── */}
          <div className="rounded-xl px-4 py-3.5 flex items-start gap-3"
            style={{ background: planMeta.bg, border: `1px solid ${planMeta.border}` }}>
            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: planMeta.color + '22' }}>
              <Sparkles size={15} color={planMeta.color} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: planMeta.color }}>
                Preferred Plan
              </p>
              <p className="text-sm font-semibold" style={{ color: '#fcfdfd' }}>{planMeta.label}</p>
              <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                {app.preferred_plan !== 'green'
                  ? 'This seller expressed interest in a paid plan. Once approved, they can upgrade from their dashboard.'
                  : 'This seller selected the free plan. They can upgrade any time after approval.'}
              </p>
            </div>
          </div>

          {/* ── SECTION B: Quick decision strip — categories + pricing ── */}
          <div>
            <SectionLabel>Business Profile</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Categories */}
              {categories.length > 0 && (
                <div style={{ background: '#0d0f14', border: '1px solid #1e2128', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Tag size={12} color="#6b7280" />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Categories ({categories.length})
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {categories.map((cat, i) => (
                      <span key={i} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'rgba(25,143,65,0.12)', color: '#22b356', border: '1px solid rgba(25,143,65,0.25)' }}>
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing range */}
              {pricingDisplay && (
                <div style={{ background: '#0d0f14', border: '1px solid #1e2128', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.2rem' }}>{pricingDisplay.emoji}</span>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 2 }}>Pricing Range</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: pricingDisplay.color }}>{pricingDisplay.label}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION C: Contact + location grid ── */}
          <div>
            <SectionLabel>Contact & Location</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={<Phone size={14} />}  label="Phone"    value={app.phone_number} />
              <InfoCard icon={<Store size={14} />}  label="Applied"  value={format(new Date(app.created_at), 'MMM d, yyyy')} />
              <InfoCard icon={<MapPin size={14} />} label="Location" value={`${app.city}, ${app.wilaya}`} />
              <InfoCard icon={<Tag size={14} />}    label="Category" value={app.business_category} />
            </div>
          </div>

          {/* ── SECTION D: Business description ── */}
          <div>
            <SectionLabel>Business Description</SectionLabel>
            <div className="rounded-xl p-4" style={{ background: '#0d0f14', border: '1px solid #1e2128' }}>
              <p className="text-sm leading-relaxed" style={{ color: '#c8cad0' }}>{app.business_description}</p>
            </div>
          </div>

          {/* ── SECTION E: Product samples with captions ── */}
          {app.sample_images && app.sample_images.length > 0 && (
            <div>
              <SectionLabel>Product Samples ({app.sample_images.length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {app.sample_images.map((img, i) => {
                  const url = storageUrl(img)
                  const caption = (app as any).sample_captions?.[i]
                  return url ? (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0d0f14', border: '1px solid #1e2128', borderRadius: 12, padding: 10 }}>
                      <img src={url} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #1e2128' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {caption
                          ? <p style={{ fontSize: '0.82rem', color: '#fcfdfd', margin: '0 0 3px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{caption}</p>
                          : <p style={{ fontSize: '0.78rem', color: '#4b5563', margin: '0 0 3px', fontStyle: 'italic' }}>No caption</p>}
                        <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: 0 }}>Image {i + 1}</p>
                      </div>
                    </div>
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* ── SECTION F: Social links ── */}
          {(app.facebook_url || app.instagram_url || app.website_url) && (
            <div>
              <SectionLabel>Social &amp; Web</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {app.facebook_url && (
                  <a href={app.facebook_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: '#0d0f14', border: '1px solid #1e2128', color: '#4267B2', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#4267B2')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2128')}>
                    <ExternalLink size={11} />Facebook
                  </a>
                )}
                {app.instagram_url && (
                  <a href={app.instagram_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: '#0d0f14', border: '1px solid #1e2128', color: '#E1306C', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#E1306C')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2128')}>
                    <ExternalLink size={11} />Instagram
                  </a>
                )}
                {app.website_url && (
                  <a href={app.website_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: '#0d0f14', border: '1px solid #1e2128', color: '#198f41', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#198f41')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2128')}>
                    <ExternalLink size={11} />Website
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Rejection reason (if rejected) ── */}
          {app.status === 'rejected' && app.rejection_reason && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(219,20,46,0.08)', border: '1px solid rgba(219,20,46,0.20)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#db142e' }}>Rejection Reason</p>
              <p className="text-sm" style={{ color: '#f87171' }}>{app.rejection_reason}</p>
            </div>
          )}

          {/* ── Reject form ── */}
          {showRejectForm && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(219,20,46,0.08)', border: '1px solid rgba(219,20,46,0.25)' }}>
              <p className="text-sm font-semibold" style={{ color: '#f87171' }}>Provide rejection reason (optional)</p>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Why is this application rejected?…" rows={3}
                className="w-full rounded-xl px-3 py-2 text-sm placeholder:text-text-muted outline-none resize-none"
                style={{ background: '#0d0f14', border: '1px solid rgba(219,20,46,0.3)', color: '#fcfdfd' }} />
              <div className="flex gap-2">
                <button onClick={() => setShowRejectForm(false)}
                  className="flex-1 px-4 py-2 rounded-xl text-sm transition-colors"
                  style={{ border: '1px solid #1e2128', color: '#9ca3af' }}>Cancel</button>
                <button onClick={handleReject} disabled={loading}
                  className="flex-1 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60"
                  style={{ background: '#db142e' }}>
                  {loading ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="px-6 py-4 flex gap-3 flex-wrap flex-shrink-0" style={{ borderTop: '1px solid #1e2128' }}>
          {app.status === 'pending' && !showRejectForm && (
            <>
              <button onClick={() => setShowRejectForm(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ border: '1px solid rgba(219,20,46,0.3)', color: '#db142e' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(219,20,46,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <XCircle size={15} /> Reject
              </button>
              <button onClick={handleApprove} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-60"
                style={{ background: '#198f41' }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={15} />}
                {loading ? 'Approving…' : 'Approve Seller'}
              </button>
            </>
          )}
          {app.status === 'approved' && app.user && (
            <>
              <button onClick={() => onChangeRole(app.user!.id, app.full_name)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ border: '1px solid rgba(25,143,65,0.3)', color: '#22b356' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(25,143,65,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <UserCog size={15} /> Change Role
              </button>
              <button onClick={() => onDelete(app.user!.id, app.full_name)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ border: '1px solid rgba(219,20,46,0.3)', color: '#db142e' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(219,20,46,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Trash2 size={15} /> Delete Seller
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SellerApplicationsPage() {
  const [tab, setTab]         = useState<Tab>('pending')
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SellerApplication | null>(null)
  const [toast, setToast]     = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [deleteTarget, setDeleteTarget]   = useState<{ userId: number; name: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [roleTarget, setRoleTarget]       = useState<{ userId: number; name: string } | null>(null)
  const [roleValue, setRoleValue]         = useState<'client' | 'seller'>('client')
  const [roleLoading, setRoleLoading]     = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await sellerApplicationsApi.list({ status: tab, search: search || undefined, page })
      setData(res)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [tab, search, page])

  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t) }, [fetchData])

  const handleApprove = async (id: number) => {
    await sellerApplicationsApi.approve(id)
    setSelected(null); showToast('Seller approved successfully.', 'success'); fetchData()
  }

  const handleReject = async (id: number, reason: string) => {
    await sellerApplicationsApi.reject(id, reason)
    setSelected(null); showToast('Application rejected.', 'success'); fetchData()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await sellersApi.delete(deleteTarget.userId)
      setDeleteTarget(null); setSelected(null)
      showToast(`${deleteTarget.name} has been deleted.`, 'success'); fetchData()
    } catch { showToast('Failed to delete seller.', 'error') }
    finally { setDeleteLoading(false) }
  }

  const confirmRoleChange = async () => {
    if (!roleTarget) return
    setRoleLoading(true)
    try {
      await sellersApi.changeRole(roleTarget.userId, roleValue)
      setRoleTarget(null); setSelected(null)
      showToast(`Role changed to "${roleValue}" successfully.`, 'success'); fetchData()
    } catch { showToast('Failed to change role.', 'error') }
    finally { setRoleLoading(false) }
  }

  const applications: SellerApplication[] = data?.data ?? []
  const total = data?.total ?? 0

  const TAB_LABELS: { key: Tab; label: string }[] = [
    { key: 'pending',  label: 'Pending'  },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Filters ── */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1 bg-bg-primary rounded-lg p-1 border border-border">
            {TAB_LABELS.map(({ key, label }) => (
              <button key={key} onClick={() => { setTab(key); setPage(1) }}
                className="px-4 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={tab === key ? { background: '#db142e', color: '#ffffff' } : { color: '#6b7280' }}
                onMouseEnter={e => { if (tab !== key) (e.currentTarget as HTMLElement).style.color = '#fcfdfd' }}
                onMouseLeave={e => { if (tab !== key) (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Search by name, business, email…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-bg-primary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple transition-colors" />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">
            Seller Applications
            <span className="ml-2 text-xs font-normal text-text-muted">({total} total)</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#db142e', borderTopColor: 'transparent' }} />
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
                  {['Applicant', 'Business', 'Category', 'Preferred Plan', 'Location', 'Applied', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
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
                          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid #1e2128' }}>
                            {pic
                              ? <img src={pic} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold"
                                  style={{ background: 'linear-gradient(135deg, #db142e, #9b0d1f)' }}>
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
                      <td className="px-5 py-4">
                        <PreferredPlanBadge plan={app.preferred_plan} />
                      </td>
                      <td className="px-5 py-4 text-sm text-text-muted">{app.city}, {app.wilaya}</td>
                      <td className="px-5 py-4 text-xs text-text-muted">{format(new Date(app.created_at), 'MMM d, yyyy')}</td>
                      <td className="px-5 py-4"><StatusBadge status={app.status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setSelected(app)}
                            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors" title="View details">
                            <Eye size={14} />
                          </button>
                          {app.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(app.id)}
                                className="p-1.5 rounded-md transition-colors" title="Approve" style={{ color: '#198f41' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(25,143,65,0.1)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <CheckCircle size={14} />
                              </button>
                              <button onClick={() => setSelected(app)}
                                className="p-1.5 rounded-md transition-colors" title="Reject" style={{ color: '#db142e' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(219,20,46,0.1)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {app.status === 'approved' && app.user && (
                            <>
                              <button onClick={() => { setRoleTarget({ userId: app.user!.id, name: app.full_name }); setRoleValue('client') }}
                                className="p-1.5 rounded-md transition-colors" title="Change Role" style={{ color: '#22b356' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(25,143,65,0.1)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <UserCog size={14} />
                              </button>
                              <button onClick={() => setDeleteTarget({ userId: app.user!.id, name: app.full_name })}
                                className="p-1.5 rounded-md transition-colors" title="Delete Seller" style={{ color: '#db142e' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(219,20,46,0.1)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <Trash2 size={14} />
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
            <span className="text-xs text-text-muted">Showing {data.from}–{data.to} of {data.total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary disabled:opacity-40 hover:bg-bg-hover transition-colors">Previous</button>
              <button onClick={() => setPage(p => Math.min(data.last_page, p + 1))} disabled={page === data.last_page}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary disabled:opacity-40 hover:bg-bg-hover transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selected && (
        <DetailModal
          app={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={(userId, name) => { setDeleteTarget({ userId, name }); setSelected(null) }}
          onChangeRole={(userId, name) => { setRoleTarget({ userId, name }); setRoleValue('client'); setSelected(null) }}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Seller Account"
          message={`Permanently delete "${deleteTarget.name}"? This will remove their account, all products, and application data. This cannot be undone.`}
          confirmLabel="Delete Seller" confirmColor="#db142e"
          loading={deleteLoading} onConfirm={confirmDelete} onClose={() => setDeleteTarget(null)} />
      )}

      {/* ── Change Role Confirm ── */}
      {roleTarget && (
        <ConfirmModal
          title="Change Seller Role"
          message={`Change the role for "${roleTarget.name}".`}
          confirmLabel="Confirm Change" confirmColor="#198f41"
          loading={roleLoading} onConfirm={confirmRoleChange} onClose={() => setRoleTarget(null)}>
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#6b7280' }}>New Role</label>
            <div className="flex gap-3">
              {(['client', 'seller'] as const).map(r => (
                <button key={r} onClick={() => setRoleValue(r)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
                  style={roleValue === r
                    ? { background: r === 'client' ? '#db142e' : '#198f41', color: '#fff', border: 'none' }
                    : { background: 'transparent', color: '#6b7280', border: '1px solid #1e2128' }}>
                  {r}
                </button>
              ))}
            </div>
            {roleValue === 'client' && (
              <p className="text-xs mt-2" style={{ color: '#f87171' }}>
                ⚠️ This will revoke their seller access and all products will become unlisted.
              </p>
            )}
          </div>
        </ConfirmModal>
      )}
    </div>
  )
}