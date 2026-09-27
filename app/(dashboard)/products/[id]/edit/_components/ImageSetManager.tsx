'use client'

import { useRef, useState } from 'react'
import clsx from 'clsx'
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, RefreshCw, Star, Trash2, Upload } from 'lucide-react'
import { ACCEPTED_TYPES, type ImgItem, newImageItem, validateImageFile } from './editorModel'

interface Props {
  items: ImgItem[]
  onChange: (items: ImgItem[]) => void
  max: number
  maxFileKb: number
  /** Gallery mode: first image is labelled as the cover and "Make cover" is offered. */
  coverLabel?: boolean
  compact?: boolean
  error?: string
  onNotify?: (message: string) => void
  emptyHint?: string
}

/**
 * Thumbnails for one image set with drag & drop reordering, replace-in-place,
 * delete, and multi-upload (click or drop files). Nothing is sent until the
 * editor is saved; new files show as local previews with a "New" tag.
 */
export default function ImageSetManager({
  items, onChange, max, maxFileKb, coverLabel, compact, error, onNotify, emptyHint,
}: Props) {
  const addInput     = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const replaceIndex = useRef<number | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [fileOver, setFileOver] = useState(false)

  const size = compact ? 'w-20 h-20' : 'w-28 h-28 sm:w-32 sm:h-32'
  const full = items.length >= max

  const addFiles = (files: File[]) => {
    const room = max - items.length
    const accepted: ImgItem[] = []
    const problems: string[] = []
    for (const f of files) {
      const err = validateImageFile(f, maxFileKb)
      if (err) { problems.push(err); continue }
      if (accepted.length >= room) { problems.push(`Only ${max} images allowed here — extra files were skipped.`); break }
      accepted.push(newImageItem(f))
    }
    if (accepted.length) onChange([...items, ...accepted])
    if (problems.length) onNotify?.(problems[0])
  }

  const replaceAt = (index: number, file: File) => {
    const err = validateImageFile(file, maxFileKb)
    if (err) { onNotify?.(err); return }
    const old = items[index]
    const next = [...items]
    // Remember which saved image this upload replaces (for the edit log)
    const replaces = old.kind === 'existing' ? old.id : old.replaces
    if (old.kind === 'new') URL.revokeObjectURL(old.url)
    next[index] = newImageItem(file, replaces)
    onChange(next)
  }

  const removeAt = (index: number) => {
    const old = items[index]
    if (old.kind === 'new') URL.revokeObjectURL(old.url)
    onChange(items.filter((_, i) => i !== index))
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    onChange(next)
  }

  const onDropZone = (e: React.DragEvent) => {
    e.preventDefault()
    setFileOver(false)
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div>
      <div
        className={clsx(
          'flex flex-wrap gap-3 rounded-xl p-2 -m-2 transition-colors',
          fileOver && 'bg-[#198f41]/10 outline outline-2 outline-dashed outline-[#198f41]/60',
        )}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setFileOver(true) } }}
        onDragLeave={() => setFileOver(false)}
        onDrop={onDropZone}
      >
        {items.map((item, i) => {
          const isCover = coverLabel && i === 0
          return (
            <div
              key={item.uid}
              draggable
              onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) }}
              onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i) } }}
              onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); setDragOver(null) }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
              className={clsx(
                'group relative rounded-xl overflow-hidden border-2 bg-bg-primary flex-shrink-0 cursor-grab active:cursor-grabbing transition-all',
                size,
                isCover ? 'border-[#db142e]' : 'border-border',
                dragOver === i && dragFrom !== i && 'ring-2 ring-[#198f41] scale-[1.03]',
                dragFrom === i && 'opacity-40',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" className="w-full h-full object-cover pointer-events-none select-none" />

              <div className="absolute top-1 left-1 flex gap-1">
                {isCover && (
                  <span className="text-[9px] font-extrabold uppercase tracking-wider bg-[#db142e] text-white px-1.5 py-0.5 rounded">Cover</span>
                )}
                {item.kind === 'new' && (
                  <span className="text-[9px] font-extrabold uppercase tracking-wider bg-[#198f41] text-white px-1.5 py-0.5 rounded">
                    {item.replaces ? 'Replaced' : 'New'}
                  </span>
                )}
              </div>
              <span className="absolute top-1 right-1 text-[10px] font-bold bg-black/60 text-white w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>

              {/* Hover / focus toolbar */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/75 py-1 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <IconBtn title="Move left" onClick={() => move(i, i - 1)} disabled={i === 0}><ArrowLeft size={12} /></IconBtn>
                {coverLabel && !compact && i !== 0 && (
                  <IconBtn title="Make cover" onClick={() => move(i, 0)}><Star size={12} /></IconBtn>
                )}
                <IconBtn title="Replace image" onClick={() => { replaceIndex.current = i; replaceInput.current?.click() }}><RefreshCw size={12} /></IconBtn>
                <IconBtn title="Delete image" danger onClick={() => removeAt(i)}><Trash2 size={12} /></IconBtn>
                <IconBtn title="Move right" onClick={() => move(i, i + 1)} disabled={i === items.length - 1}><ArrowRight size={12} /></IconBtn>
              </div>
              <GripVertical size={14} className="absolute left-1 top-1/2 -translate-y-1/2 text-white/70 opacity-0 group-hover:opacity-100 drop-shadow" />
            </div>
          )
        })}

        {!full && (
          <button
            type="button"
            onClick={() => addInput.current?.click()}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-text-muted hover:border-[#198f41] hover:text-[#198f41] hover:bg-[#198f41]/5 transition-colors flex-shrink-0',
              size,
            )}
          >
            {items.length === 0 ? <ImagePlus size={compact ? 16 : 20} /> : <Upload size={compact ? 14 : 18} />}
            <span className="text-[10px] font-bold text-center px-1 leading-tight">
              {compact ? 'Add' : 'Add images'}
            </span>
            {!compact && <span className="text-[9px] opacity-70">or drop files</span>}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 gap-3">
        <p className="text-[11px] text-text-muted">
          {items.length === 0 && emptyHint ? emptyHint : `${items.length}/${max} images${coverLabel ? ' · first image is the cover' : ''} · drag to reorder`}
        </p>
      </div>
      {error && <p className="text-[11px] text-[#f87171] mt-1">{error}</p>}

      <input
        ref={addInput} type="file" multiple accept={ACCEPTED_TYPES} className="hidden"
        onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
      />
      <input
        ref={replaceInput} type="file" accept={ACCEPTED_TYPES} className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && replaceIndex.current !== null) replaceAt(replaceIndex.current, f)
          replaceIndex.current = null
          e.target.value = ''
        }}
      />
    </div>
  )
}

function IconBtn({ children, title, onClick, disabled, danger }: {
  children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean
}) {
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className={clsx(
        'p-1 rounded text-white/85 disabled:opacity-25 transition-colors',
        danger ? 'hover:bg-[#db142e]' : 'hover:bg-white/20',
      )}
    >
      {children}
    </button>
  )
}
