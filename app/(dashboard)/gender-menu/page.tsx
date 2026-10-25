'use client'

/**
 * app/(dashboard)/gender-menu/page.tsx
 *
 * Gender menu of gendered categories (Mode & Vêtements → Femme / Homme):
 *   - Menu tab: columns per gender (names FR/EN/AR, order), subcategories in each column (order),
 *     Women / Men checkboxes per subcategory (both = unisex), round image per subcategory × gender
 *   - Products tab: products per gender, with a manual fix when the automatic gender is wrong
 *
 * Every change is live on the storefront at once (mega-menu + subcategory bar caches are rebuilt).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ArrowDown, ArrowUp, ImagePlus, Plus, Search, Shirt, Trash2, X, Package,
} from 'lucide-react'
import { adminCategoriesApi, type Category } from '@/lib/api/categories'
import {
  adminGenderMenuApi, type GenderMenuData, type GenderMenuGroup, type GenderMenuSubcategory,
  type MenuGender, type ProductGender, type ProductGenderRow, type Paged,
} from '@/lib/api/genderMenu'
import BrandLoader from '@/components/brand/BrandLoader'
import { usePageLoading } from '@/components/brand/NavigationLoader'

const G_LABEL: Record<MenuGender, string> = { women: 'Women (Femme)', men: 'Men (Homme)' }
const P_LABEL: Record<ProductGender | 'none', string> = { women: 'Women', men: 'Men', unisex: 'Unisex', kids: 'Kids', none: 'No gender' }
const SRC_LABEL: Record<string, string> = { seller: 'Seller', inherited: 'From subcategory', admin: 'Admin fix' }

const inputCls = 'w-full bg-bg-primary border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-red transition-colors'
const errMsg = (e: any) => e?.response?.data?.message ?? 'Something went wrong.'

export default function GenderMenuPage() {
  const [cats, setCats] = useState<Category[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [catId, setCatId] = useState<number | null>(null)
  const [tab, setTab] = useState<'menu' | 'products'>('menu')
  usePageLoading(loadingCats)

  useEffect(() => {
    adminCategoriesApi.getAll()
      .then(r => {
        const all = r.data.data ?? []
        setCats(all)
        const first = all.find(c => c.is_gendered)
        if (first) setCatId(first.id)
      })
      .catch(() => setCats([]))
      .finally(() => setLoadingCats(false))
  }, [])

  const gendered = cats.filter(c => c.is_gendered)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Shirt size={16} className="text-accent-red" />
          <div>
            <p className="text-sm font-bold text-text-primary">Gender menu</p>
            <p className="text-[11px] text-text-muted">Femme / Homme columns of the storefront mega-menu and subcategory bar</p>
          </div>
        </div>
        {gendered.length > 0 && (
          <select value={catId ?? ''} onChange={e => setCatId(Number(e.target.value))}
            className="bg-bg-card border border-border rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none focus:border-accent-red">
            {gendered.map(c => <option key={c.id} value={c.id}>{c.name_fr || c.name}</option>)}
          </select>
        )}
      </div>

      {loadingCats ? <BrandLoader variant="section" size="sm" minHeight={160} /> : gendered.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-6 text-sm text-text-muted">
          No gendered category yet. Open <b>Categories</b>, edit a category and choose <b>Gendered (Femme | Homme)</b>.
        </div>
      ) : catId && (
        <>
          <div className="flex gap-1 bg-bg-card border border-border rounded-xl p-1 w-fit">
            {(['menu', 'products'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === t ? 'bg-accent-red text-white' : 'text-text-muted hover:text-text-primary'}`}>
                {t === 'menu' ? 'Menu & images' : 'Product genders'}
              </button>
            ))}
          </div>
          {tab === 'menu' ? <MenuEditor key={catId} categoryId={catId} /> : <ProductGenders key={catId} categoryId={catId} />}
        </>
      )}
    </div>
  )
}

// ─── Menu editor ──────────────────────────────────────────────────────────────

function MenuEditor({ categoryId }: { categoryId: number }) {
  const [data, setData] = useState<GenderMenuData | null>(null)
  const [gender, setGender] = useState<MenuGender>('women')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    return adminGenderMenuApi.get(categoryId).then(r => setData(r.data.data)).catch(e => setError(errMsg(e)))
  }, [categoryId])
  useEffect(() => { load() }, [load])

  /** Run an API change, then reload the whole menu. */
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await fn(); await load() } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  if (!data) return error ? <ErrorBox msg={error} onClose={() => setError('')} /> : <BrandLoader variant="section" size="sm" minHeight={160} />

  const groups = data.groups[gender] ?? []
  const subsById = new Map(data.subcategories.map(s => [s.id, s]))

  const order = (next: GenderMenuGroup[]) =>
    run(() => adminGenderMenuApi.reorder(categoryId, gender, next.map(g => ({ id: g.id, items: g.items.map(i => i.id) }))))
  const moveGroup = (idx: number, dir: -1 | 1) => {
    const next = [...groups]; const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    order(next)
  }
  const moveItem = (gIdx: number, iIdx: number, dir: -1 | 1) => {
    const next = groups.map(g => ({ ...g, items: [...g.items] }))
    const items = next[gIdx].items; const j = iIdx + dir
    if (j < 0 || j >= items.length) return
    ;[items[iIdx], items[j]] = [items[j], items[iIdx]]
    order(next)
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBox msg={error} onClose={() => setError('')} />}

      <div className="flex flex-wrap items-center gap-2">
        {(['women', 'men'] as const).map(g => (
          <button key={g} onClick={() => setGender(g)}
            className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${gender === g ? 'border-accent-red bg-accent-red/10 text-accent-red' : 'border-border text-text-muted hover:bg-bg-hover'}`}>
            {G_LABEL[g]} · {data.groups[g]?.length ?? 0} columns
          </button>
        ))}
        {busy && <BrandLoader variant="inline" size={14} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {groups.map((g, gi) => (
          <GroupCard key={g.id} group={g} gender={gender} first={gi === 0} last={gi === groups.length - 1}
            subsById={subsById} allSubs={data.subcategories} busy={busy}
            onMove={d => moveGroup(gi, d)} onMoveItem={(ii, d) => moveItem(gi, ii, d)}
            run={run} />
        ))}
        <NewGroupCard gender={gender} busy={busy} onCreate={p => run(() => adminGenderMenuApi.createGroup(categoryId, { gender, ...p }))} />
      </div>

      <SubcategoryGenders data={data} categoryId={categoryId} busy={busy} run={run} />
    </div>
  )
}

function GroupCard({ group, gender, first, last, subsById, allSubs, busy, onMove, onMoveItem, run }: {
  group: GenderMenuGroup; gender: MenuGender; first: boolean; last: boolean
  subsById: Map<number, GenderMenuSubcategory>; allSubs: GenderMenuSubcategory[]; busy: boolean
  onMove: (d: -1 | 1) => void; onMoveItem: (i: number, d: -1 | 1) => void
  run: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const [names, setNames] = useState({ name: group.name, name_fr: group.name_fr ?? '', name_ar: group.name_ar ?? '' })
  const [adding, setAdding] = useState('')
  const dirty = names.name !== group.name || names.name_fr !== (group.name_fr ?? '') || names.name_ar !== (group.name_ar ?? '')
  const inGroup = new Set(group.items.map(i => i.subcategory_id))

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        <p className="flex-1 text-xs font-black uppercase tracking-wider text-accent-red truncate">{group.name_fr || group.name}</p>
        <IconBtn title="Move column up" disabled={busy || first} onClick={() => onMove(-1)}><ArrowUp size={13} /></IconBtn>
        <IconBtn title="Move column down" disabled={busy || last} onClick={() => onMove(1)}><ArrowDown size={13} /></IconBtn>
        <IconBtn title="Delete column" disabled={busy} danger onClick={() => {
          if (confirm(`Delete the column "${group.name_fr || group.name}"? Its subcategories leave the ${gender === 'women' ? 'Femme' : 'Homme'} menu.`))
            run(() => adminGenderMenuApi.deleteGroup(group.id))
        }}><Trash2 size={13} /></IconBtn>
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-3 pt-2.5">
        <input className={inputCls} value={names.name_fr} placeholder="FR" aria-label="Column name FR" onChange={e => setNames(n => ({ ...n, name_fr: e.target.value }))} />
        <input className={inputCls} value={names.name} placeholder="EN *" aria-label="Column name EN" onChange={e => setNames(n => ({ ...n, name: e.target.value }))} />
        <input className={inputCls} value={names.name_ar} placeholder="AR" aria-label="Column name AR" dir="rtl" onChange={e => setNames(n => ({ ...n, name_ar: e.target.value }))} />
      </div>
      {dirty && (
        <div className="px-3 pt-1.5">
          <button disabled={busy || !names.name.trim()} onClick={() => run(() => adminGenderMenuApi.updateGroup(group.id, names))}
            className="text-[11px] font-bold text-accent-red hover:underline disabled:opacity-50">Save names</button>
        </div>
      )}

      <ul className="px-3 py-2.5 space-y-1.5 flex-1">
        {group.items.map((it, ii) => {
          const s = subsById.get(it.subcategory_id)
          return (
            <li key={it.id} className="flex items-center gap-2">
              <ImageSlot sub={s} subId={it.subcategory_id} gender={gender} busy={busy} run={run} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate ${s?.is_active === false ? 'text-text-muted line-through' : 'text-text-primary'}`}>{s?.name_fr || s?.name || it.subcategory?.name}</p>
                <p className="text-[10px] text-text-muted truncate">{s?.category_name} · {countFor(s, gender)} products</p>
              </div>
              <IconBtn title="Move up" disabled={busy || ii === 0} onClick={() => onMoveItem(ii, -1)}><ArrowUp size={12} /></IconBtn>
              <IconBtn title="Move down" disabled={busy || ii === group.items.length - 1} onClick={() => onMoveItem(ii, 1)}><ArrowDown size={12} /></IconBtn>
              <IconBtn title="Remove from column" disabled={busy} danger onClick={() => run(() => adminGenderMenuApi.removeItem(it.id))}><X size={12} /></IconBtn>
            </li>
          )
        })}
        {group.items.length === 0 && <li className="text-[11px] text-text-muted">No subcategory yet.</li>}
      </ul>

      <div className="flex gap-1.5 px-3 pb-3">
        <select value={adding} onChange={e => setAdding(e.target.value)} className={inputCls} aria-label="Subcategory to add">
          <option value="">Add a subcategory…</option>
          {allSubs.filter(s => !inGroup.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.category_name} › {s.name_fr || s.name}</option>)}
        </select>
        <button disabled={busy || !adding} onClick={() => { const id = Number(adding); setAdding(''); run(() => adminGenderMenuApi.addItem(group.id, id)) }}
          className="px-2.5 rounded-lg bg-accent-red text-white disabled:opacity-40" aria-label="Add"><Plus size={13} /></button>
      </div>
    </div>
  )
}

