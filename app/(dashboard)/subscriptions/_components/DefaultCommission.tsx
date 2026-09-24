'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Info } from 'lucide-react'
import { plansApi, apiError } from '@/lib/api/subscriptions'
import type { CommissionTable, Plan } from '@/types/subscriptions'
import { Btn, Field, ReasonField, inputCls, reasonOk } from './ui'

interface Row { min: string; max: string; rate: string }

export default function DefaultCommission({ table, plans, onChanged, onError }: {
  table: CommissionTable | null
  plans: Plan[]
  onChanged: (m: string) => void
  onError: (m: string) => void
}) {
  const [rows, setRows]     = useState<Row[]>([])
  const [floor, setFloor]   = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!table) return
    setRows(table.tiers.map((t) => ({ min: String(t.min), max: t.max === null ? '' : String(t.max), rate: String(t.rate) })))
    setFloor(String(table.floor))
  }, [table])

  if (!table) return <div className="h-64 bg-bg-card border border-border rounded-xl animate-pulse" />

  const update = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))

  const save = async () => {
    setSaving(true)
    try {
      const res = await plansApi.updateCommission({
        tiers: rows.map((r) => ({ min: Number(r.min), max: r.max === '' ? null : Number(r.max), rate: Number(r.rate) })),
        floor: Number(floor),
        reason,
      })
      setReason('')
      onChanged(res.message)
    } catch (err) {
      onError(apiError(err, 'Could not save the default commission.'))
    } finally {
      setSaving(false)
    }
  }

  const tierPlans = plans.filter((p) => !p.archived_at && p.commission_rate === null)
  const flatPlans = plans.filter((p) => !p.archived_at && p.commission_rate !== null)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 items-start">
      <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">Platform default commission (by unit price)</p>
          <p className="text-xs text-text-muted mt-0.5">Used for platform products and for plans without a flat rate (minus their reduction). Applies to new orders only.</p>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
            <span>From (DT)</span><span>To (DT)</span><span>Rate (%)</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2">
              <input type="number" min={0} step="0.01" value={r.min} onChange={(e) => update(i, 'min', e.target.value)} className={inputCls} />
              <input type="number" min={0} step="0.01" value={r.max} onChange={(e) => update(i, 'max', e.target.value)} className={inputCls} placeholder={i === rows.length - 1 ? 'and above' : ''} />
              <input type="number" min={0} max={100} step="0.5" value={r.rate} onChange={(e) => update(i, 'rate', e.target.value)} className={inputCls} />
              <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} disabled={rows.length === 1}
                className="flex items-center justify-center rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 disabled:opacity-30" aria-label="Remove tier">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Btn onClick={() => {
            const last = rows[rows.length - 1]
            const start = last?.max ? String(Number(last.max) + 0.01) : ''
            setRows((rs) => [...rs.map((x, j) => (j === rs.length - 1 && !x.max ? { ...x, max: String(Number(x.min) + 100) } : x)), { min: start || '0', max: '', rate: last?.rate ?? '5' }])
          }}><Plus size={13} /> Add tier</Btn>
        </div>

        <Field label="Floor (%)" hint="No plan reduction can go below this rate. Flat rates and seller overrides ignore it.">
          <input type="number" min={0} max={100} step="0.5" value={floor} onChange={(e) => setFloor(e.target.value)} className={`${inputCls} max-w-[140px]`} />
        </Field>

        <ReasonField value={reason} onChange={setReason} placeholder="Why are the default rates changing?" />
        <div className="flex justify-end">
          <Btn variant="danger" onClick={save} disabled={saving || !reasonOk(reason) || rows.some((r) => r.min === '' || r.rate === '')}>
            {saving && <Loader2 size={13} className="animate-spin" />} Save default commission
          </Btn>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><Info size={14} className="text-text-muted" /> How a rate is chosen</p>
        <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
          <li><b className="text-text-primary">Seller override</b> — set per seller in the subscription drawer, optional expiry.</li>
          <li><b className="text-text-primary">Plan</b> — a flat rate, or the default tier minus the plan reduction.</li>
          <li><b className="text-text-primary">Platform default</b> — the table on the left.</li>
        </ol>
        <p className="text-xs text-text-muted">The applied rate, its source and the plan are saved on every order line and seller order. Editing any rule never changes past orders or settlements.</p>
        <div className="border-t border-border pt-3 space-y-1.5 text-xs">
          {tierPlans.map((p) => (
            <p key={p.slug} className="flex justify-between"><span className="text-text-secondary">{p.name}</span><span className="text-text-primary">{p.commission_reduction > 0 ? `default − ${p.commission_reduction} pts` : 'default tiers'}</span></p>
          ))}
          {flatPlans.map((p) => (
            <p key={p.slug} className="flex justify-between"><span className="text-text-secondary">{p.name}</span><span className="text-text-primary">{p.commission_rate}% flat</span></p>
          ))}
        </div>
      </div>
    </div>
  )
}
