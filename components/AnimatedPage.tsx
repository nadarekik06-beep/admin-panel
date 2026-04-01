'use client'

/**
 * AnimatedPage — wraps page content with a fade+slide entrance.
 * Usage: wrap your page's root element with this.
 * Works with Next.js App Router (client component).
 */

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

export default function AnimatedPage({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  )
}