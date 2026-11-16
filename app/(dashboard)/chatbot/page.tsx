'use client'

/**
 * app/(dashboard)/chatbot/page.tsx — Admin Panel
 *
 * Chatbot → Unmatched queries: what customers asked the shopping assistant that ended with no product,
 * with relaxed words, or with words it did not understand, most frequent first.
 * Use it to add words to choosetounsi-backend/config/chatbot_darija.php (broad words like "dbach",
 * product words, colors, kids' words...). "Handled" forgets a message once its words are added.
 */

import { useCallback, useEffect, useState } from 'react'
import { Bot, RefreshCw, Check, SearchX } from 'lucide-react'
import { adminChatbotApi, type UnmatchedQuery } from '@/lib/api/chatbot'
import { usePageLoading } from '@/components/brand/NavigationLoader'
import BrandLoader from '@/components/brand/BrandLoader'

const RED = '#db142e'
const GREEN = '#198f41'
const AMBER = '#f59e0b'

const DIALECT_LABEL: Record<string, string> = {
  tn_arabizi: 'Arabizi', tn_arabic: 'Tunisian (Arabic script)', msa: 'Arabic (MSA)', fr: 'French', en: 'English',
}

const CSS = `
  .cb-root { font-family:'Plus Jakarta Sans',sans-serif; --bg:#0a0c10; --bg2:#161a22; --bd:rgba(255,255,255,0.06); --bd2:rgba(255,255,255,0.1); --t1:#f0f2f7; --t2:#8891a4; --t3:#4e5668; background:var(--bg); min-height:100vh; padding:28px; color:var(--t1); }
  .cb-card { background:var(--bg2); border:1px solid var(--bd); border-radius:14px; padding:16px 18px; }
  .cb-label { font-size:10px; font-weight:800; color:var(--t3); text-transform:uppercase; letter-spacing:.08em; margin:0 0 6px; }
  .cb-select { background:var(--bg); border:1px solid var(--bd); border-radius:10px; color:var(--t1); font:inherit; font-size:13px; padding:8px 12px; }
  .cb-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; background:rgba(255,255,255,.04); border:1px solid var(--bd2); color:var(--t2); font:inherit; font-size:13px; font-weight:700; cursor:pointer; }
  .cb-btn:hover { color:var(--t1); background:rgba(255,255,255,.08); }
  .cb-table { width:100%; border-collapse:collapse; }
  .cb-table th { padding:11px 16px; font-size:10px; font-weight:800; color:var(--t3); text-align:left; text-transform:uppercase; letter-spacing:.08em; background:var(--bg); border-bottom:1px solid var(--bd); }
  .cb-table td { padding:12px 16px; border-bottom:1px solid var(--bd); font-size:13px; color:var(--t2); vertical-align:top; }
  .cb-table tr:last-child td { border-bottom:none; }
  .cb-pill { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:800; margin:0 4px 4px 0; }
`

export default function ChatbotUnmatchedPage() {
  const [rows, setRows] = useState<UnmatchedQuery[]>([])
  const [days, setDays] = useState(30)
  const [zeroOnly, setZeroOnly] = useState(false)
  const [file, setFile] = useState('config/chatbot_darija.php')
  const [loading, setLoading] = useState(true)
  usePageLoading(loading)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminChatbotApi.unmatched({ days, zero_only: zeroOnly, limit: 200 })
      setRows(res.data)
      setFile(res.lexicon_file)
    } catch {
      setError('Could not load the unmatched queries.')
    } finally {
      setLoading(false)
    }
  }, [days, zeroOnly])

  useEffect(() => { load() }, [load])

  const resolve = async (query: string) => {
    try {
      await adminChatbotApi.resolve(query)
      setRows(prev => prev.filter(r => r.query !== query))
    } catch {
      setError('Could not mark it as handled.')
    }
  }

  return (
    <div className="cb-root">
      <style>{CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Bot size={22} color={RED} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Chatbot · Unmatched queries</h1>
      </div>
      <p style={{ margin: '0 0 22px', color: 'var(--t2)', fontSize: 13, maxWidth: 780, lineHeight: 1.6 }}>
        What customers asked the shopping assistant that found nothing, needed relaxing, or used words it did not understand.
        When a word means something you sell (derja, French, Arabic, a misspelling), add it to <code style={{ color: AMBER }}>{file}</code>:
        a product word under <b>concepts</b>, a color under <b>colors</b>, kids&apos; or gender words under <b>recipients</b> / <b>gender</b>.
        Only the message text is kept: no name, no account.
      </p>

      <div className="cb-card" style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <p className="cb-label">Period</p>
          <select className="cb-select" value={days} onChange={e => setDays(Number(e.target.value))}>
            {[7, 30, 90, 365].map(d => <option key={d} value={d}>Last {d} days</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)', paddingBottom: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={zeroOnly} onChange={e => setZeroOnly(e.target.checked)} />
          Only queries that ended with no product at all
        </label>
        <button className="cb-btn" onClick={load} style={{ marginLeft: 'auto' }}>
          {loading ? <BrandLoader variant="inline" size={14} /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      <div className="cb-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="cb-table">
          <thead>
            <tr><th>Query</th><th>Times</th><th>Language</th><th>What the bot understood</th><th>Products shown</th><th>Last seen</th><th></th></tr>
          </thead>
          <tbody>
            {error && <tr><td colSpan={7} style={{ color: '#f87171' }}>{error}</td></tr>}
            {!error && !loading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                <SearchX size={28} color="var(--t3)" /><br />Nothing unmatched in this period.
              </td></tr>
            )}
            {rows.map(r => {
              const zero = r.max_results === 0
              const u = r.understood ?? {}
              return (
                <tr key={r.query}>
                  <td style={{ color: 'var(--t1)', fontWeight: 700 }} dir="auto">{r.example}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--t1)' }}>{r.count}</td>
                  <td>{r.dialect ? (DIALECT_LABEL[r.dialect] ?? r.dialect) : '—'}</td>
                  <td>
                    {u.concept && <span className="cb-pill" style={{ background: `${GREEN}22`, color: GREEN }}>type: {u.concept}</span>}
                    {u.gender && <span className="cb-pill" style={{ background: `${GREEN}22`, color: GREEN }}>{u.gender}</span>}
                    {(u.keywords ?? []).map(k => <span key={k} className="cb-pill" style={{ background: `${AMBER}22`, color: AMBER }} dir="auto">{k}</span>)}
                    {(u.relaxed ?? []).map(k => <span key={k} className="cb-pill" style={{ background: `${RED}22`, color: '#f87171' }}>relaxed: {k}</span>)}
                  </td>
                  <td>
                    <span className="cb-pill" style={{ background: zero ? `${RED}22` : `${AMBER}22`, color: zero ? '#f87171' : AMBER }}>
                      {zero ? 'none' : r.min_results === r.max_results ? r.max_results : `${r.min_results}–${r.max_results}`}
                    </span>
                  </td>
                  <td>{r.last_seen}</td>
                  <td>
                    <button className="cb-btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => resolve(r.query)} title="Words added: forget this message">
                      <Check size={13} color={GREEN} /> Handled
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
