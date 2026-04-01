'use client'

/**
 * AnimatedTableRow — staggered entrance for table rows.
 * Usage: replace <tr> with <AnimatedTableRow index={i}>
 */

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { fadeUpVariants } from '@/hooks/useAnimatedMount'

export default function AnimatedTableRow({
  children,
  index = 0,
}: {
  children: ReactNode
  index?: number
}) {
  return (
    <motion.tr
      custom={index}
      variants={fadeUpVariants}
      initial="hidden"
      animate="visible"
      whileHover={{
        backgroundColor: 'rgba(219,20,46,0.04)',
        transition: { duration: 0.15 },
      }}
    >
      {children}
    </motion.tr>
  )
}