'use client'

/**
 * app/(dashboard)/search/page.tsx — Admin Panel
 *
 * Missed searches: what customers typed that found nothing (or almost nothing),
 * most frequent first. Use it to grow choosetounsi-backend/resources/search/synonyms.txt
 * (read again automatically when the file changes).
 * Also shows whether photo search is up (AI service, fingerprints).
 */

import { useCallback, useEffect, useState } from 'react'
import { Search, RefreshCw, Database, Image as ImageIcon, Cpu, Copy, Check, SearchX } from 'lucide-react'
import { adminSearchApi, type MissedQuery, type SearchHealth } from '@/lib/api/search'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import BrandLoader from '@/components/brand/BrandLoader'

const RED = '#db142e'
const GREEN = '#198f41'
const AMBER = '#f59e0b'

const CSS = `
  .sq-root { font-family:'Plus Jakarta Sans',sans-serif; --bg:#0a0c10; --bg2:#161a22; --bd:rgba(255,255,255,0.06); --bd2:rgba(255,255,255,0.1); --t1:#f0f2f7; --t2:#8891a4; --t3:#4e5668; background:var(--bg); min-height:100vh; padding:28px; color:var(--t1); }
  .sq-card { background:var(--bg2); border:1px solid var(--bd); border-radius:14px; padding:16px 18px; }
  .sq-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; }
  .sq-label { font-size:10px; font-weight:800; color:var(--t3); text-transform:uppercase; letter-spacing:.08em; margin:0 0 6px; }
  .sq-select { background:var(--bg); border:1px solid var(--bd); border-radius:10px; color:var(--t1); font:inherit; font-size:13px; padding:8px 12px; }
  .sq-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; background:rgba(255,255,255,.04); border:1px solid var(--bd2); color:var(--t2); font:inherit; font-size:13px; font-weight:700; cursor:pointer; }
  .sq-btn:hover { color:var(--t1); background:rgba(255,255,255,.08); }
  .sq-table { width:100%; border-collapse:collapse; }
  .sq-table th { padding:11px 16px; font-size:10px; font-weight:800; color:var(--t3); text-align:left; text-transform:uppercase; letter-spacing:.08em; background:var(--bg); border-bottom:1px solid var(--bd); }
  .sq-table td { padding:12px 16px; border-bottom:1px solid var(--bd); font-size:13px; color:var(--t2); }
  .sq-table tr:last-child td { border-bottom:none; }
  .sq-pill { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:800; }
`

function Status({ ok, label, detail, icon }: { ok: boolean; label: string; detail: string; icon: React.ReactNode }) {
  const color = ok ? GREEN : RED
  return (
    <div className="sq-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontWeight: 800, color: 'var(--t1)', fontSize: 14 }}>{label} <span style={{ color, fontSize: 12 }}>● {ok ? 'up' : 'down'}</span></p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--t3)' }}>{detail}</p>
      </div>
    </div>
  )
}

export default function MissedSearchesPage() {
  const [rows, setRows] = useState<MissedQuery[]>([])
  const [health, setHealth] = useState<SearchHealth | null>(null)
  const [days, setDays] = useState(30)
  const [zeroOnly, setZeroOnly] = useState(false)
  const [lowResults, setLowResults] = useState(3)
  const [synonymsFile, setSynonymsFile] = useState('')
  const [loading, setLoading] = useState(true)
  // holds the navigation loader until the first load is done
  usePageLoading(loading)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [missed, h] = await Promise.all([
        adminSearchApi.missed({ days, zero_only: zeroOnly, limit: 200 }),
        adminSearchApi.health().catch(() => null),
      ])
      setRows(missed.data)
      setLowResults(missed.low_results)
      setSynonymsFile(missed.synonyms_file)
      setHealth(h)
    } catch {
      setError('Could not load missed searches.')
    } finally {
      setLoading(false)
    }
  }, [days, zeroOnly])

  useEffect(() => { load() }, [load])

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text)
      setTimeout(() => setCopied(null), 1200)
    })
  }

  return (
    <div className="sq-root">
      <style>{CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Search size={22} color={RED} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Missed searches</h1>
      </div>
      <p style={{ margin: '0 0 22px', color: 'var(--t2)', fontSize: 13, maxWidth: 760, lineHeight: 1.6 }}>
        Searches that found nothing, or fewer than {lowResults} products. When a word means a product you sell
        (derja, French, Arabic, a misspelling), add it to a line of <code style={{ color: AMBER }}>{synonymsFile || 'resources/search/synonyms.txt'}</code> with
        the words already used in product names. The search bar picks the file up on its own.
      </p>

      <div className="sq-grid" style={{ marginBottom: 18 }}>
        <Status ok={!!health} label="Search bar" icon={<Database size={18} />}
          detail="MySQL keyword search, synonyms and spelling correction" />
        <Status ok={!!health?.ai_service && (health?.photos_indexed ?? 0) > 0} label="Search by photo" icon={<ImageIcon size={18} />}
          detail={!health?.ai_service ? 'AI service unreachable: the camera button shows "unavailable"'
            : `${health.photos_indexed} photos, ${health.categories} categories indexed`} />
        <Status ok={!!health?.image_model && health?.image_model === health?.index_model} label="Photo model" icon={<Cpu size={18} />}
          detail={!health?.image_model ? 'Unknown (AI service unreachable)'
            : health.image_model === health.index_model ? health.image_model
            : `Model changed: run php artisan image-search:rebuild --fresh`} />
      </div>

      <div className="sq-card" style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <p className="sq-label">Period</p>
          <select className="sq-select" value={days} onChange={e => setDays(Number(e.target.value))}>
            {[7, 30, 90, 365].map(d => <option key={d} value={d}>Last {d} days</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)', paddingBottom: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={zeroOnly} onChange={e => setZeroOnly(e.target.checked)} />
          Only searches with no result at all
        </label>
        <button className="sq-btn" onClick={load} style={{ marginLeft: 'auto' }}>
          {loading ? <BrandLoader variant="inline" size={14} /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      <div className="sq-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="sq-table">
          <thead>
            <tr><th>Query</th><th>Searches</th><th>Results</th><th>First seen</th><th>Last seen</th><th></th></tr>
          </thead>
          <tbody>
            {error && <tr><td colSpan={6} style={{ color: '#f87171' }}>{error}</td></tr>}
            {!error && !loading && rows.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                <SearchX size={28} color="var(--t3)" /><br />No missed searches in this period.
              </td></tr>
            )}
            {rows.map(r => {
              const zero = r.max_results === 0
              return (
                <tr key={r.query}>
                  <td style={{ color: 'var(--t1)', fontWeight: 700 }} dir="auto">
                    {r.example || r.query}
                    {r.example && r.example.toLowerCase() !== r.query && (
                      <span style={{ color: 'var(--t3)', fontWeight: 500, marginLeft: 8, fontSize: 12 }} dir="auto">{r.query}</span>
                    )}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--t1)' }}>{r.searches}</td>
                  <td>
                    <span className="sq-pill" style={{ background: zero ? `${RED}22` : `${AMBER}22`, color: zero ? '#f87171' : AMBER }}>
                      {zero ? 'none' : r.min_results === r.max_results ? r.max_results : `${r.min_results}–${r.max_results}`}
                    </span>
                  </td>
                  <td>{r.first_seen}</td>
                  <td>{r.last_seen}</td>
                  <td>
                    <button className="sq-btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => copy(r.query)} title="Copy for the synonym file">
                      {copied === r.query ? <Check size={13} color={GREEN} /> : <Copy size={13} />}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
