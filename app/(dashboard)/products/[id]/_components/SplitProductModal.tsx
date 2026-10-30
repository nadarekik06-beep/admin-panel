'use client'

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Plus, Scissors, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import BrandLoader from '@/components/brand/BrandLoader'
import type { ProductReview } from '@/types/productReview'
import { productEditorApi } from '@/lib/api/productEditor'
import { apiErrorMessage } from '../../reviewUtils'

interface Group { key: number; name: string; stock: string; price: string; image_ids: number[] }

/**
 * "Split into separate products": the admin assigns gallery photos to new products.
 * Each new product belongs to the same seller and copies the shared fields
 * (category, subcategory, descriptions, price, parcel size, delivery, occasions).
 */
export default function SplitProductModal({ open, product, onClose, onDone }: {
  open: boolean
  product: ProductReview
  onClose: () => void
  onDone: (message: string) => void
}) {
  // One tile per photo file (color photos shared by several colors are stored once per color)
  const photos = useMemo(() => {
    const seen = new Set<string>()
    return product.media.images.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)))
  }, [product.media.images])

  const fresh = (n: number): Group => ({ key: Date.now() + n, name: `${product.name} – model ${n}`, stock: '1', price: '', image_ids: [] })
  const [groups, setGroups]   = useState<Group[]>([])
  const [active, setActive]   = useState(0)
  const [move, setMove]       = useState(true)
  const [publish, setPublish] = useState(false)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setGroups([fresh(1)]); setActive(0); setMove(true); setPublish(false); setError(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const owner = (id: number) => groups.findIndex((g) => g.image_ids.includes(id))
  const toggle = (id: number) => {
    const o = owner(id)
    setGroups((gs) => gs.map((g, i) => {
      if (i === o) return { ...g, image_ids: g.image_ids.filter((x) => x !== id) }
      if (i === active && o !== active) return { ...g, image_ids: [...g.image_ids, id] }
      return g
    }))
  }
  const patch = (i: number, p: Partial<Group>) => setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, ...p } : g)))

  const assigned = groups.reduce((n, g) => n + g.image_ids.length, 0)
  const problem =
    groups.some((g) => g.name.trim().length < 3) ? 'Give each new product a name (3+ characters).'
    : groups.some((g) => !(parseInt(g.stock, 10) >= 1)) ? 'Each new product needs a stock of at least 1.'
    : groups.some((g) => g.image_ids.length === 0) ? 'Pick at least one photo for each new product.'
    : move && assigned >= photos.length ? 'Keep at least one photo on the original product, or uncheck “Move the photos”.'
    : null

  const submit = async () => {
    if (problem) { setError(problem); return }
    setBusy(true); setError(null)
    try {
      const res = await productEditorApi.split(product.id, groups.map((g) => ({
        name: g.name.trim(), stock: parseInt(g.stock, 10), price: g.price.trim() ? Number(g.price) : null, image_ids: g.image_ids,
      })), move, publish)
      onDone(`${res.message} New: ${res.data.map((p) => `#${p.id}`).join(', ')}`)
    } catch (err) {
      const errors = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors
      setError(errors ? Object.values(errors)[0]?.[0] ?? 'Some fields are invalid.' : apiErrorMessage(err, 'Split failed.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Split into separate products" size="lg">
      <p className="text-xs text-text-muted mb-3">
        For listings that hold several different articles. Pick a new product, then click its photos. Each new product goes to
        the same seller with this product&apos;s category, subcategory, descriptions, price and delivery settings. Variants are not copied.
      </p>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
        {photos.map((img) => {
          const o = owner(img.id)
          return (
            <button
              key={img.id} type="button" onClick={() => toggle(img.id)}
              className={clsx('relative aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                o === -1 ? 'border-border hover:border-text-muted' : o === active ? 'border-[#198f41]' : 'border-[#db142e]/60 opacity-70')}
              title={o === -1 ? 'Add to the selected new product' : `In new product ${o + 1}`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              {o !== -1 && (
                <span className={clsx('absolute top-1 left-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center',
                  o === active ? 'bg-[#198f41]' : 'bg-[#db142e]')}>{o + 1}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="space-y-2 mb-3">
        {groups.map((g, i) => (
          <div
            key={g.key} onClick={() => setActive(i)}
            className={clsx('rounded-lg border p-2.5 cursor-pointer', i === active ? 'border-[#198f41]/70 bg-[#198f41]/[0.06]' : 'border-border')}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={clsx('w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white', i === active ? 'bg-[#198f41]' : 'bg-bg-hover text-text-secondary')}>{i + 1}</span>
              <span className="text-xs text-text-muted">{g.image_ids.length} photo{g.image_ids.length === 1 ? '' : 's'}{i === active ? ' · click photos to add' : ''}</span>
              {groups.length > 1 && (
                <button type="button" className="ml-auto text-text-muted hover:text-[#f87171]" title="Remove"
                  onClick={(e) => { e.stopPropagation(); setGroups((gs) => gs.filter((_, j) => j !== i)); setActive(0) }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1fr_80px_100px] gap-2">
              <input value={g.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Name of the new product"
                className="px-2.5 py-1.5 rounded-md bg-bg-primary border border-border text-xs text-text-primary" />
              <input value={g.stock} onChange={(e) => patch(i, { stock: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="Stock" title="Stock"
                className="px-2.5 py-1.5 rounded-md bg-bg-primary border border-border text-xs text-text-primary" />
              <input value={g.price} onChange={(e) => patch(i, { price: e.target.value })} inputMode="decimal" placeholder={`${product.pricing.base_price} TND`} title="Price (empty = same price)"
                className="px-2.5 py-1.5 rounded-md bg-bg-primary border border-border text-xs text-text-primary" />
            </div>
          </div>
        ))}
        {groups.length < 10 && (
          <button type="button" onClick={() => { setGroups((gs) => [...gs, fresh(gs.length + 1)]); setActive(groups.length) }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#34d399] hover:underline">
            <Plus size={13} /> Add another new product
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-text-secondary mb-4">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} className="accent-[#db142e]" /> Move the photos (remove them from this product)</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="accent-[#198f41]" /> Publish the new products now (otherwise they wait in the review queue)</label>
      </div>

      {error && <p className="flex items-center gap-1.5 text-xs text-[#f87171] mb-3"><AlertTriangle size={13} /> {error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-hover">Cancel</button>
        <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#db142e] text-white text-sm font-semibold disabled:opacity-50">
          {busy ? <BrandLoader variant="inline" size={14} /> : <Scissors size={14} />} Create {groups.length} product{groups.length === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  )
}
