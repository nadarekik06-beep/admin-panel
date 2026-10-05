'use client'

// Every ads.* setting (platform_settings over config/ads.php defaults), grouped.
// Only changed keys are saved; the backend validates shapes.

import { useEffect, useMemo, useState } from 'react'
import { adsAdminApi, PLACEMENT_LABELS } from '@/lib/adsAdminApi'
import { Btn, card, input, Notice, SponsoringShell } from '../_components/ui'

const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Budget & bidding (DT)', keys: ['min_daily_budget', 'min_top_up', 'min_cpc', 'category_min_cpc', 'suggested_cpc_window_days', 'suggested_cpc_multiplier', 'gsp_increment'] },
  { title: 'Plan tiers', keys: ['tier_click_discount', 'monthly_credit'] },
  { title: 'Ranking & relevance', keys: ['readiness_threshold', 'min_relevance', 'relevance_personal_weight', 'pctr_prior', 'pctr_prior_strength', 'quality_min', 'quality_max'] },
  { title: 'Density caps', keys: ['max_ads', 'reserved_slots', 'grid_ad_every', 'grid_flyer_every', 'frequency_cap_per_day'] },
  { title: 'Clicks & attribution', keys: ['click_dedupe_hours', 'impression_dedupe_minutes', 'attribution_days', 'bot_max_clicks_per_minute'] },
  { title: 'Entry popup', keys: ['popup_enabled', 'popup_min_relevance', 'popup_delay_seconds', 'popup_dismiss_hours', 'popup_dismiss_days_after_3'] },
  { title: 'E-mails', keys: ['digest_enabled', 'digest_day', 'digest_time', 'digest_products', 'interest_emails_enabled', 'marketing_email_gap_days'] },
  { title: 'Seller alerts & optimiser', keys: ['budget_alert_ratio', 'wallet_low_days', 'low_performance_after_days', 'optimizer_min_clicks', 'forecast_reach_share', 'forecast_default_cvr'] },
]

const label = (k: string) => k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

export default function AdsSettingsPage() {
  const [values, setValues] = useState<Record<string, any> | null>(null)
  const [original, setOriginal] = useState<Record<string, any>>({})
  const [defaults, setDefaults] = useState<Record<string, any>>({})
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adsAdminApi.settings().then(d => { setValues(d.values); setOriginal(d.values); setDefaults(d.defaults) }).catch(e => setMsg({ tone: 'error', text: e.message }))
  }, [])

  const changed = useMemo(() => {
    if (!values) return {}
    return Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(original[k])))
  }, [values, original])

  const set = (k: string, v: unknown) => setValues(prev => ({ ...(prev ?? {}), [k]: v }))

  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      const d = await adsAdminApi.saveSettings(changed)
      setValues(d.values); setOriginal(d.values)
      setMsg({ tone: 'ok', text: 'Settings saved.' })
    } catch (e: any) { setMsg({ tone: 'error', text: e.message }) } finally { setBusy(false) }
  }

  const field = (k: string) => {
    const v = values?.[k]
    const d = defaults[k]
    if (typeof d === 'boolean') {
      return <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}><input type="checkbox" checked={!!v} onChange={e => set(k, e.target.checked)} /> Enabled</label>
    }
    if (typeof d === 'number') {
      return <input type="number" step="any" min={0} value={v ?? ''} onChange={e => set(k, e.target.value === '' ? '' : Number(e.target.value))} style={input} />
    }
    if (k === 'digest_day') {
      return <select value={v} onChange={e => set(k, e.target.value)} style={input}>{['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(x => <option key={x}>{x}</option>)}</select>
    }
    if (k === 'digest_time') {
      return <input type="time" value={v ?? ''} onChange={e => set(k, e.target.value)} style={input} />
    }
    if (Array.isArray(d) && k === 'reserved_slots') {
      return <input value={(v ?? []).join(', ')} onChange={e => set(k, e.target.value.split(',').map(s => Number(s.trim())).filter(n => n > 0))} style={input} placeholder="1, 7" />
    }
    // Maps: placement → number, tier → number, category id → number.
    const map: Record<string, number> = Array.isArray(v) ? {} : (v ?? {})
    const keys = k === 'category_min_cpc' ? Object.keys(map) : Array.from(new Set([...Object.keys(d ?? {}), ...Object.keys(map)]))
    return (
      <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {keys.map(sub => (
          <label key={sub} style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{PLACEMENT_LABELS[sub] ?? (k === 'category_min_cpc' ? `Category #${sub}` : sub)}
            <input type="number" step="any" min={0} value={map[sub] ?? ''} onChange={e => set(k, { ...map, [sub]: e.target.value === '' ? 0 : Number(e.target.value) })} style={{ ...input, marginTop: 3 }} />
          </label>
        ))}
        {k === 'category_min_cpc' && (
          <button type="button" onClick={() => { const id = window.prompt('Category id'); if (id && /^\d+$/.test(id)) set(k, { ...map, [id]: Number(values?.min_cpc ?? 0.2) }) }}
            style={{ ...input, cursor: 'pointer', color: 'var(--text-secondary)' }}>+ Category override</button>
        )}
      </div>
    )
  }

  return (
    <SponsoringShell title="Sponsoring settings" actions={<Btn tone="gold" disabled={busy || !Object.keys(changed).length} onClick={save}>Save {Object.keys(changed).length ? `(${Object.keys(changed).length})` : ''}</Btn>}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!values ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : GROUPS.map(g => (
        <section key={g.title} style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>{g.title}</h2>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
            {g.keys.filter(k => k in defaults).map(k => (
              <div key={k}>
                <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', margin: '0 0 5px' }}>
                  {label(k)}{k in changed && <span style={{ color: '#f59e0b' }}> • edited</span>}
                </p>
                {field(k)}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Default: {JSON.stringify(defaults[k])}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </SponsoringShell>
  )
}
