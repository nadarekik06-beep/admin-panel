'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Smooths a loading flag for display:
 * - true right away while `loading` (BrandLoader itself waits `delay` ms before
 *   becoming visible, so fast loads show nothing);
 * - once the loader has actually been visible, it stays up for at least `min` ms.
 *
 *   const showLoader = useBrandLoading(loading)
 *   return showLoader ? <BrandLoader variant="section" /> : <Content />
 */
export function useBrandLoading(loading: boolean, { delay = 150, min = 300 } = {}): boolean {
  // Set (asynchronously) when the loader has been on screen; cleared once `min` is honoured.
  const [visibleSince, setVisibleSince] = useState<number | null>(null)
  const visibleRef = useRef<number | null>(null)

  useEffect(() => {
    if (loading) {
      const id = setTimeout(() => {
        visibleRef.current = Date.now()
        setVisibleSince(visibleRef.current)
      }, delay)
      return () => clearTimeout(id)
    }
    const since = visibleRef.current
    if (since === null) return
    const id = setTimeout(() => {
      visibleRef.current = null
      setVisibleSince(null)
    }, Math.max(0, min - (Date.now() - since)))
    return () => clearTimeout(id)
  }, [loading, delay, min])

  return loading || visibleSince !== null
}

/**
 * Drives a self-managed loader: nothing for the first `delay` ms, then 'visible' for at
 * least `min` ms, then 'leaving' for `exit` ms (fade-out), then null.
 * A load that finishes inside the delay never renders anything.
 */
export function useLoaderStage(
  active: boolean,
  { delay = 150, min = 300, exit = 220 } = {},
): 'visible' | 'leaving' | null {
  const [stage, setStage] = useState<'idle' | 'visible' | 'leaving'>('idle')
  const shownAt = useRef(0)

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined
    if (active) {
      if (stage !== 'visible') {
        id = setTimeout(() => {
          shownAt.current = Date.now()
          setStage('visible')
        }, stage === 'leaving' ? 0 : delay)
      }
    } else if (stage === 'visible') {
      id = setTimeout(() => setStage('leaving'), Math.max(0, min - (Date.now() - shownAt.current)))
    } else if (stage === 'leaving') {
      id = setTimeout(() => setStage('idle'), exit)
    }
    return () => clearTimeout(id)
  }, [active, stage, delay, min, exit])

  if (stage === 'visible') return 'visible'
  if (stage === 'leaving' && !active) return 'leaving'
  if (stage === 'leaving') return 'visible'
  return null
}
