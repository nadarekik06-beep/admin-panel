'use client'

/**
 * "Profil de la boutique" on the admin seller page: the logo, description and
 * activity categories the seller sees on their store (they edit them from
 * "Paramètres de la boutique"), plus one "Historique des modifications" for
 * logo / description / categories / pickup address (who, what, when, old → new).
 * "Restaurer l'ancien logo" / "Restaurer l'ancienne description" put back the
 * value a change replaced (logged as an admin change).
 */

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { FileText, History, Image as ImageIcon, MapPin, RotateCcw, Store, Tag } from 'lucide-react'
import BrandLoader from '@/components/brand/BrandLoader'
import { sellerStoreProfileApi, type ProfileChange, type StoreProfileCard } from '@/lib/sellerStoreProfileApi'

const FIELD_LABEL: Record<string, string> = {
  logo:           'Logo',
  description:    'Description',
  categories:     "Catégories d'activité",
  pickup_address: 'Adresse de pickup',
}
const FIELD_ICON: Record<string, React.ReactNode> = {
  logo:           <ImageIcon size={12} />,
  description:    <FileText size={12} />,
  categories:     <Tag size={12} />,
  pickup_address: <MapPin size={12} />,
}

function Logo({ url, size = 56, faded }: { url?: string | null; size?: number; faded?: boolean }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className={`rounded-full object-cover bg-white shrink-0 ${faded ? 'opacity-60' : ''}`}
      style={{ width: size, height: size, border: '2px solid #1e2128' }} />
  ) : (
    <div className="rounded-full shrink-0 flex items-center justify-center text-[10px] text-text-muted border border-dashed border-border"
      style={{ width: size, height: size }}>none</div>
  )
}

function ChangeBody({ h, labels }: { h: ProfileChange; labels: Record<string, string> }) {
  const label = (n: unknown) => labels[String(n)] ?? String(n)
  if (h.field === 'logo') {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <Logo url={h.old?.url as string | null} size={40} faded />
        <span className="text-text-muted">→</span>
        <Logo url={h.new?.url as string | null} size={40} />
      </div>
    )
  }
  if (h.field === 'description') {
    return (
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
        <p className="text-xs whitespace-pre-line break-words rounded-lg p-2 bg-red-500/5 text-red-300/90 line-through decoration-red-400/40 max-h-40 overflow-auto">{(h.old?.text as string) || '—'}</p>
        <p className="text-xs whitespace-pre-line break-words rounded-lg p-2 bg-emerald-500/5 text-emerald-300 max-h-40 overflow-auto">{(h.new?.text as string) || '—'}</p>
      </div>
    )
  }
  if (h.field === 'categories') {
    const added   = (h.new?.added as string[] | undefined) ?? []
    const removed = (h.new?.removed as string[] | undefined) ?? []
    return (
      <div className="mt-1.5 space-y-1 text-xs">
        {added.map(n => <p key={`a-${n}`} className="text-emerald-300">+ {label(n)}</p>)}
        {removed.map(n => <p key={`r-${n}`} className="text-red-300/90 line-through">− {label(n)}</p>)}
        <p className="text-text-muted break-words">
          {((h.old?.list as string[]) ?? []).map(label).join(', ') || '—'} <span className="mx-1">→</span>
          <span className="text-text-secondary">{((h.new?.list as string[]) ?? []).map(label).join(', ') || '—'}</span>
        </p>
      </div>
    )
  }
  // Pickup address: changed fields only (full detail in the pickup card below)
  return <p className="mt-1 text-xs text-text-muted break-words">Champs : {(h.changed_fields ?? []).join(', ') || '—'}</p>
}

