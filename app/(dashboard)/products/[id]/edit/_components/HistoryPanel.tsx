'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, History, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import type { EditLogEntry, ModerationEntry } from '@/lib/api/productEditor'
import { Card } from './ui'

const ACTION_LABEL: Record<string, string> = {
  submitted: 'Submitted by seller', resubmitted: 'Resubmitted by seller', approved: 'Approved',
  rejected: 'Rejected', changes_requested: 'Changes requested', disabled: 'Disabled',
  restored: 'Restored', featured: 'Featured', unfeatured: 'Removed from featured',
}

const fmt = (d: string) => format(new Date(d), 'MMM d, yyyy · HH:mm')
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v))

export default function HistoryPanel({ history, moderation }: { history: EditLogEntry[]; moderation: ModerationEntry[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card title={<span className="flex items-center gap-2"><History size={14} /> Admin edits</span>} description="Every save made in this editor: who changed what, and when.">
        {history.length === 0
          ? <p className="text-sm text-text-muted">No admin edits yet.</p>
          : <ol className="space-y-2">{history.map((h) => <EditEntry key={h.id} entry={h} />)}</ol>}
      </Card>
      <Card title={<span className="flex items-center gap-2"><ShieldCheck size={14} /> Moderation timeline</span>}>
        {moderation.length === 0
          ? <p className="text-sm text-text-muted">No moderation events.</p>
          : (
            <ol className="relative border-l border-border ml-1.5 space-y-4">
              {moderation.map((m) => (
                <li key={m.id} className="pl-4">
                  <span className={clsx('absolute -left-[5px] w-2.5 h-2.5 rounded-full mt-1.5',
                    m.action === 'approved' ? 'bg-[#198f41]' : m.action === 'rejected' ? 'bg-[#db142e]' : 'bg-border-light')} />
                  <p className="text-sm text-text-primary font-medium">{ACTION_LABEL[m.action] ?? m.action}{m.admin && <span className="text-text-muted font-normal"> · {m.admin.name}</span>}</p>
                  <p className="text-[11px] text-text-muted">{fmt(m.created_at)}</p>
                  {m.reasons?.length > 0 && <p className="text-xs text-text-secondary mt-1">{m.reasons.join(', ')}</p>}
                  {m.note && <p className="text-xs text-text-secondary mt-0.5 italic">“{m.note}”</p>}
                </li>
              ))}
            </ol>
          )}
      </Card>
    </div>
  )
}

function EditEntry({ entry }: { entry: EditLogEntry }) {
  const [open, setOpen] = useState(false)
  const c = entry.changes ?? {}
  return (
    <li className="rounded-lg border border-border bg-bg-primary/50">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-start gap-3 p-3 text-left" aria-expanded={open}>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary">{entry.summary || 'Edited'}</p>
          <p className="text-[11px] text-text-muted mt-0.5">{entry.admin?.name ?? 'Admin'} · {fmt(entry.created_at)}</p>
        </div>
        <ChevronDown size={14} className={clsx('text-text-muted mt-1 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 text-xs">
          {c.fields && (
            <Detail title="Fields">
              {Object.entries(c.fields as Record<string, { from: unknown; to: unknown }>).map(([k, v]) => (
                <Diff key={k} label={k.replace(/_/g, ' ')} from={v.from} to={v.to} />
              ))}
            </Detail>
          )}
          {c.attributes && (
            <Detail title="Attributes">
              {Object.entries(c.attributes as Record<string, { from: unknown; to: unknown }>).map(([k, v]) => <Diff key={k} label={k} from={v.from} to={v.to} />)}
            </Detail>
          )}
          {c.variants && (
            <Detail title="Variants">
              {c.variants.added?.length > 0 && <p className="text-[#34d399]">+ {c.variants.added.join(', ')}</p>}
              {c.variants.removed?.length > 0 && <p className="text-[#f87171]">− {c.variants.removed.join(', ')}</p>}
              {c.variants.updated && Object.entries(c.variants.updated as Record<string, Record<string, { from: unknown; to: unknown }>>).map(([label, fields]) => (
                Object.entries(fields).map(([f, v]) => <Diff key={label + f} label={`${label} · ${f.replace(/_/g, ' ')}`} from={v.from} to={v.to} />)
              ))}
            </Detail>
          )}
          {c.images && (
            <Detail title="Images">
              <p className="text-text-secondary">
                {[c.images.added && `${c.images.added} added`, c.images.removed && `${c.images.removed} removed`, c.images.replaced && `${c.images.replaced} replaced`,
                  c.images.reordered?.length && `reordered (${c.images.reordered.join(', ')})`].filter(Boolean).join(' · ')}
              </p>
            </Detail>
          )}
        </div>
      )}
    </li>
  )
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Diff({ label, from, to }: { label: string; from: unknown; to: unknown }) {
  return (
    <p className="text-text-secondary break-words">
      <span className="text-text-muted capitalize">{label}: </span>
      <span className="line-through decoration-[#db142e]/70 text-text-muted">{show(from)}</span>
      <span className="mx-1.5">→</span>
      <span className="text-text-primary">{show(to)}</span>
    </p>
  )
}
