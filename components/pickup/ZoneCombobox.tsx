'use client'

/**
 * Intigo zone picker for the admin edit form (same behaviour as the storefront
 * one: type to filter, DELEGATION / SECTEUR badge, arrow keys + Enter, only a
 * zone from the list is a value).
 */

import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { sellerPickupApi, type ZoneOption } from '@/lib/sellerPickupApi'

export function ZoneBadge({ type }: { type: ZoneOption['type'] }) {
  const secteur = type === 'SECTEUR'
  return (
    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: secteur ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.18)', color: secteur ? '#34d399' : '#93c5fd' }}>
      {secteur ? 'Secteur' : 'Délégation'}
    </span>
  )
}

export default function ZoneCombobox({ value, onChange, invalid }: {
  value: ZoneOption | null
  onChange: (zone: ZoneOption | null) => void
  invalid?: boolean
}) {
  const [query,   setQuery]   = useState(value?.display_label ?? '')
  const [open,    setOpen]    = useState(false)
  const [options, setOptions] = useState<ZoneOption[]>([])
  const [active,  setActive]  = useState(-1)
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  const searchable = open && query.trim().length >= 2 && !(value && query.trim() === value.display_label)

  useEffect(() => {
    if (!searchable) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      sellerPickupApi.searchZones(query.trim(), ctrl.signal)
        .then(list => { setOptions(list); setActive(list.length ? 0 : -1) })
        .catch(() => { if (!ctrl.signal.aborted) setOptions([]) })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    }, 200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [query, searchable])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (z: ZoneOption) => { onChange(z); setQuery(z.display_label); setOpen(false); setOptions([]) }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          role="combobox" aria-expanded={searchable} aria-controls="admin-zone-list" aria-autocomplete="list" autoComplete="off" spellCheck={false}
          placeholder="Type to search: Bab Bhar, La Soukra…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(null) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(options.length - 1, i + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
            else if (e.key === 'Enter') { e.preventDefault(); if (options[active]) pick(options[active]) }
            else if (e.key === 'Escape') { setOpen(false); if (value) setQuery(value.display_label) }
          }}
          className={`w-full bg-bg-primary border rounded-lg pl-9 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple ${value ? 'pr-28' : 'pr-8'} ${invalid ? 'border-accent-red' : 'border-border'}`}
        />
        {value && <span className="absolute right-8 top-1/2 -translate-y-1/2"><ZoneBadge type={value.type} /></span>}
        {query && (
          <button type="button" aria-label="Clear" onClick={() => { onChange(null); setQuery(''); setOpen(true) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"><X size={14} /></button>
        )}
      </div>
      {searchable && (
        <ul id="admin-zone-list" ref={listRef} role="listbox" className="absolute z-[1000] left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-bg-secondary p-1 shadow-card">
          {loading && <li className="px-3 py-2 text-xs text-text-muted">Searching…</li>}
          {!loading && options.length === 0 && <li className="px-3 py-2 text-xs text-text-muted">No zone found.</li>}
          {!loading && options.map((z, i) => (
            <li key={z.id} data-index={i} role="option" aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); pick(z) }} onMouseEnter={() => setActive(i)}
              className={`flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm ${i === active ? 'bg-bg-hover' : ''}`}>
              <MapPin size={13} className="shrink-0 text-text-muted" />
              <span className="flex-1 truncate text-text-primary">{z.display_label}</span>
              <ZoneBadge type={z.type} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
