'use client'

/**
 * Choose'Tounsi brand loader.
 *
 *   fullscreen  centred overlay with a blurred backdrop, mark and optional tagline
 *   section     the animated mark centred in a content block
 *   inline      the flag's crescent and star in currentColor, for buttons and rows
 *
 * The motion lives in ./brand-loader.css (only transform, opacity and
 * stroke-dashoffset are animated). Reduced-motion users get a slow breathing
 * version of the finished mark.
 *
 * Without `active`, the loader appears ~150ms after mounting, so a fast route
 * never shows it (a Suspense fallback / loading.tsx). With `active`, it also
 * stays up at least ~300ms once visible and fades out when `active` turns false.
 *
 * While the global navigation overlay is up (NavigationLoader), section/fullscreen
 * loaders inside the page hide themselves (keeping their space), so loaders never stack.
 *
 * Copy of choosetounsi-frontend/components/brand/BrandLoader.tsx (keep the two in
 * sync). The admin panel has no i18n and is always dark.
 */

import { useEffect, useId, useState } from 'react'
import { useLoaderStage } from '@/hooks/useBrandLoading'
import { useNavigationActive } from './navigationContext'
import './brand-loader.css'

const TEXT = { loading: 'Loading…', tagline: "Choose'Tounsi admin" }

export type BrandLoaderVariant = 'fullscreen' | 'section' | 'inline'
export type BrandLoaderSize = 'sm' | 'md' | 'lg'

const MARK_PX: Record<Exclude<BrandLoaderVariant, 'inline'>, Record<BrandLoaderSize, number>> = {
  section: { sm: 44, md: 64, lg: 96 },
  fullscreen: { sm: 64, md: 88, lg: 120 },
}
const GLYPH_PX: Record<BrandLoaderSize, number> = { sm: 14, md: 18, lg: 24 }

export interface BrandLoaderProps {
  variant?: BrandLoaderVariant
  /** Preset, or an exact pixel size for the mark/glyph. */
  size?: BrandLoaderSize | number
  /** Visible text under the mark (not shown for `inline`). */
  label?: string
  /** fullscreen: show the brand tagline when no label is given. */
  tagline?: boolean
  /** When given: delay before showing, minimum display time and fade-out are handled here. */
  active?: boolean
  /** Colours for the overlay and text: the mark itself works on both. */
  theme?: 'light' | 'dark'
  /** Force the reduced-motion rendering (used by the preview page). */
  calm?: boolean
  /** section: reserve this height so the content does not jump in. */
  minHeight?: number | string
  className?: string
  style?: React.CSSProperties
  /** The global overlay itself: never hidden in favour of the overlay. */
  ignoreOverlay?: boolean
  /** With `active`: already up on the first (server) render, still behind the 150ms CSS delay. */
  startVisible?: boolean
}

export default function BrandLoader({ active, ...props }: BrandLoaderProps) {
  if (active === undefined) return <LoaderView {...props} />
  return <ManagedLoader active={active} {...props} />
}

function ManagedLoader({ active, startVisible, ...props }: BrandLoaderProps & { active: boolean }) {
  // while the global overlay is up, in-page loaders wait: none of them flashes as it fades out
  const blocked = useNavigationActive() && props.variant !== 'inline' && !props.ignoreOverlay
  const stage = useLoaderStage(active && !blocked, { startVisible })
  // the server-rendered first cycle keeps the CSS delay; later cycles already waited in JS
  const [boot, setBoot] = useState(!!startVisible)
  useEffect(() => {
    if (!boot || stage) return
    const id = setTimeout(() => setBoot(false), 0)
    return () => clearTimeout(id)
  }, [boot, stage])
  if (!stage) return null
  return <LoaderView {...props} className={[boot ? '' : 'is-instant', props.className].filter(Boolean).join(' ')} leaving={stage === 'leaving'} />
}

