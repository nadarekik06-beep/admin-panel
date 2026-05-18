// admin-panel/app/finance/page.tsx
'use client'

import dynamic from 'next/dynamic'
const FinancePage = dynamic(() => import('./FinancePage'), { ssr: false })
export default function Page() { return <FinancePage /> }