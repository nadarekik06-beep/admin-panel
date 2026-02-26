import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />

      {/* Main content shifts based on sidebar width — we use margin + CSS var */}
      <div className="flex-1 flex flex-col ml-[260px] transition-all duration-300 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}