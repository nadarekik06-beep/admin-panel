'use client'

/**
 * AnimatedCard — wraps any dashboard card with entrance + hover animations.
 * Usage: <AnimatedCard index={0}><YourCard /></AnimatedCard>
 * index controls stagger delay (0, 1, 2, 3...)
 */

import { motion } from 'framer-motion'
import { fadeUpVariants } from '@/hooks/useAnimatedMount'
import { ReactNode } from 'react'

interface AnimatedCardProps {
  children: ReactNode
  index?: number
  className?: string
  style?: React.CSSProperties
}

export default function AnimatedCard({
  children,
  index = 0,
  className,
  style,
}: AnimatedCardProps) {
  return (
    <motion.div
      custom={index}
      variants={fadeUpVariants}
      initial="hidden"
      animate="visible"
      whileHover={{
        y: -4,
        boxShadow: '0 12px 40px rgba(219,20,46,0.15)',
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.98 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}