function LoaderView({
  variant = 'section',
  size = 'md',
  label,
  tagline,
  theme = 'dark',
  calm,
  minHeight,
  className,
  style,
  ignoreOverlay,
  leaving,
}: Omit<BrandLoaderProps, 'active'> & { leaving?: boolean }) {
  const covered = useNavigationActive() && variant !== 'inline' && !ignoreOverlay
  const px =
    typeof size === 'number'
      ? size
      : variant === 'inline'
        ? GLYPH_PX[size]
        : MARK_PX[variant][size]

  const visibleText = variant === 'inline' ? undefined : label ?? (variant === 'fullscreen' && tagline ? TEXT.tagline : undefined)
  const classes = [
    'ctl',
    `ctl--${variant}`,
    theme === 'dark' && 'ctl--dark',
    calm && 'ctl--calm',
    leaving && 'is-leaving',
    covered && 'is-covered',
    className,
  ].filter(Boolean).join(' ')

  // inline sits inside buttons and text: phrasing content only
  const Root = variant === 'inline' ? 'span' : 'div'

  return (
    <Root
      role="status"
      aria-live="polite"
      aria-hidden={covered || undefined}
      className={classes}
      style={minHeight !== undefined ? { ...style, ['--ctl-min-h' as string]: typeof minHeight === 'number' ? `${minHeight}px` : minHeight } : style}
    >
      {variant === 'inline' ? <BrandGlyph px={px} /> : <BrandMark px={px} />}
      {visibleText && (
        <p className={`ctl-label${!label ? ' ctl-label--tagline' : ''}`} aria-hidden="true">{visibleText}</p>
      )}
      <span className="ctl-sr">{label ?? TEXT.loading}</span>
    </Root>
  )
}

/**
 * In-page refresh (filters, sorting, pagination, tab switch): keeps the old content,
 * dims it, and lays a section loader over that block only — no full-page flash.
 * Appears after the usual 150ms, stays at least 300ms, fades out.
 */
export function LoadingCover({
  active,
  children,
  label,
  theme,
  className,
  style,
}: {
  active: boolean
  children: React.ReactNode
  label?: string
  theme?: BrandLoaderProps['theme']
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={['ctl-cover-wrap', className].filter(Boolean).join(' ')} style={style}>
      <div className={active ? 'ctl-dim is-dim' : 'ctl-dim'} aria-busy={active || undefined}>{children}</div>
      <BrandLoader variant="section" size="sm" active={active} label={label} theme={theme} className="ctl-cover ctl-cover--soft" />
    </div>
  )
}

/**
 * Same as LoadingCover, dropped inside an existing block instead of wrapping it:
 * the block needs `position: relative`. Its content stays visible, dimmed by the veil.
 */
export function RefreshCover({ active, label, theme }: { active: boolean; label?: string; theme?: BrandLoaderProps['theme'] }) {
  return <BrandLoader variant="section" size="sm" active={active} label={label} theme={theme} className="ctl-cover ctl-cover--soft" />
}

/**
 * Button content for an async action: while `busy`, the label stays in place but hidden
 * (so the button keeps its width) and the inline loader sits centred over it.
 * Disable the button while busy.
 */
export function BusyLabel({ busy, children, size = 16 }: { busy: boolean; children: React.ReactNode; size?: number }) {
  return (
    <span className="ctl-busy-wrap">
      <span className={busy ? 'ctl-busy-label is-busy' : 'ctl-busy-label'}>{children}</span>
      {busy && <BrandLoader variant="inline" size={size} className="ctl-busy" />}
    </span>
  )
}

/* ── Geometry (64×64) — a redrawn, simplified Choose'Tounsi mark ─────────── */

const PEPPER =
  'M28 15.5C22.5 15.2 19.6 19.5 19.8 25.5C20.2 34.5 25.5 42.5 34.5 46.6C41.5 49.6 49 49.3 56.5 45.5C57.4 45 57 44 56 44.2C49.5 45 43.5 42.6 40.2 37.6C37.6 33.4 38.4 28.4 40.2 23.8C42 19 39.2 15.2 34.5 15.6C32.3 15.8 30.2 15.6 28 15.5Z'
