'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { ReviewImage } from '@/types/productReview'

interface Props {
  images: ReviewImage[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

const MAX_SCALE = 4

/**
 * Fullscreen image viewer: ←/→ to navigate, Esc to close, +/- or wheel to zoom,
 * click to toggle 2× zoom, drag to pan when zoomed, swipe / pinch on touch.
 */
export default function Lightbox({ images, index, onIndexChange, onClose }: Props) {
  const [scale, setScale]   = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag   = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null)
  const touch  = useRef<{ dist: number; scale: number; x: number; y: number; ox: number; oy: number } | null>(null)

  const count = images.length
  const image = images[index]

  const go = useCallback((delta: number) => {
    if (count < 2) return
    onIndexChange((index + delta + count) % count)
  }, [count, index, onIndexChange])

  const zoomTo = useCallback((s: number) => {
    const next = Math.min(MAX_SCALE, Math.max(1, s))
    setScale(next)
    if (next === 1) setOffset({ x: 0, y: 0 })
  }, [])

  // Reset zoom when the image changes
  useEffect(() => { setScale(1); setOffset({ x: 0, y: 0 }) }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { e.stopPropagation(); onClose() }
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft')  go(-1)
      if (e.key === '+' || e.key === '=') zoomTo(scale + 0.5)
      if (e.key === '-')          zoomTo(scale - 0.5)
    }
    // capture so the page-level shortcuts don't also fire
    window.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
    }
  }, [go, onClose, scale, zoomTo])

  if (!image) return null

  // ── Mouse: click toggles zoom, drag pans ────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, moved: false }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    const d = drag.current
    if (!d || scale === 1) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    setOffset({ x: d.ox + dx, y: d.oy + dy })
  }
  const onMouseUp = (e: React.MouseEvent) => {
    const d = drag.current
    drag.current = null
    // Click on the image toggles zoom; a click on the backdrop closes (see onClick)
    if (d && !d.moved && (e.target as HTMLElement).tagName === 'IMG') zoomTo(scale === 1 ? 2 : 1)
  }

  // ── Touch: pinch to zoom, pan when zoomed, swipe to navigate ────────────
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches
    touch.current = {
      dist: t.length === 2 ? dist(t) : 0, scale,
      x: t[0].clientX, y: t[0].clientY, ox: offset.x, oy: offset.y,
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current
    if (!s) return
    if (e.touches.length === 2 && s.dist) {
      zoomTo(s.scale * (dist(e.touches) / s.dist))
    } else if (e.touches.length === 1 && scale > 1) {
      setOffset({ x: s.ox + e.touches[0].clientX - s.x, y: s.oy + e.touches[0].clientY - s.y })
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current
    touch.current = null
    if (!s || s.dist || scale > 1) return
    const dx = (e.changedTouches[0]?.clientX ?? s.x) - s.x
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
  }

  const btn = 'p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30'

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex flex-col select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white/80 text-sm">
        <span>
          {index + 1} / {count}
          {image.is_primary && <span className="ml-2 text-xs text-accent-orange">★ Main image</span>}
          {image.scope !== 'general' && <span className="ml-2 text-xs text-white/50 capitalize">{image.scope} image</span>}
        </span>
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => zoomTo(scale - 0.5)} disabled={scale <= 1} aria-label="Zoom out"><ZoomOut size={18} /></button>
          <span className="w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button className={btn} onClick={() => zoomTo(scale + 0.5)} disabled={scale >= MAX_SCALE} aria-label="Zoom in"><ZoomIn size={18} /></button>
          <button className={btn} onClick={onClose} aria-label="Close (Esc)"><X size={18} /></button>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative flex-1 overflow-hidden flex items-center justify-center"
        style={{ touchAction: 'none', cursor: scale > 1 ? 'grab' : 'zoom-in' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { drag.current = null }}
        onWheel={(e) => zoomTo(scale + (e.deltaY < 0 ? 0.25 : -0.25))}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => { if (e.target === e.currentTarget && scale === 1) onClose() }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt=""
          draggable={false}
          className="max-w-[92vw] max-h-[80vh] object-contain transition-transform duration-100"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />

        {count > 1 && (
          <>
            <button
              className={`${btn} absolute left-4 top-1/2 -translate-y-1/2`}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); go(-1) }}
              aria-label="Previous image"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              className={`${btn} absolute right-4 top-1/2 -translate-y-1/2`}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); go(1) }}
              aria-label="Next image"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="flex justify-center gap-2 px-4 py-3 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => onIndexChange(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-colors ${
                i === index ? 'border-white' : 'border-transparent opacity-50 hover:opacity-100'
              }`}
              aria-label={`Image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
