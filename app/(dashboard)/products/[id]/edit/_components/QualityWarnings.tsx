'use client'

import clsx from 'clsx'
import { AlertTriangle, Layers, PackageX, Tag, Type } from 'lucide-react'
import type { QualityWarning } from '@/lib/api/productEditor'

const ICONS: Record<string, typeof Tag> = {
  missing_subcategory: Tag,
  zero_stock: PackageX,
  many_photos_no_variants: Layers,
}

/**
 * "Quality warnings" box (admin review + edit pages): listing problems found by
 * ProductListingRules::warnings. Informational: never blocks saving or approving.
 */
export default function QualityWarnings({ warnings, className, action }: {
  warnings: QualityWarning[]
  className?: string
  /** e.g. a "Request changes" button */
  action?: React.ReactNode
}) {
  if (!warnings.length) return null
  return (
    <div className={clsx('rounded-xl border border-[#f59e0b]/35 bg-[#f59e0b]/[0.07] p-3 sm:p-4', className)} role="status">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <AlertTriangle size={15} className="text-[#fbbf24]" />
        <p className="text-sm font-bold text-text-primary">Quality warnings</p>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#fbbf24]">{warnings.length}</span>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <ul className="space-y-1.5">
        {warnings.map((w) => {
          const Icon = ICONS[w.code] ?? Type
          return (
            <li key={w.code} className="flex items-start gap-2 text-xs text-text-secondary">
              <Icon size={13} className="text-[#fbbf24] flex-shrink-0 mt-0.5" />
              <span>{w.message}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
