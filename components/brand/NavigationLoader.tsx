'use client'

/**
 * Global navigation loader.
 *
 * One BrandLoader overlay for the whole app, shown when:
 *   - a route change starts: link click, router.push/replace, back/forward
 *     (search-param-only changes on the same page are in-page refreshes, not navigations);
 *   - a loading.tsx is mounted (it renders <RouteLoading />, which holds the overlay
 *     instead of drawing its own, so the two never stack and the overlay can fade out);
 *   - a client page is doing its first fetch (usePageLoading).
 * It honours BrandLoader's 150ms delay / 300ms minimum, and gives up after 15s so a
 * page can show its own error state.
 *
 * <NavigationLoaderProvider> wraps the app; <NavigationLoaderHost> draws the overlay: the
 * root one is fullscreen; a layout with a sidebar (seller shell, admin dashboard) mounts an
 * `area` host over its content, and the fullscreen one steps aside while it is mounted.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import BrandLoader, { type BrandLoaderProps } from './BrandLoader'
import {
  NavigationActionsContext,
  NavigationActiveContext,
  NavigationAreaContext,
  NavigationLabelContext,
  useNavigationActions,
  useNavigationActive,
  useNavigationArea,
  useNavigationLabel,
  type NavigationLoaderActions,
} from './navigationContext'

const SAFETY_MS = 15000
/** Hard page load: the overlay is in the server HTML until the page has had time to register its first fetch. */
const BOOT_MS = 120
/** A started navigation that produced no route change / loading.tsx in this time was a false start. */
const NO_PROGRESS_MS = 8000

function samePathAs(href: string): boolean | null {
  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return null
    return url.pathname === window.location.pathname
  } catch {
    return null
  }
}

type PatchableRouter = Record<string, unknown> & { __ctlPatched?: boolean }

/** Wraps router.push / router.replace so programmatic navigations show the loader too. */
function patchRouter(router: unknown, start: (href?: string) => void) {
  const r = router as PatchableRouter
  if (!r || r.__ctlPatched) return
  for (const method of ['push', 'replace'] as const) {
    const original = r[method]
    if (typeof original !== 'function') continue
    try {
      r[method] = (href: unknown, ...rest: unknown[]) => {
        start(String(href))
        return (original as (...a: unknown[]) => unknown).call(r, href, ...rest)
      }
    } catch {
      return // frozen instance: link clicks and back/forward still work
    }
  }
  r.__ctlPatched = true
}

function RouteCommitTracker({ onCommit }: { onCommit: () => void }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const key = `${pathname}?${search?.toString() ?? ''}`
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    onCommit()
  }, [key, onCommit])
  return null
}

export function NavigationLoaderProvider({ children }: { children: React.ReactNode }) {
  const [navigating, setNavigating] = useState(false)
  const [holds, setHolds] = useState<{ id: number; label?: string }[]>([])
  const nextHold = useRef(0)
  const [stuck, setStuck] = useState(false)
  const [booting, setBooting] = useState(true)
  const [areas, setAreas] = useState(0)
  const progress = useRef(false)
  const pathname = usePathname()
  const lastPath = useRef(pathname)
  const router = useRouter()

  const start = useCallback((href?: string) => {
    if (href !== undefined && samePathAs(href) !== false) return
    progress.current = false
    setStuck(false)
    setNavigating(true)
  }, [])

  const begin = useCallback((label?: string) => {
    progress.current = true
    setStuck(false)
    const id = ++nextHold.current
    setHolds(h => [...h, { id, label }])
    return () => setHolds(h => h.filter(x => x.id !== id))
  }, [])

  const claimArea = useCallback(() => {
    setAreas(n => n + 1)
    return () => setAreas(n => n - 1)
  }, [])

  const onCommit = useCallback(() => {
    progress.current = true
    lastPath.current = window.location.pathname
    setNavigating(false)
  }, [])

  const actions = useMemo<NavigationLoaderActions>(() => ({ start, begin, claimArea }), [start, begin, claimArea])

  // Link clicks, in the capture phase (some headers stop propagation). Controls nested in a
  // link (favourite / add-to-cart buttons on product cards) are not navigations.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as Element | null
      const a = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const control = target?.closest?.('button, [role="button"], input, select, textarea, label')
      if (control && control !== a && a.contains(control)) return
      start(a.href)
    }
    const onPop = () => {
      if (window.location.pathname !== lastPath.current) start()
    }
    window.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPop)
    }
  }, [start])

  useEffect(() => { patchRouter(router, start) }, [router, start])

  // False start (a prevented click, a push to an unknown route): stop waiting.
  useEffect(() => {
    if (!navigating) return
    const id = setTimeout(() => { if (!progress.current) setNavigating(false) }, NO_PROGRESS_MS)
    return () => clearTimeout(id)
  }, [navigating])

  // pages register their first fetch in their own effects, which run before this one
  useEffect(() => {
    const id = setTimeout(() => setBooting(false), BOOT_MS)
    return () => clearTimeout(id)
  }, [])

  const wanted = booting || navigating || holds.length > 0
  const label = [...holds].reverse().find(h => h.label)?.label
  // Never stuck: after 15s let the page show whatever it has (its own error state).
  useEffect(() => {
    if (!wanted) return
    const id = setTimeout(() => setStuck(true), SAFETY_MS)
    return () => clearTimeout(id)
  }, [wanted])

  return (
    <NavigationActionsContext.Provider value={actions}>
      <NavigationActiveContext.Provider value={wanted && !stuck}>
        <NavigationLabelContext.Provider value={label}>
        <NavigationAreaContext.Provider value={areas > 0}>
        <Suspense fallback={null}>
          <RouteCommitTracker onCommit={onCommit} />
        </Suspense>
        {children}
        </NavigationAreaContext.Provider>
        </NavigationLabelContext.Provider>
      </NavigationActiveContext.Provider>
    </NavigationActionsContext.Provider>
  )
}

