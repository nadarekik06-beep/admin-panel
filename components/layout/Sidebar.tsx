'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingCart,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileText,   // ← new
} from 'lucide-react'
import { adminAuthApi } from '@/lib/api/auth'
import { authStorage } from '@/lib/auth'
import { Admin } from '@/types'
import clsx from 'clsx'

const navItems = [
  { href: '/',                    label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/users',               label: 'Users',              icon: Users           },
  { href: '/sellers',             label: 'Sellers',            icon: Store           },
  { href: '/seller-applications', label: 'Applications',       icon: FileText        }, // ← new
  { href: '/products',            label: 'Products',           icon: Package         },
  { href: '/orders',              label: 'Orders',             icon: ShoppingCart    },
  { href: '/statistics',          label: 'Statistics',         icon: BarChart3       },
]

export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const [collapsed, setCollapsed]   = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [admin, setAdmin]           = useState<Admin | null>(null)

  useEffect(() => {
    setAdmin(authStorage.getAdmin())
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await adminAuthApi.logout()
    } finally {
      authStorage.clear()
      router.push('/login')
    }
  }

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen bg-bg-secondary border-r border-border',
        'transition-all duration-300 ease-in-out fixed left-0 top-0 z-40',
        collapsed ? 'w-[70px]' : 'w-[260px]'
      )}
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-purple flex items-center justify-center shadow-glow">
              <Shield size={16} className="text-white" />
            </div>
            <span className="font-bold text-text-primary text-sm tracking-wide">
              Admin<span className="text-accent-purple-light">Panel</span>
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-gradient-purple flex items-center justify-center mx-auto shadow-glow">
            <Shield size={16} className="text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            'p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors',
            collapsed && 'mx-auto mt-2'
          )}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon     = item.icon
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
                isActive
                  ? 'bg-accent-purple/20 text-accent-purple-light border border-accent-purple/30'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent-purple rounded-r-full" />
              )}
              <Icon
                size={18}
                className={clsx(
                  'flex-shrink-0 transition-colors',
                  isActive
                    ? 'text-accent-purple-light'
                    : 'text-text-muted group-hover:text-text-primary'
                )}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {collapsed && (
                <span className="absolute left-14 bg-bg-card text-text-primary text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border shadow-card z-50">
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Admin profile + logout ───────────────────────── */}
      <div className="p-3 border-t border-border">
        {!collapsed && admin && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg bg-bg-hover">
            <div className="w-8 h-8 rounded-full bg-gradient-purple flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {admin.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{admin.name}</p>
              <p className="text-xs text-text-muted capitalize">
                {admin.role.replace('_', ' ')}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? 'Logout' : undefined}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'text-text-muted hover:text-accent-red hover:bg-accent-red/10',
            'transition-all duration-200',
            collapsed && 'justify-center'
          )}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && (
            <span className="text-sm font-medium">
              {loggingOut ? 'Logging out...' : 'Logout'}
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}