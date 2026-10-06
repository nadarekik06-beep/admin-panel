'use client'

/**
 * app/(dashboard)/calendar/page.tsx — Admin Panel
 *
 * Tunisian calendar for the sellers' sales forecast (Outils IA → Ventes).
 * Events are DATA only: chart markers + reminders 4–6 weeks before. There is
 * deliberately no uplift % — the effect is measured from real sales after each
 * event and used in forecasts only with ≥ N orders on both sides (see min_orders).
 * Islamic dates can be computed (tabular Hijri calendar, ±1–2 days): check them
 * against the official announcement and edit.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Moon, Plus, Pencil, Trash2, RefreshCw, FlaskConical } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { adminCalendarApi, type CalendarEvent, type CalendarEventPayload } from '@/lib/api/calendar'
import { adminCategoriesApi, type Category } from '@/lib/api/categories'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import BrandLoader from '@/components/brand/BrandLoader'
import { BusyLabel } from '@/components/brand/BrandLoader'

const RED = '#db142e'
const GREEN = '#198f41'
const AMBER = '#f59e0b'
const VIOLET = '#8b5cf6'

const CSS = `
  .cal-root { font-family:'Plus Jakarta Sans',sans-serif; --bg:#0a0c10; --bg2:#161a22; --bd:rgba(255,255,255,0.06); --bd2:rgba(255,255,255,0.1); --t1:#f0f2f7; --t2:#8891a4; --t3:#4e5668; background:var(--bg); min-height:100vh; padding:28px; color:var(--t1); }
  .cal-card { background:var(--bg2); border:1px solid var(--bd); border-radius:14px; }
  .cal-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; background:rgba(255,255,255,.04); border:1px solid var(--bd2); color:var(--t2); font:inherit; font-size:13px; font-weight:700; cursor:pointer; }
  .cal-btn:hover { color:var(--t1); background:rgba(255,255,255,.08); }
  .cal-btn.primary { background:${RED}; border-color:${RED}; color:#fff; }
  .cal-input { width:100%; background:var(--bg); border:1px solid var(--bd2); border-radius:10px; color:var(--t1); font:inherit; font-size:13px; padding:8px 12px; color-scheme:dark; }
  .cal-table { width:100%; border-collapse:collapse; }
  .cal-table th { padding:11px 14px; font-size:10px; font-weight:800; color:var(--t3); text-align:left; text-transform:uppercase; letter-spacing:.08em; background:var(--bg); border-bottom:1px solid var(--bd); }
  .cal-table td { padding:12px 14px; border-bottom:1px solid var(--bd); font-size:13px; color:var(--t2); vertical-align:top; }
  .cal-pill { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:800; white-space:nowrap; }
  .cal-label { display:block; font-size:11px; font-weight:800; color:var(--t3); text-transform:uppercase; letter-spacing:.06em; margin:0 0 5px; }
`

const EMPTY: CalendarEventPayload = {
  key: '', name_fr: '', name_en: '', name_ar: '', starts_on: '', ends_on: '', category_ids: null, is_active: true,
}

const pill = (color: string) => ({ background: `${color}22`, color })

export default function CalendarPage() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [minOrders, setMinOrders] = useState(30)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  // holds the navigation loader until the first load is done
  usePageLoading(loading)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: number | null; form: CalendarEventPayload } | null>(null)
  const [saving, setSaving] = useState(false)

  const catName = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name_fr || c.name])), [categories])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminCalendarApi.list(year)
      setEvents(res.data)
      setMinOrders(res.min_orders)
    } catch {
      setError('Could not load the calendar.')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    adminCategoriesApi.getAll().then(r => setCategories(r.data.data ?? [])).catch(() => setCategories([]))
  }, [])

  const generate = async () => {
    setNotice(null)
    try {
      const r = await adminCalendarApi.generateHijri(year)
      setNotice(r.created
        ? `${r.created} Islamic date(s) added for ${year} — computed, please check them against the official announcement.`
        : `Islamic dates for ${year} are already in the calendar.`)
      load()
    } catch {
      setNotice('Could not compute the dates.')
    }
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    setNotice(null)
    try {
      if (editing.id) await adminCalendarApi.update(editing.id, editing.form)
      else await adminCalendarApi.create(editing.form)
      setEditing(null)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setNotice(msg ?? 'Could not save the event.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (ev: CalendarEvent) => {
    if (!confirm(`Delete "${ev.name_fr}" (${ev.starts_on})? Its measured effects are deleted too.`)) return
    await adminCalendarApi.remove(ev.id)
    load()
  }

  const measure = async (ev: CalendarEvent) => {
    try {
      const r = await adminCalendarApi.measure(ev.id)
      setNotice(`Measured in ${r.categories} categor${r.categories === 1 ? 'y' : 'ies'}.`)
      load()
    } catch {
      setNotice('This event has not finished yet.')
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const f = editing?.form
  const setF = (patch: Partial<CalendarEventPayload>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } })

  return (
    <div className="cal-root">
      <style>{CSS}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarDays size={22} color={VIOLET} /> Tunisian calendar
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--t2)', maxWidth: 720, lineHeight: 1.5 }}>
            Events shown on the sellers&apos; sales forecast and used for reminders 4–6 weeks before. No uplift is entered here:
            after each event the change in sales is measured per category, and it enters forecasts only with at least {minOrders} orders
            during the event and {minOrders} in the surrounding weeks.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="cal-input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="cal-btn" onClick={generate}><Moon size={14} /> Compute Islamic dates</button>
          <button className="cal-btn primary" onClick={() => setEditing({ id: null, form: { ...EMPTY } })}><Plus size={14} /> Add event</button>
        </div>
      </div>

      {notice && <p style={{ margin: '0 0 14px', fontSize: 13, color: AMBER, fontWeight: 600 }}>{notice}</p>}

      <div className="cal-card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <BrandLoader variant="section" minHeight={200} />
        ) : error ? (
          <p style={{ padding: 20, margin: 0, color: RED }}>{error} <button className="cal-btn" onClick={load}><RefreshCw size={13} /> Retry</button></p>
        ) : events.length === 0 ? (
          <p style={{ padding: 20, margin: 0, color: 'var(--t3)' }}>No events in {year}. Use “Compute Islamic dates” or add one.</p>
        ) : (
          <table className="cal-table">
            <thead><tr>
              <th>Event</th><th>Dates</th><th>Categories</th><th>Status</th><th>Measured effect</th><th></th>
            </tr></thead>
            <tbody>
              {events.map(ev => {
                const top = ev.effects_summary.slice(0, 3)
                return (
                  <tr key={ev.id}>
                    <td>
                      <div style={{ color: 'var(--t1)', fontWeight: 800 }}>{ev.name_fr}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{ev.name_en} · <span dir="rtl">{ev.name_ar}</span></div>
                      <code style={{ fontSize: 11, color: 'var(--t3)' }}>{ev.key}</code>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{ev.starts_on} → {ev.ends_on}</td>
                    <td>{ev.category_ids?.length ? ev.category_ids.map(id => catName[id] ?? `#${id}`).join(', ') : 'All'}</td>
                    <td style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <span className="cal-pill" style={pill(ev.is_active ? GREEN : '#64748b')}>{ev.is_active ? 'Active' : 'Inactive'}</span>
                      {ev.source === 'hijri' && <span className="cal-pill" style={pill(AMBER)}>Computed — to verify</span>}
                    </td>
                    <td>
                      {top.length === 0 ? (
                        <span style={{ color: 'var(--t3)' }}>{ev.ends_on < today ? 'Not measured yet (4 weeks after the end)' : '—'}</span>
                      ) : top.map(e => (
                        <div key={e.category_id} style={{ fontSize: 12 }}>
                          {catName[e.category_id] ?? `#${e.category_id}`}:{' '}
                          <b style={{ color: 'var(--t1)' }}>{e.change_pct == null ? 'n/a' : `${e.change_pct > 0 ? '+' : ''}${Math.round(e.change_pct)} %`}</b>{' '}
                          <span style={{ color: 'var(--t3)' }}>({e.event_orders}/{e.baseline_orders} orders)</span>{' '}
                          {e.reliable ? <span className="cal-pill" style={pill(GREEN)}>used</span> : <span className="cal-pill" style={pill('#64748b')}>too few orders</span>}
                        </div>
                      ))}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {ev.ends_on < today && <button className="cal-btn" title="Measure now" onClick={() => measure(ev)}><FlaskConical size={13} /></button>}{' '}
                      <button className="cal-btn" title="Edit" onClick={() => setEditing({ id: ev.id, form: {
                        key: ev.key, name_fr: ev.name_fr, name_en: ev.name_en, name_ar: ev.name_ar, starts_on: ev.starts_on,
                        ends_on: ev.ends_on, category_ids: ev.category_ids, is_active: ev.is_active } })}><Pencil size={13} /></button>{' '}
                      <button className="cal-btn" title="Delete" onClick={() => remove(ev)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit event' : 'Add event'} size="lg">
        {f && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="cal-label">Key (same every year, e.g. ramadan, aid_fitr, rentree)</label>
              <input className="cal-input" value={f.key} onChange={e => setF({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
              <div><label className="cal-label">Name (FR)</label><input className="cal-input" value={f.name_fr} onChange={e => setF({ name_fr: e.target.value })} /></div>
              <div><label className="cal-label">Name (EN)</label><input className="cal-input" value={f.name_en} onChange={e => setF({ name_en: e.target.value })} /></div>
              <div><label className="cal-label">Name (AR)</label><input className="cal-input" dir="rtl" value={f.name_ar} onChange={e => setF({ name_ar: e.target.value })} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label className="cal-label">Starts on</label><input type="date" className="cal-input" value={f.starts_on} onChange={e => setF({ starts_on: e.target.value })} /></div>
              <div><label className="cal-label">Ends on</label><input type="date" className="cal-input" value={f.ends_on} onChange={e => setF({ ends_on: e.target.value })} /></div>
            </div>
            <div>
              <label className="cal-label">Categories (none selected = all)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {categories.map(c => {
                  const on = f.category_ids?.includes(c.id) ?? false
                  return (
                    <button key={c.id} type="button" className="cal-pill"
                      style={{ ...pill(on ? VIOLET : '#64748b'), border: 'none', cursor: 'pointer', padding: '5px 10px' }}
                      onClick={() => {
                        const ids = new Set(f.category_ids ?? [])
                        if (on) ids.delete(c.id); else ids.add(c.id)
                        setF({ category_ids: ids.size ? Array.from(ids) : null })
                      }}>
                      {c.name_fr || c.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--t2)' }}>
              <input type="checkbox" checked={f.is_active} onChange={e => setF({ is_active: e.target.checked })} /> Active
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="cal-btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="cal-btn primary" disabled={saving} aria-busy={saving || undefined} onClick={save} style={{ position: 'relative' }}><BusyLabel busy={saving} size={14}>Save</BusyLabel></button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
