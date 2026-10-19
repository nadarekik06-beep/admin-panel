'use client'

import dynamic from 'next/dynamic'

// Next 15 only allows `ssr: false` inside a Client Component: the (server) dashboard layout renders this.
const ClientSidebar = dynamic(() => import('./Sidebar'), { ssr: false })

export default ClientSidebar
