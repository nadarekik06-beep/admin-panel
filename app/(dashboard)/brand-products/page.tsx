'use client'

/**
 * admin-panel/app/(dashboard)/brand-products/page.tsx
 *
 * CHOOSE'Tounsi brand products management page.
 * Dark-themed, structured identically to the seller products page.
 * Full variant support — same modal as seller.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Search, Filter, Edit2, Trash2, Package,
  CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Loader2, Image as ImageIcon, Eye, Layers, Star,
  BarChart2,
} from 'lucide-react'
import { brandProductsApi, type BrandProduct } from '@/lib/api/brandProducts'
import BrandProductModal from './BrandProductModal'

// ── Types ──────────────────────────────────────────────────────────────────

interface PaginatedData {
  data: BrandProduct[]
  total: number
  current_page: number
  last_page: number
  per_page: number
  from: number
  to: number
}

interface ModalState {
  open: boolean
  product: BrandProduct | null
}

const MODAL_CLOSED: ModalState = { open: false, product: null }

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: '#161b27', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 100,
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>
        {value}
      </p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function BrandProductsPage() {
  const [data,       setData]       = useState<PaginatedData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [isActive,   setIsActive]   = useState('')
  const [isFeatured, setIsFeatured] = useState('')
  const [page,       setPage]       = useState(1)
  const [modal,      setModal]      = useState<ModalState>(MODAL_CLOSED)
  const [deleting,   setDeleting]   = useState<number | null>(null)
  const [stats,      setStats]      = useState<any>(null)

  // dark theme tokens — matching the rest of the admin panel
  const border    = 'rgba(255,255,255,0.07)'
  const cardBg    = '#161b27'
  const textMain  = '#ffffff'
  const textMuted = 'rgba(255,255,255,0.38)'
  const inputBg   = '#0d1117'
  const theadBg   = 'rgba(255,255,255,0.04)'
  const rowHover  = 'rgba(255,255,255,0.03)'

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${border}`, borderRadius: 10,
    padding: '8px 12px', fontSize: 13, fontWeight: 500,
    background: inputBg, color: textMain, outline: 'none',
  }

  // Close modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal.open) setModal(MODAL_CLOSED)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modal.open])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, per_page: 15 }
      if (search)     params.search    = search
      if (isActive)   params.is_active = isActive === 'active'
      if (isFeatured) params.featured  = isFeatured === 'featured'
      const res = await brandProductsApi.list(params)
      setData(res.data ?? res)
    } catch {
      // keep previous data
    } finally {
      setLoading(false)
    }
  }, [page, search, isActive, isFeatured])

  const fetchStats = useCallback(async () => {
    try {
      const s = await brandProductsApi.stats()
      setStats(s.data ?? s)  
  } catch {}
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { fetchStats() }, [fetchStats])

  const openAddModal  = () => setModal({ open: true, product: null })
  const closeModal    = () => setModal(MODAL_CLOSED)
  const handleSaved   = () => { closeModal(); fetchProducts(); fetchStats() }

  const handleEdit = async (product: BrandProduct) => {
    try {
     const full = await brandProductsApi.get(product.id)
      setModal({ open: true, product: full.data ?? full })
    } catch {
      setModal({ open: true, product })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this brand product? This cannot be undone.')) return
    setDeleting(id)
    try {
      await brandProductsApi.delete(id)
      fetchProducts()
      fetchStats()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <style>{`
        .bp-row:hover td { background: ${rowHover} !important; }
        .bp-btn:hover { opacity: 1 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: textMain, margin: 0, letterSpacing: '-0.02em' }}>
                Brand Products
              </h1>
              <span style={{
                fontSize: 9, fontWeight: 800,
                color: '#db142e', background: 'rgba(219,20,46,0.12)',
                border: '1px solid rgba(219,20,46,0.25)',
                padding: '2px 8px', borderRadius: 999,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Platform Owned
              </span>
            </div>
            <p style={{ fontSize: 11, color: textMuted, margin: 0, fontWeight: 500 }}>
              CHOOSE'Tounsi original products — full variant &amp; image support
            </p>
          </div>
          <button
            onClick={openAddModal}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px',
              background: 'linear-gradient(135deg,#db142e,#a00f22)',
              color: '#fff', fontWeight: 800, fontSize: 13,
              borderRadius: 12, border: 'none', cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(219,20,46,0.35)',
            }}
          >
            <Plus size={15} /> Add Brand Product
          </button>
        </div>

        {/* ── Stats ── */}
        {stats && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard label="Total"       value={stats.total}        color={textMain}  />
            <StatCard label="Active"      value={stats.active}       color="#10b981"   />
            <StatCard label="Featured"    value={stats.featured}     color="#f59e0b"   />
            <StatCard label="Total Stock" value={stats.total_stock}  color="#3b82f6"   />
            <StatCard label="Out of Stock"value={stats.out_of_stock} color="#ef4444"   />
            <StatCard label="Total Views" value={stats.total_views}  color="#8b5cf6"   />
          </div>
        )}

        {/* ── Filters ── */}
        <div style={{ background: cardBg, borderRadius: 16, padding: 16, border: `1px solid ${border}`, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: textMuted, pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by name or SKU…"
              style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={13} style={{ color: textMuted, flexShrink: 0 }} />
            <select value={isActive} onChange={e => { setIsActive(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select value={isFeatured} onChange={e => { setIsFeatured(e.target.value); setPage(1) }} style={inputStyle}>
              <option value="">All Products</option>
              <option value="featured">Featured Only</option>
            </select>
          </div>
          {data && (
            <span style={{ fontSize: 11, fontWeight: 700, color: textMuted, marginLeft: 'auto' }}>
              {data.total} product{data.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ background: cardBg, borderRadius: 18, border: `1px solid ${border}`, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
              <Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite', color: '#db142e' }} />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: theadBg }}>
                    {['Product', 'Category', 'Price', 'Stock', 'Status', 'Badges', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '10px 20px', fontSize: 9, fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted,
                        textAlign: ['Price', 'Stock'].includes(h) ? 'right' : ['Status', 'Badges', 'Actions'].includes(h) ? 'center' : 'left',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map(product => {
                    const displayStock = product.has_variants ? product.variant_stock : product.stock
                    const thumbUrl     = product.primary_image_url

                    return (
                      <tr key={product.id} className="bp-row" style={{ borderTop: `1px solid ${border}` }}>

                        {/* Product */}
                        <td style={{ padding: '12px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 10,
                              background: 'rgba(255,255,255,0.06)', border: `1px solid ${border}`,
                              flexShrink: 0, overflow: 'hidden',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {thumbUrl
                                ? <img src={thumbUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <ImageIcon size={14} style={{ color: textMuted, opacity: 0.5 }} />
                              }
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontWeight: 800, color: textMain, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                                {product.name}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <p style={{ fontSize: 10, color: textMuted, margin: 0 }}>
                                  {product.sku ? `SKU: ${product.sku}` : `ID #${product.id}`}
                                </p>
                                {product.has_variants && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 800, color: '#6366f1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '1px 5px', borderRadius: 4 }}>
                                    <Layers size={8} /> variants
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td style={{ padding: '12px 20px', fontSize: 12, fontWeight: 500, color: textMuted }}>
                          {product.category?.name ?? '—'}
                        </td>

                        {/* Price */}
                        <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 900, color: textMain }}>
                          {Number(product.price).toFixed(3)} TND
                        </td>

                        {/* Stock */}
                        <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, color: displayStock === 0 ? '#ef4444' : displayStock <= 10 ? '#f59e0b' : textMain }}>
                            {displayStock}
                            {displayStock === 0    && <span style={{ fontSize: 10, marginLeft: 4, color: '#ef4444' }}>(Out)</span>}
                            {displayStock > 0 && displayStock <= 10 && <span style={{ fontSize: 10, marginLeft: 4, color: '#f59e0b' }}>(Low)</span>}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: product.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: product.is_active ? '#10b981' : '#ef4444', border: `1px solid ${product.is_active ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                            {product.is_active ? <><CheckCircle size={9} />Active</> : <><XCircle size={9} />Inactive</>}
                          </span>
                        </td>

                        {/* Badges */}
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                          {product.featured
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', padding: '3px 8px', borderRadius: 999 }}>
                                <Star size={8} fill="currentColor" /> Featured
                              </span>
                            : <span style={{ color: textMuted, fontSize: 11 }}>—</span>
                          }
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <button
                              onClick={() => handleEdit(product)}
                              className="bp-btn"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#94a3b8', opacity: 0.7 }}
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={deleting === product.id}
                              className="bp-btn"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#94a3b8', opacity: deleting === product.id ? 0.4 : 0.7 }}
                              title="Delete"
                            >
                              {deleting === product.id
                                ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                                : <Trash2 size={13} />
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {data?.data.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '56px 20px', textAlign: 'center' }}>
                        <Package size={28} style={{ margin: '0 auto 10px', display: 'block', color: textMuted, opacity: 0.4 }} />
                        <p style={{ fontSize: 13, fontWeight: 700, color: textMuted, margin: '0 0 4px' }}>No brand products yet</p>
                        <p style={{ fontSize: 11, color: textMuted, opacity: 0.6, margin: 0 }}>Click "Add Brand Product" to create the first one</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && data.last_page > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: `1px solid ${border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: textMuted }}>
                Showing {data.from}–{data.to} of {data.total}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: 6, borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', color: textMuted, opacity: page === 1 ? 0.4 : 1 }}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 11, fontWeight: 800, color: textMain, padding: '0 4px' }}>
                  {data.current_page}/{data.last_page}
                </span>
                <button onClick={() => setPage(p => Math.min(data.last_page, p + 1))} disabled={page === data.last_page}
                  style={{ padding: 6, borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', color: textMuted, opacity: page === data.last_page ? 0.4 : 1 }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <BrandProductModal
          product={modal.product}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}