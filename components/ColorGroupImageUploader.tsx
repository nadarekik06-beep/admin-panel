'use client'

/**
 * ColorGroupImageUploader.tsx — admin brand products
 *
 * Exact logic copy of seller ColorGroupImageUploader.
 * Shows ONE upload zone per unique color group.
 * Dark theme only.
 */

import { useEffect, useRef, useState } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import type { VariantRow } from './VariantBuilder'
import type { Attribute } from '@/components/types'

const MAX_IMAGES_PER_GROUP = 5

export interface ColorGroup {
  key: string
  colorOptionIds: number[]
  label: string
  swatches: { id: number; value: string; color_hex?: string | null }[]
}

interface Slot {
  files: File[]
  previews: string[]
  existingUrls: string[]
}

interface Props {
  variantRows: VariantRow[]
  colorAxis: Attribute | null
  onChange: (map: Record<string, File[]>) => void
  existingByColorGroup?: Record<string, string[]>
  disabled?: boolean
}

function extractColorGroups(variantRows: VariantRow[], colorAxis: Attribute | null): ColorGroup[] {
  if (!colorAxis) return []
  const seen = new Map<string, ColorGroup>()
  for (const row of variantRows) {
    const colorIds = row.option_ids.filter(id => colorAxis.options.some(o => o.id === id)).sort((a, b) => a - b)
    if (colorIds.length === 0) continue
    const key = colorIds.join('|')
    if (seen.has(key)) continue
    const swatches = colorIds.map(id => {
      const opt = colorAxis.options.find(o => o.id === id)
      return { id, value: opt?.value ?? '?', color_hex: opt?.color_hex }
    })
    seen.set(key, { key, colorOptionIds: colorIds, label: swatches.map(s => s.value).join(' + '), swatches })
  }
  return Array.from(seen.values())
}

export default function ColorGroupImageUploader({
  variantRows, colorAxis, onChange, existingByColorGroup = {}, disabled = false,
}: Props) {
  const [groups, setGroups] = useState<ColorGroup[]>([])
  const [slots, setSlots]   = useState<Record<string, Slot>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const nextGroups = extractColorGroups(variantRows, colorAxis)
    setGroups(nextGroups)
    setSlots(prev => {
      const next: Record<string, Slot> = {}
      for (const group of nextGroups) {
        next[group.key] = prev[group.key] ?? { files: [], previews: [], existingUrls: existingByColorGroup[group.key] ?? [] }
      }
      for (const [key, slot] of Object.entries(prev)) {
        if (!next[key]) slot.previews.forEach(URL.revokeObjectURL)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantRows, colorAxis, existingByColorGroup])

  useEffect(() => () => { Object.values(slots).forEach(s => s.previews.forEach(URL.revokeObjectURL)) }, []) // eslint-disable-line

  useEffect(() => {
    const map: Record<string, File[]> = {}
    for (const [key, slot] of Object.entries(slots)) {
      if (slot.files.length > 0) map[key] = slot.files
    }
    onChange(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots])

  const addFiles = (groupKey: string, incoming: File[]) => {
    setSlots(prev => {
      const slot = prev[groupKey]
      if (!slot) return prev
      const canAdd = MAX_IMAGES_PER_GROUP - (slot.existingUrls.length + slot.files.length)
      if (canAdd <= 0) return prev
      const toAdd = incoming.slice(0, canAdd)
      return { ...prev, [groupKey]: { ...slot, files: [...slot.files, ...toAdd], previews: [...slot.previews, ...toAdd.map(f => URL.createObjectURL(f))] } }
    })
  }

  const removeFile = (groupKey: string, fileIdx: number) => {
    setSlots(prev => {
      const slot = prev[groupKey]
      if (!slot) return prev
      URL.revokeObjectURL(slot.previews[fileIdx])
      return { ...prev, [groupKey]: { ...slot, files: slot.files.filter((_, i) => i !== fileIdx), previews: slot.previews.filter((_, i) => i !== fileIdx) } }
    })
  }

  if (groups.length === 0) return null

  const dim2 = 'rgba(255,255,255,0.08)'

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', paddingBottom: 8, borderBottom: `1px solid ${dim2}`, marginBottom: 16 }}>
        Images per Color Group
        <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 500, color: '#a78bfa', textTransform: 'none', letterSpacing: 0 }}>
          shared across all sizes in that group
        </span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((group, groupIdx) => {
          const slot = slots[group.key]
          if (!slot) return null
          const totalImgs = slot.existingUrls.length + slot.files.length
          const canAdd    = totalImgs < MAX_IMAGES_PER_GROUP

          return (
            <div key={group.key} style={{ border: `1px solid ${dim2}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${dim2}` }}>
                <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(219,20,46,0.1)', color: '#db142e', border: '1px solid rgba(219,20,46,0.2)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
                  #{groupIdx + 1}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {group.swatches.map(s => (
                    <span key={s.id} title={s.value} style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: s.color_hex ?? '#e5e7eb', border: '1.5px solid rgba(255,255,255,0.15)' }} />
                  ))}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {group.label}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                  {totalImgs}/{MAX_IMAGES_PER_GROUP}
                </span>
              </div>

              <div style={{ padding: '12px 14px' }}>
                {/* Existing */}
                {slot.existingUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {slot.existingUrls.map((url, i) => (
                      <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: `1px solid ${dim2}`, flexShrink: 0 }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '1px 4px', fontSize: 8, color: '#fff', fontWeight: 700 }}>saved</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New previews */}
                {slot.files.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {slot.previews.map((preview, fi) => (
                      <div key={fi} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.4)', flexShrink: 0 }}>
                        <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" disabled={disabled} onClick={() => removeFile(group.key, fi)}
                          style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                          <X size={9} color="#fff" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload zone */}
                {canAdd && (
                  <div onClick={() => !disabled && inputRefs.current[group.key]?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); addFiles(group.key, Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))) }}
                    style={{ border: `1.5px dashed ${dim2}`, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                    <Upload size={14} color="rgba(255,255,255,0.3)" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                      Upload images for <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{group.label}</strong>
                    </span>
                    <input ref={el => { inputRefs.current[group.key] = el }} type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={disabled}
                      onChange={e => { addFiles(group.key, Array.from(e.target.files ?? [])); e.target.value = '' }} />
                  </div>
                )}

                {totalImgs === 0 && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ImageIcon size={10} /> No images for this color group yet
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