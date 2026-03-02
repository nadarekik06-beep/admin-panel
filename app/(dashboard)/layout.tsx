import dynamic from 'next/dynamic'
import Header from '@/components/layout/Header'

const Sidebar = dynamic(
  () => import('@/components/layout/Sidebar'),
  { ssr: false }
)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />

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