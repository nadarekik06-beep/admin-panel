'use client'

/**
 * Seller page: identity, "Profil de la boutique" (logo / description /
 * activity categories, history, restore) and the full "Adresse de pickup" card (Intigo form
 * order, copy buttons, map, verify / create in Intigo, change history).
 * Linked from the sellers list, the seller modal and the admin notification
 * "Adresse de pickup modifiée : mettre à jour dans Intigo".
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Mail, Phone, Store } from 'lucide-react'
import { format } from 'date-fns'
import Badge from '@/components/ui/Badge'
import PickupAddressCard from '@/components/pickup/PickupAddressCard'
import StoreProfileAdminCard from '@/components/seller/StoreProfileAdminCard'
import { sellersApi } from '@/lib/api/sellers'
import BrandLoader from '@/components/brand/BrandLoader'
import { usePageLoading } from '@/components/brand/NavigationLoader'

interface SellerInfo {
  id: number
  name: string
  email: string
  is_active: boolean
  is_approved: boolean
  created_at: string
  products_count?: number
  full_name?: string | null
  phone_number?: string | null
  business_name?: string | null
  profile_picture?: string | null
  active_plan?: string | null
  app_status?: string | null
}

export default function SellerPage() {
  const { id } = useParams<{ id: string }>()
  const sellerId = Number(id)
  const [seller,  setSeller]  = useState<SellerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  usePageLoading(loading)

  useEffect(() => {
    sellersApi.get(sellerId)
      .then(setSeller)
      .catch(() => setError('Seller not found (or not a seller yet: see Seller Applications).'))
      .finally(() => setLoading(false))
  }, [sellerId])

  const status = !seller ? null : !seller.is_active ? 'suspended' : seller.is_approved ? 'approved' : 'pending'

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/sellers" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft size={15} /> Sellers
      </Link>

      {loading && <BrandLoader variant="section" minHeight={160} />}
      {error && <div className="bg-bg-card border border-border rounded-xl p-4 text-sm text-accent-red">{error}</div>}

      {seller && (
        <div className="bg-bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-4">
          {seller.profile_picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.profile_picture} alt="" className="w-14 h-14 rounded-full object-cover" style={{ border: '2px solid #db142e' }} />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl text-white" style={{ background: 'linear-gradient(135deg, #db142e 0%, #9b0d1f 100%)' }}>
              {(seller.business_name ?? seller.name).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-2 font-bold text-lg text-text-primary truncate"><Store size={16} className="text-text-muted" />{seller.business_name ?? seller.name}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary mt-1">
              <span>#{seller.id} · {seller.full_name ?? seller.name}</span>
              <span className="inline-flex items-center gap-1"><Mail size={12} />{seller.email}</span>
              {seller.phone_number && <span className="inline-flex items-center gap-1"><Phone size={12} />{seller.phone_number}</span>}
              <span>Joined {format(new Date(seller.created_at), 'dd MMM yyyy')}</span>
              <span>{seller.products_count ?? 0} products</span>
            </div>
          </div>
          {status && <Badge variant={status}>{status}</Badge>}
        </div>
      )}

      {seller && <StoreProfileAdminCard key={seller.id} sellerId={seller.id} />}

      {(seller || error) && Number.isFinite(sellerId) && <PickupAddressCard sellerId={sellerId} />}
    </div>
  )
}
