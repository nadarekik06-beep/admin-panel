'use client'

import { createContext, useContext } from 'react'

/**
 * Shared state of the global navigation loader (see NavigationLoader.tsx).
 * Kept apart from the provider so BrandLoader can read it without an import cycle.
 */
export interface NavigationLoaderActions {
  /** A route change is starting (link click, router.push, back/forward). Ignored for the current path. */
  start: (href?: string) => void
  /** Keep the overlay up (a page's first fetch, a loading.tsx), optionally with a label. Returns the release function. */
  begin: (label?: string) => () => void
  /** A layout draws its own overlay over its content area (seller / admin): the fullscreen one steps aside. */
  claimArea: () => () => void
}

export const NavigationActionsContext = createContext<NavigationLoaderActions | null>(null)
/** True while the overlay is wanted: in-page section loaders hide themselves meanwhile. */
export const NavigationActiveContext = createContext(false)
/** Label of the latest hold that has one (e.g. "Analyzing your image…"), shown under the mark. */
export const NavigationLabelContext = createContext<string | undefined>(undefined)
/** True while an area overlay (seller / admin layout) is mounted. */
export const NavigationAreaContext = createContext(false)

export const useNavigationActions = () => useContext(NavigationActionsContext)
export const useNavigationActive = () => useContext(NavigationActiveContext)
export const useNavigationLabel = () => useContext(NavigationLabelContext)
export const useNavigationArea = () => useContext(NavigationAreaContext)
