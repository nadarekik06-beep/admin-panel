'use client'

/**
 * VariantImageManager.tsx — admin brand products
 *
 * Used in EDIT mode. Shows existing variant images with delete/undo,
 * and upload zones for new images.
 * Dark theme version of seller VariantImageManager.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Upload, X, Trash2, Image as ImageIcon, Check } from 'lucide-react'

export interface VariantForImageManager {
  id: number
  label: string
  option_map?: Record<string, { id: number; ids?: number[]; value: string; color_hex?: string | null }>
  image_urls?: string[]
  existing_images?: Array<{ id: number; url: string; is_primary?: boolean }>
}

interface Props {
  variants: VariantForImageManager[]
  onChange: (params: { newImagesByVariantId: Record<number, File[]>; deleteImageIds: number[] }) => void
  disabled?: boolean
}

interface ImageSlot {
  kept: Array<{ id: number; url: string; is_primary?: boolean }>
  toDelete: number[]
  newFiles: File[]
  newPreviews: string[]
}

const MAX_PER_VARIANT = 6

function buildInitialSlot(v: VariantForImageManager): ImageSlot {
  const kept = (v.existing_images ?? []).map(img => ({ id: img.id, url: img.url, is_primary: img.is_primary }))
  const readOnly = kept.length === 0 && (v.image_urls ?? []).length > 0
  return { kept: readOnly ? [] : kept, toDelete: [], newFiles: [], newPreviews: [] }
}

export default function VariantImageManager({ variants, onChange, disabled = false }: Props) {
  const [slots, setSlots] = useState<Record<number, ImageSlot>>(() => {
    const init: Record<number, ImageSlot> = {}
    variants.forEach(v => { init[v.id] = buildInitialSlot(v) })
    return init
  })
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => () => { Object.values(slots).forEach(s => s.newPreviews.forEach(URL.revokeObjectURL)) }, []) // eslint-disable-line

  useEffect(() => {
    const newImagesByVariantId: Record<number, File[]> = {}
    const deleteImageIds: number[] = []
    for (const [idStr, slot] of Object.entries(slots)) {
      const id = Number(idStr)
      if (slot.newFiles.length > 0) newImagesByVariantId[id] = slot.newFiles
      deleteImageIds.push(...slot.toDelete)
    }
    onChange({ newImagesByVariantId, deleteImageIds })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots])

  const markDelete = useCallback((variantId: number, imageId: number) => {
    setSlots(prev => { const slot = prev[variantId]; if (!slot) return prev; return { ...prev, [variantId]: { ...slot, kept: slot.kept.filter(img => img.id !== imageId), toDelete: [...slot.toDelete, imageId] } } })
  }, [])
const undoDelete = useCallback((variantId: number, imageId: number, img: { id: number; url: string; is_primary?: boolean }) => {
    setSlots(prev => { const slot = prev[variantId]; if (!slot) return prev; return { ...prev, [variantId]: { ...slot, kept: [...slot.kept, img], toDelete: slot.toDelete.filter(id => id !== imageId) } } })
  }, [])
  const addFiles = useCallback((variantId: number, incoming: File[]) => {
    setSlots(prev => {
      const slot = prev[variantId]; if (!slot) return prev
      const canAdd = MAX_PER_VARIANT - (slot.kept.length + slot.newFiles.length)
      if (canAdd <= 0) return prev
      const toAdd = incoming.filter(f => f.type.startsWith('image/')).slice(0, canAdd)
      return { ...prev, [variantId]: { ...slot, newFiles: [...slot.newFiles, ...toAdd], newPreviews: [...slot.newPreviews, ...toAdd.map(f => URL.createObjectURL(f))] } }
    })
  }, [])
  const removeNew = useCallback((variantId: number, fileIdx: number) => {
    setSlots(prev => {
      const slot = prev[variantId]; if (!slot) return prev
      URL.revokeObjectURL(slot.newPreviews[fileIdx])
      return { ...prev, [variantId]: { ...slot, newFiles: slot.newFiles.filter((_, i) => i !== fileIdx), newPreviews: slot.newPreviews.filter((_, i) => i !== fileIdx) } }
    })
  }, [])

  if (variants.length === 0) return null

  const dim2 = 'rgba(255,255,255,0.08)'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: `1px solid ${dim2}`, marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Variant Images</p>
        <span style={{ fontSize: 9, fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '1px 6px', borderRadius: 4 }}>✓ Instant</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {variants.map(variant => {
          const slot = slots[variant.id]; if (!slot) return null
          const colorEntry = variant.option_map?.['color']
          const totalShown = slot.kept.length + slot.newFiles.length
          const canAdd     = totalShown < MAX_PER_VARIANT
          const pendingDel = slot.toDelete.length

          return (
            <div key={variant.id} style={{ border: `1px solid ${dim2}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${dim2}` }}>
                {colorEntry && (
                  <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
                    {(colorEntry.ids ?? [colorEntry.id]).map((id, i) => (
                      <span key={id} style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: i === 0 ? (colorEntry.color_hex ?? '#e5e7eb') : '#e5e7eb', border: '1.5px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                    ))}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {variant.label || `Variant #${variant.id}`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {pendingDel > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '1px 6px', borderRadius: 4 }}>{pendingDel} to delete</span>
                  )}
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{totalShown}/{MAX_PER_VARIANT}</span>
                </div>
              </div>

              <div style={{ padding: '12px 14px' }}>
                {/* Kept images */}
                {slot.kept.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Saved</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {slot.kept.map(img => (
                        <div key={img.id} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${dim2}`, flexShrink: 0 }}>
                          <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {!disabled && (
                            <button type="button" onClick={() => markDelete(variant.id, img.id)} title="Remove"
                              style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                              <X size={10} color="#fff" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending deletions */}
                {slot.toDelete.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Marked for deletion</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {slot.toDelete.map(imgId => {
                        const original = (variant.existing_images ?? []).find(i => i.id === imgId)
                        return (
                          <div key={imgId} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '2px solid rgba(239,68,68,0.5)', flexShrink: 0, opacity: 0.5 }}>
                            {original && <img src={original.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Trash2 size={18} color="#ef4444" />
                            </div>
                            {!disabled && original && (
                              <button type="button" onClick={() => undoDelete(variant.id, imgId, { id: imgId, url: original.url, is_primary: original.is_primary })} title="Undo"
                                style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(16,185,129,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                <Check size={10} color="#fff" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* New files */}
                {slot.newFiles.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>New (will upload on save)</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {slot.newPreviews.map((preview, fi) => (
                        <div key={fi} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '2px solid rgba(99,102,241,0.4)', flexShrink: 0 }}>
                          <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {!disabled && (
                            <button type="button" onClick={() => removeNew(variant.id, fi)}
                              style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                              <X size={10} color="#fff" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload zone */}
                {canAdd && (
                  <div onClick={() => !disabled && inputRefs.current[variant.id]?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); addFiles(variant.id, Array.from(e.dataTransfer.files)) }}
                    style={{ border: `1.5px dashed ${dim2}`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                    <Upload size={13} color="rgba(255,255,255,0.3)" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                      Add images <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>({MAX_PER_VARIANT - totalShown} remaining)</span>
                    </span>
                    <input ref={el => { inputRefs.current[variant.id] = el }} type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={disabled}
                      onChange={e => { addFiles(variant.id, Array.from(e.target.files ?? [])); e.target.value = '' }} />
                  </div>
                )}

                {totalShown === 0 && slot.toDelete.length === 0 && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ImageIcon size={10} /> No images for this variant yet
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}