const WAVE = 'M-16 0q4-1.6 8 0' + 't8 0'.repeat(11) + 'V64H-16Z'
const WAVE_BACK = 'M-16 -3' + 'q4 1.6 8 0' + 't8 0'.repeat(11) + 'V64H-16Z'
const CAP =
  'M22.5 18.5C24.5 14 28 13.6 31 15C32.5 12.8 35.5 12.8 37 15C39.5 14.4 41.6 15.6 42.4 18C39.6 17 37.6 17.6 36 18.8C34 17.2 31.5 17.2 29.6 18.8C27.5 17.4 25 17.4 22.5 18.5Z'
const STAR = 'M37.2 18.2l.62 1.5 1.62.13-1.24 1.05.38 1.58-1.38-.85-1.38.85.38-1.58-1.24-1.05 1.62-.13z'

function BrandMark({ px }: { px: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const clip = `ctl-pepper-${uid}`
  return (
    <svg className="ctl-mark" width={px} height={px} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}><path d={PEPPER} /></clipPath>
      </defs>
      <g className="ctl-stage">
        <g className="ctl-cart" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path className="ctl-draw ctl-d-frame" pathLength={1} strokeWidth={3.6}
            d="M5.5 12.5H10.5Q12 12.5 12.6 14L14.6 20.5L19.2 40.5Q19.6 42 21.2 42H50.5" />
          <path className="ctl-draw ctl-d-basket" pathLength={1} strokeWidth={3.6}
            d="M14.6 20.5H55Q57 20.5 56.4 22.5L52.6 36.5" />
          <path className="ctl-draw ctl-d-g1" pathLength={1} strokeWidth={2.8} d="M44.5 21V41.5" />
          <path className="ctl-draw ctl-d-g2" pathLength={1} strokeWidth={2.8} d="M50.5 21V41.5" />
          <path className="ctl-draw ctl-d-g3" pathLength={1} strokeWidth={2.8} d="M40 27.5H54.6" />
          <path className="ctl-draw ctl-d-g4" pathLength={1} strokeWidth={2.8} d="M38.5 34H53" />
          <circle className="ctl-wheel ctl-w1" cx={24.5} cy={51} r={3.4} strokeWidth={3.4} />
          <circle className="ctl-wheel ctl-w2" cx={47} cy={51} r={3.4} strokeWidth={3.4} />
        </g>

        <path className="ctl-backer" d={PEPPER} />
        <path className="ctl-ghost" d={PEPPER} />
        <g clipPath={`url(#${clip})`}>
          <g className="ctl-rise">
            <path className="ctl-wave ctl-wave--back" d={WAVE_BACK} />
            <path className="ctl-wave" d={WAVE} />
          </g>
        </g>

        <path className="ctl-cap" d={CAP} />
        <path className="ctl-draw ctl-d-stem ctl-stem" pathLength={1} fill="none" strokeWidth={3} strokeLinecap="round"
          d="M31.8 14.8C31.6 10.5 30 7.5 26.6 6.4" />

        <g fill="none" stroke="#fff" strokeLinecap="round">
          <path className="ctl-draw ctl-d-s1" pathLength={1} strokeWidth={2.3} d="M24.6 25.5H35.6" />
          <path className="ctl-draw ctl-d-s2" pathLength={1} strokeWidth={2.3} d="M25 31H35" />
          <path className="ctl-draw ctl-d-tail" pathLength={1} strokeWidth={1.3} opacity={0.75}
            d="M36.5 40.5C40.5 44.5 46 46 51.5 45.6" />
          <path className="ctl-draw ctl-d-tail" pathLength={1} strokeWidth={1.6} opacity={0.18}
            d="M22.6 22.5C21.8 27.5 22.8 33 26 37.5" />
        </g>
        <path className="ctl-star" d={STAR} />
      </g>
    </svg>
  )
}

function BrandGlyph({ px }: { px: number }) {
  return (
    <svg className="ctl-glyph" width={px} height={px} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g className="ctl-glyph-turn" fill="currentColor">
        <path fillRule="evenodd" d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM13.6 4.8a7.2 7.2 0 1 1 0 14.4a7.2 7.2 0 1 1 0-14.4Z" />
        <path className="ctl-glyph-star"
          d="M14.6 9.1l.8 1.9 2.05.17-1.56 1.33.48 2-1.77-1.07-1.77 1.07.48-2-1.56-1.33 2.05-.17z" />
      </g>
    </svg>
  )
}
