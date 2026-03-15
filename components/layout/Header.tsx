'use client'

import { Bell } from 'lucide-react'
import { authStorage } from '@/lib/auth'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Admin } from '@/types'

const pageTitles: Record<string, string> = {
  '/':                    'Dashboard',
  '/users':               'User Management',
  '/sellers':             'Seller Management',
  '/seller-applications': 'Seller Applications',
  '/products':            'Product Management',
  '/orders':              'Orders',
  '/statistics':          'Statistics & Analytics',
}

export default function Header() {
  const pathname = usePathname()
  const [admin, setAdmin]           = useState<Admin | null>(null)
  const [bellHover, setBellHover]   = useState(false)

  useEffect(() => { setAdmin(authStorage.getAdmin()) }, [])

  const title = pageTitles[pathname] ?? 'Admin Panel'

  return (
    <header
      className="h-16 flex items-center justify-between px-6 sticky top-0 z-30"
      style={{
        background:   '#111318',
        borderBottom: '1px solid #1e2128',
        boxShadow:    '0 2px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── Left: breadcrumb + title ── */}
      <div className="flex items-center gap-3">
        {/* Red accent bar */}
        <div
          className="w-1 h-7 rounded-full flex-shrink-0"
          style={{ background: 'linear-gradient(180deg, #db142e 0%, #9b0d1f 100%)', boxShadow: '0 0 8px rgba(219,20,46,0.5)' }}
        />
        <div>
          <h1 className="text-base font-bold tracking-tight" style={{ color: '#fcfdfd' }}>
            {title}
          </h1>
          <p className="text-[11px] hidden sm:block" style={{ color: '#6b7280' }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year:    'numeric',
              month:   'long',
              day:     'numeric',
            })}
          </p>
        </div>
      </div>

      {/* ── Right: bell + divider + admin ── */}
      <div className="flex items-center gap-3">

        {/* Bell button */}
        <button
          className="relative p-2 rounded-xl transition-all duration-200"
          style={{
            background: bellHover ? 'rgba(219,20,46,0.10)' : 'rgba(255,255,255,0.04)',
            border:     '1px solid #1e2128',
            color:      bellHover ? '#db142e' : '#6b7280',
          }}
          onMouseEnter={() => setBellHover(true)}
          onMouseLeave={() => setBellHover(false)}
        >
          <Bell size={17} />
          {/* Red notification dot */}
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: '#db142e', boxShadow: '0 0 6px #db142e' }}
          />
        </button>

        {/* Vertical divider */}
        <div
          className="h-8 w-px"
          style={{ background: 'linear-gradient(180deg, transparent, #198f41, transparent)' }}
        />

        {/* Admin info */}
        {admin && (
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #db142e 0%, #9b0d1f 100%)',
                boxShadow:  '0 0 12px rgba(219,20,46,0.35)',
              }}
            >
              {admin.name.charAt(0).toUpperCase()}
            </div>

            <div className="hidden md:block">
              <p className="text-sm font-semibold leading-none" style={{ color: '#fcfdfd' }}>
                {admin.name}
              </p>
              <p className="text-[11px] capitalize mt-0.5 font-medium" style={{ color: '#198f41' }}>
                {admin.role.replace('_', ' ')}
              </p>
            </div>

            {/* Green online indicator */}
            <span
              className="w-2 h-2 rounded-full hidden md:block"
              style={{ backgroundColor: '#198f41', boxShadow: '0 0 6px #198f41' }}
            />
          </div>
        )}
      </div>
    </header>
  )
}