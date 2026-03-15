'use client'

import Link from 'next/link'
import Image from 'next/image'
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
  FileText,
} from 'lucide-react'
import { adminAuthApi } from '@/lib/api/auth'
import { authStorage } from '@/lib/auth'
import { Admin } from '@/types'
import clsx from 'clsx'

const LOGO_SRC = '/images/logo.png'

const navItems = [
  { href: '/',                    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/users',               label: 'Users',        icon: Users           },
  { href: '/sellers',             label: 'Sellers',      icon: Store           },
  { href: '/seller-applications', label: 'Applications', icon: FileText        },
  { href: '/products',            label: 'Products',     icon: Package         },
  { href: '/orders',              label: 'Orders',       icon: ShoppingCart    },
  { href: '/statistics',          label: 'Statistics',   icon: BarChart3       },
]

// ─── Logo component ───────────────────────────────────────────────────────────
// No border, no radius, no shadow — just the image rendered cleanly.
// mixBlendMode:'screen' makes the white PNG background transparent
// against the dark sidebar without any extra container styling.
function LogoIcon({ size }: { size: 'md' | 'sm' }) {
  const dim = size === 'md' ? 48 : 40

  return (
    <div style={{ position: 'relative', width: dim, height: dim, flexShrink: 0 }}>
      <Image
        src={LOGO_SRC}
        alt="Choose'Tounsi logo"
        fill
        sizes={`${dim}px`}
        quality={100}
        priority
        style={{
          objectFit:      'contain',   // full icon, never cropped
          objectPosition: 'center',    // perfectly centered
          mixBlendMode:   'screen',    // white bg dissolves on dark sidebar
        }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  )
}

export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const [collapsed, setCollapsed]   = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [admin, setAdmin]           = useState<Admin | null>(null)

  useEffect(() => { setAdmin(authStorage.getAdmin()) }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try { await adminAuthApi.logout() }
    finally { authStorage.clear(); router.push('/login') }
  }

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen border-r transition-all duration-300 ease-in-out fixed left-0 top-0 z-40',
        collapsed ? 'w-[70px]' : 'w-[260px]'
      )}
      style={{
        background:  'linear-gradient(180deg, #111318 0%, #0d0f14 100%)',
        borderColor: '#1e2128',
        boxShadow:   '4px 0 24px rgba(0,0,0,0.5)',
      }}
    >
      {/* ── Logo header ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 h-16"
        style={{ borderBottom: '1px solid #1e2128' }}
      >
        {/* Expanded */}
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <LogoIcon size="md" />
            <div className="min-w-0 leading-none">
              <p className="font-black text-[13px] tracking-[0.08em] text-white truncate leading-tight">
                CHOOSE
              </p>
              <p className="font-black text-[13px] tracking-[0.08em] leading-tight" style={{ color: '#db142e' }}>
                TOUNSI
              </p>
            </div>
          </div>
        )}

        {/* Collapsed */}
        {collapsed && (
          <div className="mx-auto">
            <LogoIcon size="sm" />
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx('p-1.5 rounded-md transition-colors flex-shrink-0', collapsed && 'mx-auto mt-2')}
          style={{ color: '#6b7280' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fcfdfd')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* ── Section label ─────────────────────────────────── */}
      {!collapsed && (
        <div className="px-4 pt-5 pb-1">
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: '#198f41' }}>
            Main Menu
          </p>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon     = item.icon
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative"
              style={
                isActive
                  ? {
                      background:  'linear-gradient(90deg, rgba(219,20,46,0.18) 0%, rgba(219,20,46,0.06) 100%)',
                      borderLeft:  '2.5px solid #db142e',
                      color:       '#fcfdfd',
                    }
                  : { color: '#9ca3af', borderLeft: '2.5px solid transparent' }
              }
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                  ;(e.currentTarget as HTMLElement).style.color = '#fcfdfd'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#9ca3af'
                }
              }}
            >
              <Icon
                size={18}
                className="flex-shrink-0"
                style={{ color: isActive ? '#db142e' : 'inherit' }}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#db142e', boxShadow: '0 0 6px #db142e' }}
                />
              )}
              {collapsed && (
                <span
                  className="absolute left-16 text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 font-medium"
                  style={{
                    background: '#16191f',
                    color:      '#fcfdfd',
                    border:     '1px solid #1e2128',
                    boxShadow:  '0 4px 16px rgba(0,0,0,0.4)',
                  }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Green divider ─────────────────────────────────── */}
      <div
        className="mx-4 my-1"
        style={{ height: 1, background: 'linear-gradient(90deg, transparent, #198f41, transparent)' }}
      />

      {/* ── Admin profile + logout ───────────────────────── */}
      <div className="p-3">
        {!collapsed && admin && (
          <div
            className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl"
            style={{ background: '#16191f', border: '1px solid #1e2128' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs text-white"
              style={{
                background: 'linear-gradient(135deg, #db142e 0%, #9b0d1f 100%)',
                boxShadow:  '0 0 12px rgba(219,20,46,0.4)',
              }}
            >
              {admin.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: '#fcfdfd' }}>{admin.name}</p>
              <p className="text-[11px] capitalize" style={{ color: '#198f41' }}>
                {admin.role.replace('_', ' ')}
              </p>
            </div>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#198f41', boxShadow: '0 0 6px #198f41' }}
            />
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? 'Logout' : undefined}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium',
            collapsed && 'justify-center'
          )}
          style={{ color: '#6b7280' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(219,20,46,0.10)'
            ;(e.currentTarget as HTMLElement).style.color = '#db142e'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#6b7280'
          }}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && (loggingOut ? 'Logging out...' : 'Logout')}
        </button>
      </div>
    </aside>
  )
}