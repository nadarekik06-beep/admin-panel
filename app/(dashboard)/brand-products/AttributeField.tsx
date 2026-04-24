'use client'

/**
 * AttributeField.tsx — admin brand products
 * Dark theme version of seller AttributeField.
 */

import type { Attribute, AttributeValues } from '@/components/types'

interface Props {
  attr: Attribute
  values: AttributeValues
  onChange: (slug: string, value: AttributeValues[string]) => void
  disabled?: boolean
}

function toScalar(value: unknown): string | number {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.length > 0 ? value[0] : ''
  if (typeof value === 'object') return ''
  return value as string | number
}

const iStyle: React.CSSProperties = {
  width: '100%', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '9px 13px', fontSize: 13, background: '#0d1117',
  color: '#fff', outline: 'none', fontFamily: 'inherit',
}

export default function AttributeField({ attr, values, onChange, disabled }: Props) {
  const value = values[attr.slug]

  if (attr.type === 'select') {
    return (
      <select value={toScalar(value)} onChange={e => onChange(attr.slug, e.target.value ? Number(e.target.value) : null)} disabled={disabled} style={iStyle}>
        <option value=''>Select {attr.name}</option>
        {attr.options.map(opt => <option key={opt.id} value={opt.id}>{opt.value}</option>)}
      </select>
    )
  }

  if (attr.type === 'multiselect') {
    const selected = (value as number[]) ?? []
    const toggle = (id: number) => {
      const next = selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id]
      onChange(attr.slug, next)
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {attr.options.map(opt => {
          const on = selected.includes(opt.id)
          return (
            <button key={opt.id} type='button' onClick={() => !disabled && toggle(opt.id)}
              style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${on ? '#db142e' : 'rgba(255,255,255,0.1)'}`, background: on ? 'rgba(219,20,46,0.1)' : 'rgba(255,255,255,0.03)', color: on ? '#db142e' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {opt.value}
            </button>
          )
        })}
      </div>
    )
  }

  if (attr.type === 'color') {
    const selected = (value as number[]) ?? []
    const toggle = (id: number) => {
      const next = selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id]
      onChange(attr.slug, next)
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {attr.options.map(opt => {
          const on = selected.includes(opt.id)
          return (
            <button key={opt.id} type='button' onClick={() => !disabled && toggle(opt.id)} title={opt.value}
              style={{ width: 28, height: 28, borderRadius: '50%', background: opt.color_hex ?? '#ccc', border: `${on ? '3px solid #db142e' : '2px solid rgba(255,255,255,0.15)'}`, cursor: 'pointer', transition: 'all 0.15s', outline: on ? '2px solid rgba(219,20,46,0.3)' : 'none' }} />
          )
        })}
      </div>
    )
  }

  if (attr.type === 'boolean') {
    const on = !!(value as boolean)
    return (
      <div onClick={() => !disabled && onChange(attr.slug, !on)}
        style={{ position: 'relative', width: 40, height: 24, borderRadius: 999, cursor: 'pointer', transition: 'background 0.2s', background: on ? '#db142e' : 'rgba(255,255,255,0.15)' }}>
        <div style={{ position: 'absolute', top: 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s', left: on ? 20 : 4 }} />
      </div>
    )
  }

  if (attr.type === 'number') {
    return (
      <input type='number' min={0} value={(value as number | string) ?? ''} onChange={e => onChange(attr.slug, e.target.value)} disabled={disabled} placeholder={attr.name} style={iStyle} />
    )
  }

  return (
    <input type='text' value={(value as string) ?? ''} onChange={e => onChange(attr.slug, e.target.value)} disabled={disabled} placeholder={attr.name} style={iStyle} />
  )
}