export default function StoreProfileAdminCard({ sellerId }: { sellerId: number }) {
  const [card,    setCard]    = useState<StoreProfileCard | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [busy,    setBusy]    = useState<number | null>(null)
  const [notice,  setNotice]  = useState<string | null>(null)

  const load = useCallback(() => {
    sellerStoreProfileApi.get(sellerId).then(setCard).catch(e => setError(e.message))
  }, [sellerId])
  useEffect(() => { load() }, [load])

  const restore = async (h: ProfileChange) => {
    const what = h.field === 'logo' ? "l'ancien logo" : "l'ancienne description"
    if (!window.confirm(`Restaurer ${what} ? Il sera visible tout de suite sur la boutique.`)) return
    setBusy(h.id); setNotice(null); setError(null)
    try {
      const res = await sellerStoreProfileApi.restore(sellerId, h.id)
      setCard(res.data); setNotice(res.message)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!card) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4">
        {error ? <p className="text-sm text-accent-red">{error}</p> : <BrandLoader variant="section" minHeight={120} />}
      </div>
    )
  }

  const lastLogoChange = card.history.find(h => h.field === 'logo' && h.restorable)
  const lastDescChange = card.history.find(h => h.field === 'description' && h.restorable)

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4 min-w-0">
      <div className="flex items-center gap-2">
        <Store size={15} className="text-text-muted" />
        <h2 className="font-bold text-text-primary">Profil de la boutique</h2>
        <span className="text-xs text-text-muted">— modifiable par le vendeur, nom de la boutique: admin uniquement</span>
      </div>

      {!card.has_application && <p className="text-xs text-accent-orange">No approved application: the seller cannot edit their store profile yet.</p>}
      {notice && <p role="status" className="text-xs font-semibold text-accent-green">{notice}</p>}
      {error && <p role="alert" className="text-xs font-semibold text-accent-red">{error}</p>}

      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        {/* Logo */}
        <div className="flex md:flex-col items-center gap-3">
          <Logo url={card.logo} size={88} />
          {lastLogoChange && (
            <button type="button" disabled={busy !== null} onClick={() => restore(lastLogoChange)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-text-secondary hover:text-text-primary hover:border-border-light disabled:opacity-40">
              <RotateCcw size={12} /> Restaurer l&apos;ancien logo
            </button>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          {/* Description */}
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Description</p>
              {lastDescChange && (
                <button type="button" disabled={busy !== null} onClick={() => restore(lastDescChange)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-border text-text-secondary hover:text-text-primary hover:border-border-light disabled:opacity-40">
                  <RotateCcw size={12} /> Restaurer l&apos;ancienne description
                </button>
              )}
            </div>
            <p className={`text-sm whitespace-pre-line break-words ${card.business_description ? 'text-text-primary' : 'text-text-muted'}`}>
              {card.business_description || '—'}
            </p>
          </div>

          {/* Activity categories */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Catégories d&apos;activité</p>
            <div className="flex flex-wrap gap-1.5">
              {card.categories.length === 0 && <span className="text-sm text-text-muted">—</span>}
              {card.categories.map(c => (
                <span key={c.name} title={c.known ? c.name : `${c.name} (not in the platform list)`}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${c.known ? 'border-accent-purple/40 text-accent-purple-light bg-accent-purple/10' : 'border-border text-text-muted'}`}>
                  {c.name_fr || c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="pt-3 border-t border-border">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted mb-3"><History size={13} /> Historique des modifications</p>
        {card.history.length === 0 ? (
          <p className="text-xs text-text-muted">No change recorded.</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4">
            {card.history.map(h => (
              <li key={`${h.kind}-${h.id}`} className="ml-4 min-w-0">
                <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full" style={{ background: h.by_role === 'admin' ? '#7c3aed' : '#db142e' }} />
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <p className="text-xs text-text-secondary min-w-0">
                    <span className="inline-flex items-center gap-1 font-semibold text-text-primary">{FIELD_ICON[h.field]} {FIELD_LABEL[h.field] ?? h.field}</span>
                    {' · '}<b className="text-text-primary">{format(new Date(h.at), 'dd MMM yyyy, HH:mm')}</b>
                    {' · '}{h.by ?? 'unknown'} ({h.by_role}){h.restored_from_id ? ' · restauration' : ''}
                  </p>
                  {h.restorable && (
                    <button type="button" disabled={busy !== null} onClick={() => restore(h)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-border text-text-secondary hover:text-text-primary disabled:opacity-40">
                      {busy === h.id ? <BrandLoader variant="inline" size={11} /> : <RotateCcw size={11} />} Restaurer
                    </button>
                  )}
                </div>
                <ChangeBody h={h} labels={card.category_labels} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
