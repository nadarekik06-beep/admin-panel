'use client';

import Link from 'next/link';
import { Package2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  AlertTriangle,
  FileEdit,
  Tag,
  Crown,
  Star,
} from 'lucide-react';
import { adminAuthApi } from '@/lib/api/auth';
import { authStorage } from '@/lib/auth';
import { Admin } from '@/types';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInLeftVariants, fadeUpVariants, containerVariants } from '@/hooks/useAnimatedMount';
import { ShoppingBag } from 'lucide-react'
import { Banknote } from 'lucide-react'

const LOGO_B64 = "data:image/png;base64,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";

const navItems = [
  { href: '/',                    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/users',               label: 'Users',        icon: Users           },
  { href: '/sellers',             label: 'Sellers',      icon: Store           },
  
  { href: '/seller-applications', label: 'Applications', icon: FileText        },

  { href: '/products',            label: 'Products',     icon: Package         },
  { href: '/product-update-requests', label: 'Update Requests', icon: FileEdit },

  { href: '/packs',                   label: 'Packs',           icon: Package2        },

  { href: '/orders',              label: 'Orders',       icon: ShoppingCart    },
  { href: '/finance', label: 'Finance', icon: Banknote },

  { href: '/complaints',          label: 'Complaints',   icon: AlertTriangle   },
  { href: '/reviews',         label: 'Reviews',      icon: Star          },  // ← ADD
  { href: '/vip-requests',  label: 'VIP Requests', icon: Crown         }, 
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/statistics',          label: 'Statistics',   icon: BarChart3       },
  { href: '/brand-products',          label: 'Brand Products',  icon: ShoppingBag     },
];

function LogoIcon({ size }: { size: 'md' | 'sm' }) {
  const dim = size === 'md' ? 48 : 40;
  return (
    <div style={{
      width: dim, height: dim, flexShrink: 0,
      borderRadius: 12,
      background: '#fff',
      border: '2px solid #db142e',
      boxShadow: '0 0 0 1px #198f41, 0 0 10px 3px rgba(219,20,46,0.5), 0 0 22px 5px rgba(219,20,46,0.2), 0 0 32px 8px rgba(25,143,65,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      padding: 2,
    }}>
      <img
        src="/images/logo-chili.png"
        alt="ChooseTounsi"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          imageRendering: 'crisp-edges',
        }}
      />
    </div>
  );
}

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const [collapsed,  setCollapsed]  = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [admin,      setAdmin]      = useState<Admin | null>(null);

  useEffect(() => { setAdmin(authStorage.getAdmin()); }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await adminAuthApi.logout(); }
    finally { authStorage.clear(); router.push('/login'); }
  };

  return (
    <motion.aside
      variants={slideInLeftVariants}
      initial="hidden"
      animate="visible"
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
      {/* Logo header */}
      <div className="flex items-center justify-between px-4 h-16" style={{ borderBottom: '1px solid #1e2128' }}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <LogoIcon size="md" />
            <div className="min-w-0 leading-none">
              <p className="font-black text-[13px] tracking-[0.08em] text-white truncate leading-tight">CHOOSE</p>
              <p className="font-black text-[13px] tracking-[0.08em] leading-tight" style={{ color: '#db142e' }}>TOUNSI</p>
            </div>
          </div>
        )}
        {collapsed && <div className="mx-auto"><LogoIcon size="sm" /></div>}
        <button onClick={() => setCollapsed(!collapsed)}
          className={clsx('p-1.5 rounded-md transition-colors flex-shrink-0', collapsed && 'mx-auto mt-2')}
          style={{ color: '#6b7280' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fcfdfd')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Section label */}
      {!collapsed && (
        <div className="px-4 pt-5 pb-1">
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: '#198f41' }}>Main Menu</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon         = item.icon;
          const isActive     = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const isComplaints = item.href === '/complaints';
          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative"
              style={isActive
                ? { background: 'linear-gradient(90deg, rgba(219,20,46,0.18) 0%, rgba(219,20,46,0.06) 100%)', borderLeft: '2.5px solid #db142e', color: '#fcfdfd' }
                : { color: isComplaints ? '#f97316' : '#9ca3af', borderLeft: '2.5px solid transparent' }
              }
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#fcfdfd'; } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = isComplaints ? '#f97316' : '#9ca3af'; } }}>
              <Icon size={18} className="flex-shrink-0" style={{ color: isActive ? '#db142e' : 'inherit' }} />
              {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#db142e', boxShadow: '0 0 6px #db142e' }} />
              )}
              {collapsed && (
                <span className="absolute left-16 text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 font-medium"
                  style={{ background: '#16191f', color: '#fcfdfd', border: '1px solid #1e2128', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Green divider */}
      <div className="mx-4 my-1" style={{ height: 1, background: 'linear-gradient(90deg, transparent, #198f41, transparent)' }} />

      {/* Admin profile + logout */}
      <div className="p-3">
        {!collapsed && admin && (
          <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl"
            style={{ background: '#16191f', border: '1px solid #1e2128' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs text-white"
              style={{ background: 'linear-gradient(135deg, #db142e 0%, #9b0d1f 100%)', boxShadow: '0 0 12px rgba(219,20,46,0.4)' }}>
              {admin.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: '#fcfdfd' }}>{admin.name}</p>
              <p className="text-[11px] capitalize" style={{ color: '#198f41' }}>{admin.role.replace('_', ' ')}</p>
            </div>
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#198f41', boxShadow: '0 0 6px #198f41' }} />
          </div>
        )}
        <button onClick={handleLogout} disabled={loggingOut} title={collapsed ? 'Logout' : undefined}
          className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium', collapsed && 'justify-center')}
          style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(219,20,46,0.10)'; (e.currentTarget as HTMLElement).style.color = '#db142e'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}>
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && (loggingOut ? 'Logging out...' : 'Logout')}
        </button>
      </div>
    </motion.aside>
  );
}