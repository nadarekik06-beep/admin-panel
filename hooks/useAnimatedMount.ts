/**
 * Reusable hook that returns staggered animation variants
 * Use this in any component to get consistent animation timing
 */
import { Variants } from 'framer-motion'

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
}

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.07,
      duration: 0.35,
      ease: [0.34, 1.56, 0.64, 1],
    },
  }),
}

export const slideInLeftVariants: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
}