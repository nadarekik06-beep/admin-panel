'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Mail, Package, Phone, Search, Store, UserCheck } from 'lucide-react'
import BrandLoader from '@/components/brand/BrandLoader'
import { productEditorApi, type SellerOption } from '@/lib/api/productEditor'
import { apiErrorMessage } from '../reviewUtils'
import ProductEditorForm from '../[id]/edit/_components/ProductEditorForm'

/**
 * /products/new — add a product to a seller's shop.
 *   Step 1: pick an approved, active seller (name, shop, e-mail, phone).
 *   Step 2: the shared admin product form (same as /products/{id}/edit).
 * Products only: sellers still fill in their own shop application.
 */
export default function AddProductPage() {
  const [seller, setSeller] = useState<SellerOption | null>(null)

  if (seller) {
    return <ProductEditorForm key={seller.id} mode="create" seller={seller} onChangeSeller={() => setSeller(null)} />
  }
  return <SellerPicker onPick={setSeller} />
}

function SellerPicker({ onPick }: { onPick: (s: SellerOption) => void }) {
  const [search, setSearch]   = useState('')
  const [rows, setRows]       = useState<SellerOption[] | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      productEditorApi.sellerOptions(search.trim())
        .then((r) => { if (!cancelled) { setRows(r); setError(null) } })
        .catch((e) => { if (!cancelled) setError(apiErrorMessage(e, 'Could not load sellers.')) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search])

  return (
    <div className="max-w-4xl mx-auto">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Step 1 of 2 · Seller</p>
      <h1 className="text-lg sm:text-xl font-bold text-text-primary">Add a product for a seller</h1>
      <p className="text-xs text-text-muted mt-1 mb-4">
        The product goes into the seller&apos;s shop, they get notified and can edit it afterwards. Only approved, active sellers are listed.
      </p>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, shop name, e-mail or phone…"
          className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-bg-card border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#db142e]/60"
        />
        {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2"><BrandLoader variant="inline" size={14} /></span>}
      </div>

      {error && (
        <p className="flex items-center gap-2 text-xs text-[#f87171] bg-[#db142e]/10 border border-[#db142e]/30 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle size={13} /> {error}
        </p>
      )}

      {rows && rows.length === 0 && !loading && (
        <div className="text-center text-sm text-text-muted bg-bg-card border border-border rounded-xl py-10">No approved seller matches “{search}”.</div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {(rows ?? []).map((s) => {
          const full = s.product_limit !== null && s.product_count >= s.product_limit
          return (
            <button
              key={s.id} type="button" disabled={full} onClick={() => onPick(s)}
              title={full ? `Plan limit reached (${s.product_count}/${s.product_limit} products)` : `Add a product for ${s.shop_name || s.name}`}
              className={clsx(
                'text-left rounded-xl border bg-bg-card p-3 transition-colors',
                full ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:border-[#198f41]/60 hover:bg-bg-hover',
              )}
            >
              <div className="flex items-start gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#198f41]/15 text-[#34d399] flex items-center justify-center flex-shrink-0"><Store size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">{s.shop_name || s.name}</p>
                  <p className="text-[11px] text-text-muted truncate flex items-center gap-1"><UserCheck size={11} /> {s.name}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-text-secondary flex-shrink-0">{s.plan.name}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-0.5 text-[11px] text-text-muted">
                <span className="flex items-center gap-1 truncate"><Mail size={11} /> {s.email}</span>
                {s.phone && <span className="flex items-center gap-1"><Phone size={11} /> {s.phone}</span>}
                <span className={clsx('flex items-center gap-1', full && 'text-[#f87171] font-semibold')}>
                  <Package size={11} /> {s.product_count}{s.product_limit !== null ? ` / ${s.product_limit}` : ''} products{full ? ' · plan limit reached' : ''}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
