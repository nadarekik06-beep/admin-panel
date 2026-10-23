import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/ClientSidebar'
import { NavigationLoaderHost } from '@/components/brand/NavigationLoader'
import MobileTables from '@/components/mobile/MobileTables'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <MobileTables />

      <div className="flex-1 flex flex-col lg:ml-[260px] transition-all duration-300 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
        {/* navigation loader over the content area: sidebar and header stay visible */}
        <div className="admin-loader-area" style={{ '--ctl-area-top': '64px' } as React.CSSProperties}>
          <NavigationLoaderHost area />
        </div>
      </div>
    </div>
  )
}