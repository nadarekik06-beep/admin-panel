'use client'

import { useEffect, useState } from 'react'
import { Loader2, XCircle, MessageSquareWarning, Check } from 'lucide-react'
import clsx from 'clsx'
import Modal from '@/components/ui/Modal'
import { productsApi } from '@/lib/api/products'
import { DEFAULT_MODERATION_REASONS, apiErrorMessage } from './reviewUtils'

type Mode = 'reject' | 'request_changes'

interface Props {
  open: boolean
  mode: Mode
  product: { id: number; name: string } | null
  reasons?: { code: string; label: string }[]
  onClose: () => void
  onDone: (message: string) => void
}

const COPY: Record<Mode, { title: string; intro: string; noteLabel: string; placeholder: string; submit: string; busy: string }> = {
  reject: {
    title:       'Reject Product',
    intro:       'The product will be hidden and the seller notified immediately with these reasons.',
    noteLabel:   'Comment to the seller',
    placeholder: 'Optional details — required if you pick "Other"…',
    submit:      'Reject Product',
    busy:        'Rejecting…',
  },
  request_changes: {
    title:       'Request Changes',
    intro:       'The product goes back to the seller. It returns to the pending queue as soon as they edit it.',
    noteLabel:   'What should the seller change?',
    placeholder: 'e.g. Please add photos for the Black variant and move the product to Sports › Fitness.',
    submit:      'Send to Seller',
    busy:        'Sending…',
  },
}

export default function ModerationActionModal({ open, mode, product, reasons, onClose, onDone }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote]         = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  const list = reasons?.length ? reasons : DEFAULT_MODERATION_REASONS
  const copy = COPY[mode]

  useEffect(() => {
    if (open) { setSelected([]); setNote(''); setError(null) }
  }, [open, mode, product?.id])

  const toggle = (code: string) =>
    setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]))

  const onlyOther = selected.length === 1 && selected[0] === 'other'
  const validationError =
    mode === 'reject'
      ? selected.length === 0
        ? 'Select at least one reason.'
        : onlyOther && !note.trim()
        ? 'Describe the reason when selecting "Other".'
        : null
      : note.trim().length < 5
      ? 'Tell the seller what needs to change (at least 5 characters).'
      : null

  const submit = async () => {
    if (!product) return
    if (validationError) { setError(validationError); return }
    setLoading(true)
    setError(null)
    try {
      if (mode === 'reject') {
        await productsApi.reject(product.id, selected, note.trim() || undefined)
        onDone('Product rejected — seller notified.')
      } else {
        await productsApi.requestChanges(product.id, selected, note.trim())
        onDone('Changes requested — seller notified.')
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Action failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open && !!product} onClose={onClose} title={copy.title} size="md">
      {product && (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm">
            <span className="font-semibold text-text-primary">&ldquo;{product.name}&rdquo;</span> — {copy.intro}
          </p>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
              Reasons {mode === 'reject' ? <span className="text-accent-red">*</span> : <span className="normal-case font-normal">(optional)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {list.map((r) => {
                const on = selected.includes(r.code)
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => toggle(r.code)}
                    aria-pressed={on}
                    className={clsx(
                      'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      on
                        ? mode === 'reject'
                          ? 'bg-accent-red/15 border-accent-red/50 text-accent-red'
                          : 'bg-accent-cyan/15 border-accent-cyan/50 text-accent-cyan'
                        : 'bg-bg-primary border-border text-text-secondary hover:border-border-light hover:text-text-primary'
                    )}
                  >
                    {on && <Check size={12} />}
                    {r.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
              {copy.noteLabel} {mode === 'request_changes' && <span className="text-accent-cyan">*</span>}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={copy.placeholder}
              rows={4}
              maxLength={1000}
              className={clsx(
                'w-full bg-bg-primary border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none transition-colors',
                mode === 'reject' ? 'focus:border-accent-red' : 'focus:border-accent-cyan'
              )}
            />
            <p className="text-[10px] text-text-muted mt-1 text-right">{note.length}/1000</p>
          </div>

          {error && (
            <p className="text-xs text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={loading || !!validationError}
              title={validationError ?? undefined}
              className={clsx(
                'px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                mode === 'reject' ? 'bg-accent-red hover:bg-accent-red/90' : 'bg-accent-cyan hover:bg-accent-cyan/90'
              )}
            >
              {loading ? (
                <><Loader2 size={13} className="animate-spin" /> {copy.busy}</>
              ) : mode === 'reject' ? (
                <><XCircle size={13} /> {copy.submit}</>
              ) : (
                <><MessageSquareWarning size={13} /> {copy.submit}</>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
