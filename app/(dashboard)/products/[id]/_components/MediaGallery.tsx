'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ImageOff, Maximize2, Star, Images } from 'lucide-react'
import clsx from 'clsx'
import type { ProductReview, ReviewImage } from '@/types/productReview'
import Lightbox from './Lightbox'

export type GalleryFilter =
  | { kind: 'all' }
  | { kind: 'color'; id: number }
  | { kind: 'variant'; id: number }

const MIN_IMAGES = 3
const LENS = 150   // lens diameter (px)
const ZOOM = 2.5

interface Props {
  product: ProductReview
  filter: GalleryFilter
  onFilterChange: (f: GalleryFilter) => void
}

export default function MediaGallery({ product, filter, onFilterChange }: Props) {
  const { media, variants } = product
  const [active, setActive]         = useState(0)
  const [lightbox, setLightbox]     = useState<number | null>(null)
  const [broken, setBroken]         = useState<Set<number>>(new Set())

  const byId = useMemo(() => new Map(media.images.map((i) => [i.id, i])), [media.images])

  // Color swatches: groups that have images + variant colors that have none
  const swatches = useMemo(() => {
    const list = media.colors.map((c) => ({ id: c.option_id, name: c.name, hex: c.hex, ids: c.image_ids, missing: false }))
    const known = new Set(list.map((c) => c.id))
    variants.forEach((v) => {
      if (v.image_ids.length > 0) return
      v.options.filter((o) => o.attribute_slug === 'color').forEach((o) => {
        if (known.has(o.id)) return
        known.add(o.id)
        list.push({ id: o.id, name: o.value, hex: o.color_hex, ids: [], missing: true })
      })
    })
    return list
  }, [media.colors, variants])

  const visible: ReviewImage[] = useMemo(() => {
    if (filter.kind === 'all') return media.images
    const ids =
      filter.kind === 'color'
        ? swatches.find((s) => s.id === filter.id)?.ids ?? []
        : variants.find((v) => v.id === filter.id)?.image_ids ?? []
    return ids.map((id) => byId.get(id)).filter(Boolean) as ReviewImage[]
  }, [filter, media.images, swatches, variants, byId])

  useEffect(() => { setActive(0) }, [filter])

  const current = visible[Math.min(active, visible.length - 1)]
  const variantsWithoutImages = variants.filter((v) => v.image_ids.length === 0).length
  const filterLabel =
    filter.kind === 'color'
      ? swatches.find((s) => s.id === filter.id)?.name
      : filter.kind === 'variant'
      ? variants.find((v) => v.id === filter.id)?.label
      : null

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header: count + warnings */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <Images size={15} className="text-text-muted" /> {media.count} image{media.count === 1 ? '' : 's'}
        </span>
        {media.count < MIN_IMAGES && (
          <WarnPill>Only {media.count} — minimum {MIN_IMAGES}</WarnPill>
        )}
        {variantsWithoutImages > 0 && (
          <WarnPill>{variantsWithoutImages} variant{variantsWithoutImages === 1 ? '' : 's'} without images</WarnPill>
        )}
        {broken.size > 0 && <WarnPill tone="red">{broken.size} broken image{broken.size === 1 ? '' : 's'}</WarnPill>}
      </div>

      {/* Main image */}
      {media.count === 0 ? (
        <EmptyImage text="The seller didn't upload any images." />
      ) : !current ? (
        <EmptyImage text={`No images for ${filterLabel ?? 'this selection'}.`} warn />
      ) : (
        <MainImage
          key={current.id}
          image={current}
          broken={broken.has(current.id)}
          onBroken={() => setBroken((s) => new Set(s).add(current.id))}
          onOpen={() => setLightbox(Math.min(active, visible.length - 1))}
        />
      )}

      {/* Thumbnails */}
      {visible.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visible.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              onDoubleClick={() => setLightbox(i)}
              className={clsx(
                'relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors bg-bg-primary',
                i === active ? 'border-accent-purple' : 'border-border hover:border-border-light'
              )}
              aria-label={`Show image ${i + 1}`}
            >
              {broken.has(img.id) ? (
                <ImageOff size={16} className="m-auto text-accent-red" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setBroken((s) => new Set(s).add(img.id))}
                />
              )}
              {img.is_primary && (
                <span className="absolute top-0.5 left-0.5 bg-black/70 rounded p-0.5" title="Main image">
                  <Star size={9} className="text-accent-orange fill-accent-orange" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Color / variant filter */}
      {(swatches.length > 0 || filter.kind === 'variant') && (
        <div className="pt-1 border-t border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-3 mb-2">Filter by color</p>
          <div className="flex flex-wrap gap-2">
            <SwatchButton active={filter.kind === 'all'} onClick={() => onFilterChange({ kind: 'all' })}>
              All ({media.count})
            </SwatchButton>
            {swatches.map((s) => (
              <SwatchButton
                key={s.id}
                active={filter.kind === 'color' && filter.id === s.id}
                warn={s.missing}
                onClick={() => onFilterChange({ kind: 'color', id: s.id })}
                title={s.missing ? `${s.name}: no images uploaded` : `${s.name}: ${s.ids.length} image(s)`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/25 flex-shrink-0"
                  style={{ background: s.hex ?? 'repeating-linear-gradient(45deg,#64748b 0 3px,#334155 3px 6px)' }}
                />
                {s.name}
                <span className="text-text-muted">({s.ids.length})</span>
                {s.missing && <AlertTriangle size={11} className="text-accent-orange" />}
              </SwatchButton>
            ))}
            {filter.kind === 'variant' && (
              <SwatchButton active onClick={() => onFilterChange({ kind: 'all' })} title="Clear variant filter">
                Variant: {filterLabel} ✕
              </SwatchButton>
            )}
          </div>
        </div>
      )}

      {lightbox !== null && visible.length > 0 && (
        <Lightbox
          images={visible}
          index={lightbox}
          onIndexChange={(i) => { setLightbox(i); setActive(i) }}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

// ── Main image with hover magnifier ───────────────────────────────────────────

function MainImage({ image, broken, onBroken, onOpen }: {
  image: ReviewImage; broken: boolean; onBroken: () => void; onOpen: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [lens, setLens] = useState<{ x: number; y: number; bgX: number; bgY: number; w: number; h: number } | null>(null)
  const [canHover, setCanHover] = useState(false)

  useEffect(() => {
    setCanHover(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  }, [])

  const onMove = (e: React.MouseEvent) => {
    const box = boxRef.current, img = imgRef.current
    if (!canHover || !box || !img || !img.naturalWidth) return
    const rect = box.getBoundingClientRect()
    // object-contain: find the rectangle the image actually occupies
    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale
    const left = (rect.width - w) / 2, top = (rect.height - h) / 2
    const x = e.clientX - rect.left - left, y = e.clientY - rect.top - top
    if (x < 0 || y < 0 || x > w || y > h) { setLens(null); return }
    setLens({
      x: x + left, y: y + top, w: w * ZOOM, h: h * ZOOM,
      bgX: -(x * ZOOM - LENS / 2), bgY: -(y * ZOOM - LENS / 2),
    })
  }

  if (broken) return <EmptyImage text="This image failed to load (file missing on the server?)." warn />

  return (
    <div
      ref={boxRef}
      className="relative aspect-square w-full rounded-lg overflow-hidden bg-bg-primary border border-border cursor-zoom-in group"
      onMouseMove={onMove}
      onMouseLeave={() => setLens(null)}
      onClick={onOpen}
      role="button"
      aria-label="Open fullscreen"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={image.url} alt="" className="w-full h-full object-contain" onError={onBroken} />

      {lens && (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-white/70 shadow-2xl"
          style={{
            width: LENS, height: LENS,
            left: lens.x - LENS / 2, top: lens.y - LENS / 2,
            backgroundImage: `url("${image.url}")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${lens.w}px ${lens.h}px`,
            backgroundPosition: `${lens.bgX}px ${lens.bgY}px`,
            backgroundColor: '#0f1117',
          }}
        />
      )}

      <div className="absolute top-2 left-2 flex gap-1.5">
        {image.is_primary && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-black/70 text-accent-orange px-2 py-0.5 rounded">
            <Star size={10} className="fill-accent-orange" /> Main
          </span>
        )}
        {image.scope !== 'general' && (
          <span className="text-[10px] font-semibold bg-black/70 text-text-secondary px-2 py-0.5 rounded capitalize">
            {image.scope}
          </span>
        )}
      </div>
      <span className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
        <Maximize2 size={14} />
      </span>
    </div>
  )
}

function EmptyImage({ text, warn }: { text: string; warn?: boolean }) {
  return (
    <div className={clsx(
      'aspect-square w-full rounded-lg border border-dashed flex flex-col items-center justify-center gap-2 text-center px-6',
      warn ? 'border-accent-orange/40 bg-accent-orange/5 text-accent-orange' : 'border-border bg-bg-primary text-text-muted'
    )}>
      <ImageOff size={28} />
      <p className="text-sm">{text}</p>
    </div>
  )
}

function WarnPill({ children, tone = 'orange' }: { children: React.ReactNode; tone?: 'orange' | 'red' }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border',
      tone === 'red'
        ? 'bg-accent-red/10 text-accent-red border-accent-red/30'
        : 'bg-accent-orange/10 text-accent-orange border-accent-orange/30'
    )}>
      <AlertTriangle size={11} /> {children}
    </span>
  )
}

function SwatchButton({ active, warn, onClick, title, children }: {
  active: boolean; warn?: boolean; onClick: () => void; title?: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors',
        active
          ? 'bg-accent-purple/15 border-accent-purple/60 text-text-primary'
          : warn
          ? 'bg-bg-primary border-accent-orange/30 text-text-secondary hover:text-text-primary'
          : 'bg-bg-primary border-border text-text-secondary hover:border-border-light hover:text-text-primary'
      )}
    >
      {children}
    </button>
  )
}
