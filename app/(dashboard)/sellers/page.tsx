'use client'

import dynamic from 'next/dynamic'

const SellersPage = dynamic(() => import('./SellersPage'), { ssr: false })

export default function Page() {
  return <SellersPage />
}