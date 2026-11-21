'use client'

import { useEffect, useState } from 'react'
import { BadgePercent } from 'lucide-react'
import { specialCommissionsApi, SOURCE_LABEL, type PricePreview } from '@/lib/api/specialCommissions'

/**
 * Commission shown to the admin next to a product's price (add product on behalf of a seller,
 * and edit). Every figure comes from the backend (CommissionService, same as checkout):
 * the seller's rate, a live special commission on this product, the money at this price.
 */
export default function CommissionHint({ sellerId, productId, price }: { sellerId: number | null | undefined; productId?: number | null; price: string }) {
  const [data, setData] = useState<PricePreview | null>(null)
  const n = parseFloat(price)

  useEffect(() => {
    if (!sellerId || !Number.isFinite(n) || n <= 0) { setData(null); return }
    let cancelled = false
    const t = setTimeout(() => {
      specialCommissionsApi.previewPrice({ seller_id: sellerId, product_id: productId || null, price: n })
        .then((r) => { if (!cancelled) setData(r) })
        .catch(() => { if (!cancelled) setData(null) })
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [sellerId, productId, n])

  if (!data) return null
  const special = data.special_offer

  return (
    <div className="rounded-lg border border-border bg-bg-primary p-3 text-xs space-y-1">
      <p className="text-text-secondary">
        Commission: <strong className="text-text-primary">{data.commission_percentage}%</strong>
        {special
          ? <> — <span style={{ color: '#198f41' }} className="font-semibold"><BadgePercent size={11} className="inline -mt-0.5" /> special commission (normally {data.normal_rate}%)</span></>
          : <> ({SOURCE_LABEL[data.commission_source] ?? data.commission_source})</>}
      </p>
      <p className="text-text-muted">
        At {data.unit_price.toFixed(3)} DT: platform {data.commission_amount.toFixed(3)} DT · seller net <span className="text-[#34d399]">{data.seller_amount.toFixed(3)} DT</span>
        {' '}· delivery excluded
      </p>
      {special && (
        <p className="text-text-muted">
          {special.ends_at ? `Until ${new Date(special.ends_at).toLocaleDateString()}. ` : 'No end date. '}
          <a href="/special-commissions" className="underline">Manage</a>
        </p>
      )}
    </div>
  )
}