function countFor(s: GenderMenuSubcategory | undefined, gender: MenuGender): number {
  if (!s) return 0
  return (s.counts[gender] ?? 0) + (s.counts.unisex ?? 0)
}

/** Round thumbnail for subcategory × gender: click to upload / replace, × to go back to automatic. */
function ImageSlot({ sub, subId, gender, busy, run }: {
  sub?: GenderMenuSubcategory; subId: number; gender: MenuGender; busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const img = sub?.images?.[gender]
  return (
    <div className="relative flex-shrink-0">
      <button type="button" disabled={busy} onClick={() => input.current?.click()}
        title={img ? 'Replace image' : 'Upload image (otherwise a product photo is used)'}
        className="w-9 h-9 rounded-full border border-border bg-bg-primary overflow-hidden flex items-center justify-center hover:border-accent-red transition-colors">
        {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={13} className="text-text-muted" />}
      </button>
      {img && (
        <button type="button" disabled={busy} title="Remove image (use a product photo)"
          onClick={() => run(() => adminGenderMenuApi.deleteImage(subId, gender))}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-red text-white flex items-center justify-center"><X size={9} /></button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(() => adminGenderMenuApi.uploadImage(subId, gender, f)) }} />
    </div>
  )
}

function NewGroupCard({ gender, busy, onCreate }: { gender: MenuGender; busy: boolean; onCreate: (p: { name: string; name_fr?: string; name_ar?: string }) => Promise<void> }) {
  const [p, setP] = useState({ name: '', name_fr: '', name_ar: '' })
  return (
    <div className="border border-dashed border-border rounded-xl p-3 flex flex-col gap-2">
      <p className="text-xs font-bold text-text-primary">New column · {G_LABEL[gender]}</p>
      <input className={inputCls} placeholder="Name FR (e.g. Vêtements)" value={p.name_fr} onChange={e => setP({ ...p, name_fr: e.target.value })} />
      <input className={inputCls} placeholder="Name EN * (e.g. Clothing)" value={p.name} onChange={e => setP({ ...p, name: e.target.value })} />
      <input className={inputCls} placeholder="Name AR" dir="rtl" value={p.name_ar} onChange={e => setP({ ...p, name_ar: e.target.value })} />
      <button disabled={busy || !p.name.trim()} onClick={() => onCreate(p).then(() => setP({ name: '', name_fr: '', name_ar: '' }))}
        className="py-2 rounded-lg bg-accent-red text-white text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"><Plus size={13} /> Add column</button>
    </div>
  )
}

/** Women / Men checkboxes per subcategory (both ticked = unisex). */
function SubcategoryGenders({ data, categoryId, busy, run }: {
  data: GenderMenuData; categoryId: number; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const rows = data.subcategories.filter(s =>
    (s.category_id === categoryId || s.genders.length > 0) &&
    (!q || `${s.name} ${s.name_fr ?? ''} ${s.slug}`.toLowerCase().includes(q.toLowerCase())))

  const toggle = (s: GenderMenuSubcategory, g: MenuGender) => {
    const next = s.genders.includes(g) ? s.genders.filter(x => x !== g) : [...s.genders, g]
    run(() => adminGenderMenuApi.setSubcategoryGenders(categoryId, s.id, next))
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border">
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-bold text-text-primary">Subcategory genders</p>
          <p className="text-[11px] text-text-muted">Both ticked = unisex (shows in Femme and Homme). Products without a seller gender inherit this. A new tick adds the subcategory to a column.</p>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className={`${inputCls} pl-7 w-44`} />
        </div>
      </div>
      <div className="divide-y divide-border">
        {rows.map(s => (
          <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
            <div className="flex-1 min-w-[160px]">
              <p className={`text-xs font-semibold ${s.is_active ? 'text-text-primary' : 'text-text-muted line-through'}`}>{s.name_fr || s.name}</p>
              <p className="text-[10px] text-text-muted">
                {s.category_id !== categoryId && <>{s.category_name} · </>}
                {(['women', 'men', 'unisex', 'kids', 'none'] as const).filter(k => s.counts[k]).map(k => `${P_LABEL[k]} ${s.counts[k]}`).join(' · ') || 'No products'}
              </p>
            </div>
            {(['women', 'men'] as const).map(g => {
              const on = s.genders.includes(g)
              return (
                <label key={g} className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${on ? 'text-accent-red' : 'text-text-muted'}`}>
                  <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(s, g)} className="accent-[#db142e]" />
                  {g === 'women' ? 'Femme' : 'Homme'}
                </label>
              )
            })}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.genders.length === 2 ? 'border-accent-green/30 text-accent-green bg-accent-green/10' : 'border-border text-text-muted'}`}>
              {s.genders.length === 2 ? 'Unisex' : s.genders.length === 1 ? (s.genders[0] === 'women' ? 'Femme only' : 'Homme only') : 'No gender'}
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-center text-xs text-text-muted py-6">No subcategory</p>}
      </div>
    </div>
  )
}

// ─── Product genders ──────────────────────────────────────────────────────────

function ProductGenders({ categoryId }: { categoryId: number }) {
  const [gender, setGender] = useState('')
  const [source, setSource] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [res, setRes] = useState<{ summary: Record<string, number>; data: Paged<ProductGenderRow> } | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<number | null>(null)

  const params = useMemo(() => ({ category_id: categoryId, gender: gender || undefined, source: source || undefined, search: search || undefined, page }), [categoryId, gender, source, search, page])

  const load = useCallback(() => adminGenderMenuApi.products(params)
    .then(r => setRes({ summary: r.data.summary, data: r.data.data }))
    .catch(e => setError(errMsg(e))), [params])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  const fix = async (id: number, g: ProductGender | 'auto') => {
    setSaving(id); setError('')
    try { await adminGenderMenuApi.setProductGender(id, g); await load() } catch (e) { setError(errMsg(e)) } finally { setSaving(null) }
  }

  const total = res ? Object.values(res.summary).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="space-y-3">
      {error && <ErrorBox msg={error} onClose={() => setError('')} />}
      <div className="flex flex-wrap gap-2">
        {(['', 'women', 'men', 'unisex', 'kids', 'none'] as const).map(g => (
          <button key={g || 'all'} onClick={() => { setGender(g); setPage(1) }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${gender === g ? 'border-accent-red bg-accent-red/10 text-accent-red' : 'border-border text-text-muted hover:bg-bg-hover'}`}>
            {g ? P_LABEL[g] : 'All'} · {g ? (res?.summary[g] ?? 0) : total}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Product name or ID…" className={`${inputCls} pl-7 py-2`} />
        </div>
        <select value={source} onChange={e => { setSource(e.target.value); setPage(1) }} className={`${inputCls} w-auto py-2`} aria-label="Source">
          <option value="">Any source</option>
          <option value="seller">Seller</option>
          <option value="inherited">From subcategory</option>
          <option value="admin">Admin fix</option>
          <option value="none">None</option>
        </select>
      </div>

      <div className="bg-bg-card border border-border rounded-xl divide-y divide-border">
        {!res ? <BrandLoader variant="section" size="sm" minHeight={120} /> : res.data.data.length === 0 ? (
          <p className="text-center text-xs text-text-muted py-8">No product</p>
        ) : res.data.data.map(p => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <div className="w-10 h-10 rounded-lg bg-bg-primary border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
              {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={14} className="text-text-muted" />}
            </div>
            <div className="flex-1 min-w-[160px]">
              <p className="text-xs font-semibold text-text-primary truncate">#{p.id} · {p.name}</p>
              <p className="text-[10px] text-text-muted truncate">{p.category_name}{p.subcategory_name ? ` › ${p.subcategory_name}` : ''}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-text-primary">{P_LABEL[p.gender ?? 'none']}</p>
              <p className="text-[10px] text-text-muted">{p.gender_source ? SRC_LABEL[p.gender_source] : '—'}</p>
            </div>
            <select value={p.gender_override ?? 'auto'} disabled={saving === p.id} onChange={e => fix(p.id, e.target.value as ProductGender | 'auto')}
              className={`${inputCls} w-auto`} aria-label={`Fix gender of product ${p.id}`}>
              <option value="auto">Automatic</option>
              <option value="women">Women</option>
              <option value="men">Men</option>
              <option value="unisex">Unisex</option>
              <option value="kids">Kids</option>
            </select>
          </div>
        ))}
      </div>

      {res && res.data.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40">Previous</button>
          <span className="text-text-muted">{res.data.current_page} / {res.data.last_page}</span>
          <button disabled={page >= res.data.last_page} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function IconBtn({ children, title, disabled, danger, onClick }: { children: React.ReactNode; title: string; disabled?: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
      className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30 ${danger ? 'text-text-muted hover:text-accent-red hover:bg-accent-red/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}>
      {children}
    </button>
  )
}

function ErrorBox({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-accent-red/10 border border-accent-red/25 rounded-xl px-4 py-3 text-sm text-accent-red">
      <AlertCircle size={14} className="flex-shrink-0" />
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} className="hover:opacity-70"><X size={13} /></button>
    </div>
  )
}