/**
 * Draws the overlay: fullscreen, or with `area` over a layout's content area (sidebar and
 * topbar stay visible; the fullscreen host steps aside while an area host is mounted).
 * `excludePrefixes` / `includePrefixes`: limit a host to some paths.
 */
export function NavigationLoaderHost({
  excludePrefixes,
  includePrefixes,
  area,
  theme,
  tagline = true,
}: {
  excludePrefixes?: string[]
  includePrefixes?: string[]
  area?: boolean
  theme?: BrandLoaderProps['theme']
  tagline?: boolean
}) {
  const active = useNavigationActive()
  const label = useNavigationLabel()
  const areaClaimed = useNavigationArea()
  const actions = useNavigationActions()
  const pathname = usePathname() ?? ''
  // taking over from an overlay that is already on screen: no second entrance delay
  const [takeover] = useState(active)
  useEffect(() => (area ? actions?.claimArea() : undefined), [area, actions])

  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  if (excludePrefixes?.some(under)) return null
  if (includePrefixes && !includePrefixes.some(under)) return null
  if (!area && areaClaimed) return null
  return area
    ? <BrandLoader variant="section" size="lg" active={active} startVisible label={label} theme={theme} className={`ctl-cover ctl-cover--area${takeover ? ' is-instant' : ''}`} ignoreOverlay />
    : <BrandLoader variant="fullscreen" active={active} startVisible label={label} theme={theme} tagline={tagline} ignoreOverlay />
}

/**
 * For loading.tsx: holds the global overlay instead of drawing a second loader, and keeps
 * the page's height so the footer doesn't jump up. Falls back to its own loader without a provider.
 */
export function RouteLoading({ minHeight = '100vh', area }: { minHeight?: number | string; area?: boolean }) {
  const actions = useNavigationActions()
  useEffect(() => actions?.begin(), [actions])
  if (!actions) {
    return area
      ? <BrandLoader variant="section" size="lg" minHeight={minHeight} />
      : <BrandLoader variant="fullscreen" tagline />
  }
  return <div aria-hidden="true" style={{ minHeight }} />
}

/**
 * Holds the global overlay during a page's FIRST load only (later refreshes are in-page).
 * Returns true while that first load is running.
 *
 *   const [loading, setLoading] = useState(true)
 *   const firstLoad = usePageLoading(loading)
 *   usePageLoading(analyzing, { label: t('loader.analyzingImage') })   // shown under the mark
 */
export function usePageLoading(loading: boolean, { label }: { label?: string } = {}): boolean {
  const actions = useNavigationActions()
  const [done, setDone] = useState(!loading)

  useEffect(() => {
    if (loading || done) return
    const id = setTimeout(() => setDone(true), 0)
    return () => clearTimeout(id)
  }, [loading, done])

  const holding = loading && !done
  useEffect(() => {
    if (!holding || !actions) return
    return actions.begin(label)
  }, [holding, actions, label])

  return holding
}
