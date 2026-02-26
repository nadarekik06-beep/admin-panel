'use client'

import { Bell } from 'lucide-react'
import { authStorage } from '@/lib/auth'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Admin } from '@/types'

const pageTitles: Record<string, string> = {
  '/':           'Dashboard',
  '/users':      'User Management',
  '/sellers':    'Seller Management',
  '/products':   'Product Management',
  '/orders':     'Orders',
  '/statistics': 'Statistics & Analytics',
}

export default function Header() {
  const pathname = usePathname()
  const [admin, setAdmin] = useState<Admin | null>(null)

  // ✅ Only read localStorage on the client
  useEffect(() => {
    setAdmin(authStorage.getAdmin())
  }, [])

  const title = pageTitles[pathname] ?? 'Admin Panel'

  return (
    <header className="h-16 bg-bg-secondary border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        <p className="text-xs text-text-muted hidden sm:block">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year:    'numeric',
            month:   'long',
            day:     'numeric',
          })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-red rounded-full" />
        </button>

        <div className="w-px h-6 bg-border" />

        {admin && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-purple flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {admin.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-text-primary leading-none">{admin.name}</p>
              <p className="text-xs text-text-muted capitalize mt-0.5">
                {admin.role.replace('_', ' ')}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}