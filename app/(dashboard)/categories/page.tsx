'use client'

/**
 * app/(dashboard)/categories/page.tsx
 *
 * Three-panel layout:
 *   1. Categories list (left)
 *   2. Subcategories table (middle/right)
 *   3. Attribute manager — slides in when a subcategory row is clicked (drawer)
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Search, Edit2, Trash2, Loader2, CheckCircle, XCircle,
  ChevronRight, Layers, Package, Tag, ToggleLeft, ToggleRight,
  AlertCircle, FolderOpen, X, Settings, Zap, Info, PlusCircle,
  Palette, Hash, Type, ToggleLeft as BoolIcon, List,
} from 'lucide-react'
import {
  adminCategoriesApi, adminSubcategoriesApi, adminAttributesApi,
  type Category, type Subcategory, type SubcategoryAttribute,
  type Attribute, type AttributeOption,
  type CategoryPayload, type SubcategoryPayload,
  type AttributePayload, type AttributeOptionPayload,
} from '@/lib/api/categories'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/25">
      <CheckCircle size={9} /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-red/10 text-accent-red border border-accent-red/25">
      <XCircle size={9} /> Inactive
    </span>
  )
}

function TypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    color:       <Palette size={11} />,
    select:      <List size={11} />,
    multiselect: <List size={11} />,
    number:      <Hash size={11} />,
    text:        <Type size={11} />,
    boolean:     <BoolIcon size={11} />,
  }
  return <span className="text-text-muted">{icons[type] ?? <List size={11} />}</span>
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, size = 'md' }: {
  title: string; onClose: () => void; children: React.ReactNode; size?: 'sm' | 'md'
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className={`bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto ${size === 'sm' ? 'max-w-sm' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[11px] text-accent-red mt-1">{error}</p>}
    </div>
  )
}

const inputCls = "w-full bg-bg-primary border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-red transition-colors font-[inherit]"

// ─── Category Form Modal ──────────────────────────────────────────────────────

function CategoryFormModal({ initial, onClose, onSaved }: {
  initial?: Category | null; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!initial
  const [form, setForm] = useState<CategoryPayload>({
    name: initial?.name ?? '', name_ar: initial?.name_ar ?? '',
    description: initial?.description ?? '', icon: initial?.icon ?? '',
    is_active: initial?.is_active ?? true, order: initial?.order ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof CategoryPayload, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    try {
      isEdit ? await adminCategoriesApi.update(initial!.id, form) : await adminCategoriesApi.create(form)
      onSaved(); onClose()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to save.') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? 'Edit Category' : 'New Category'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/25 rounded-xl px-3 py-2.5 text-xs text-accent-red mb-4"><AlertCircle size={12} /> {error}</div>}
        <Field label="Name (EN) *"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Electronics" className={inputCls} /></Field>
        <Field label="Name (AR)"><input value={form.name_ar ?? ''} onChange={e => set('name_ar', e.target.value)} placeholder="e.g. إلكترونيات" className={inputCls} style={{ direction: 'rtl' }} /></Field>
        <Field label="Description"><textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={3} placeholder="Short description…" className={`${inputCls} resize-none`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon (emoji)"><input value={form.icon ?? ''} onChange={e => set('icon', e.target.value)} placeholder="🛍️" className={inputCls} /></Field>
          <Field label="Display Order"><input type="number" min={0} value={form.order ?? 0} onChange={e => set('order', parseInt(e.target.value) || 0)} className={inputCls} /></Field>
        </div>
        <Field label="Status">
          <div className="flex gap-2">
            {([true, false] as const).map(v => (
              <button key={String(v)} type="button" onClick={() => set('is_active', v)}
                className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${form.is_active === v ? v ? 'border-accent-green bg-accent-green/10 text-accent-green' : 'border-accent-red bg-accent-red/10 text-accent-red' : 'border-border text-text-muted hover:bg-bg-hover'}`}>
                {v ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex gap-3 mt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-accent-red hover:bg-accent-red/90 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Subcategory Form Modal ───────────────────────────────────────────────────

function SubcategoryFormModal({ initial, categories, defaultCategoryId, onClose, onSaved }: {
  initial?: Subcategory | null; categories: Category[]; defaultCategoryId?: number
  onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!initial
  const [form, setForm] = useState<SubcategoryPayload>({
    category_id: initial?.category_id ?? defaultCategoryId ?? (categories[0]?.id ?? 0),
    name: initial?.name ?? '', name_ar: initial?.name_ar ?? '',
    icon: initial?.icon ?? '', is_active: initial?.is_active ?? true, order: initial?.order ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof SubcategoryPayload, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.category_id) { setError('Select a category.'); return }
    setSaving(true); setError('')
    try {
      isEdit ? await adminSubcategoriesApi.update(initial!.id, form) : await adminSubcategoriesApi.create(form)
      onSaved(); onClose()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to save.') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? 'Edit Subcategory' : 'New Subcategory'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/25 rounded-xl px-3 py-2.5 text-xs text-accent-red mb-4"><AlertCircle size={12} /> {error}</div>}
        <Field label="Parent Category *">
          <select value={form.category_id} onChange={e => set('category_id', Number(e.target.value))} className={inputCls}>
            <option value={0}>— Select category —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Name (EN) *"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Smartphones" className={inputCls} /></Field>
        <Field label="Name (AR)"><input value={form.name_ar ?? ''} onChange={e => set('name_ar', e.target.value)} placeholder="e.g. هواتف ذكية" className={inputCls} style={{ direction: 'rtl' }} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon (emoji)"><input value={form.icon ?? ''} onChange={e => set('icon', e.target.value)} placeholder="📱" className={inputCls} /></Field>
          <Field label="Display Order"><input type="number" min={0} value={form.order ?? 0} onChange={e => set('order', parseInt(e.target.value) || 0)} className={inputCls} /></Field>
        </div>
        <Field label="Status">
          <div className="flex gap-2">
            {([true, false] as const).map(v => (
              <button key={String(v)} type="button" onClick={() => set('is_active', v)}
                className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${form.is_active === v ? v ? 'border-accent-green bg-accent-green/10 text-accent-green' : 'border-accent-red bg-accent-red/10 text-accent-red' : 'border-border text-text-muted hover:bg-bg-hover'}`}>
                {v ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex gap-3 mt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-accent-red hover:bg-accent-red/90 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Subcategory'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── New Attribute Modal ──────────────────────────────────────────────────────

function NewAttributeModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (attr: Attribute) => void
}) {
  const [form, setForm] = useState<AttributePayload>({ name: '', type: 'select', is_filterable: true, is_visible: true, order: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof AttributePayload, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await adminAttributesApi.create(form)
      onCreated(res.data.data)
      onClose()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to create.') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Create New Attribute" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit}>
        {error && <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/25 rounded-xl px-3 py-2.5 text-xs text-accent-red mb-4"><AlertCircle size={12} /> {error}</div>}
        <Field label="Name *"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Size, Color, Material" className={inputCls} /></Field>
        <Field label="Type">
          <select value={form.type} onChange={e => set('type', e.target.value as any)} className={inputCls}>
            <option value="select">Select (single choice)</option>
            <option value="multiselect">Multi-select</option>
            <option value="color">Color</option>
            <option value="text">Text (free input)</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean (Yes/No)</option>
          </select>
        </Field>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-text-muted hover:bg-bg-hover transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-accent-red hover:bg-accent-red/90 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
            {saving && <Loader2 size={13} className="animate-spin" />}
            Create
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Attribute Manager Drawer ─────────────────────────────────────────────────
// Slides in from the right when a subcategory is selected

interface AttributeManagerProps {
  subcategory: Subcategory
  onClose: () => void
}

function AttributeManager({ subcategory, onClose }: AttributeManagerProps) {
  const [assigned,       setAssigned]       = useState<SubcategoryAttribute[]>([])
  const [allAttributes,  setAllAttributes]  = useState<Attribute[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [showNewAttr,    setShowNewAttr]    = useState(false)

  // Assign form state
  const [selectedAttrId, setSelectedAttrId] = useState<number>(0)
  const [isVariant,      setIsVariant]      = useState(true)
  const [assigning,      setAssigning]      = useState(false)

  // Option management
  const [addingOptionFor,  setAddingOptionFor]  = useState<number | null>(null)
  const [newOptionValue,   setNewOptionValue]   = useState('')
  const [newOptionHex,     setNewOptionHex]     = useState('#000000')
  const [savingOption,     setSavingOption]      = useState(false)
  const [removingId,       setRemovingId]        = useState<number | null>(null)
  const [deletingOptId,    setDeletingOptId]     = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [assignedRes, allRes] = await Promise.all([
        adminSubcategoriesApi.getAttributes(subcategory.id),
        adminAttributesApi.getAll(),
      ])
      setAssigned(assignedRes.data.data)
      setAllAttributes(allRes.data.data)
    } catch { setError('Failed to load attributes.') }
    finally { setLoading(false) }
  }, [subcategory.id])

  useEffect(() => { load() }, [load])

  // Attributes not yet assigned to this subcategory
  const assignedIds = new Set(assigned.map(a => a.id))
  const unassigned  = allAttributes.filter(a => !assignedIds.has(a.id))

  const handleAssign = async () => {
    if (!selectedAttrId) return
    setAssigning(true)
    try {
      await adminSubcategoriesApi.assignAttribute(subcategory.id, {
        attribute_id: selectedAttrId,
        is_variant:   isVariant,
        is_required:  false,
        order:        assigned.length,
      })
      setSelectedAttrId(0)
      load()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to assign.') }
    finally { setAssigning(false) }
  }

  const handleToggleVariant = async (attr: SubcategoryAttribute) => {
    try {
      await adminSubcategoriesApi.updateAssignment(subcategory.id, attr.id, {
        is_variant: !attr.is_variant,
      })
      load()
    } catch { /* ignore */ }
  }

  const handleRemove = async (attrId: number) => {
    if (!confirm('Remove this attribute from the subcategory?')) return
    setRemovingId(attrId)
    try {
      await adminSubcategoriesApi.removeAttribute(subcategory.id, attrId)
      load()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to remove.') }
    finally { setRemovingId(null) }
  }

  const handleAddOption = async (attr: SubcategoryAttribute) => {
    if (!newOptionValue.trim()) return
    setSavingOption(true)
    try {
      await adminAttributesApi.addOption(attr.id, {
        value:     newOptionValue.trim(),
        color_hex: attr.type === 'color' ? newOptionHex : undefined,
        order:     attr.options.length,
      })
      setNewOptionValue('')
      setNewOptionHex('#000000')
      setAddingOptionFor(null)
      load()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to add option.') }
    finally { setSavingOption(false) }
  }

  const handleDeleteOption = async (attr: SubcategoryAttribute, opt: AttributeOption) => {
    if (!confirm(`Delete option "${opt.value}"?`)) return
    setDeletingOptId(opt.id)
    try {
      await adminAttributesApi.deleteOption(attr.id, opt.id)
      load()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Cannot delete: option may be in use.') }
    finally { setDeletingOptId(null) }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-bg-secondary border-l border-border shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'slideInRight 0.22s ease' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-card flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Settings size={15} className="text-accent-red" />
              <h3 className="text-sm font-bold text-text-primary">Manage Attributes</h3>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">
              {subcategory.icon && <span className="mr-1">{subcategory.icon}</span>}
              {subcategory.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {error && (
            <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/25 rounded-xl px-3 py-2.5 text-xs text-accent-red">
              <AlertCircle size={12} className="flex-shrink-0" /> {error}
              <button onClick={() => setError('')} className="ml-auto"><X size={11} /></button>
            </div>
          )}

          {/* ── Assign existing attribute ── */}
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
              Assign Attribute to this Subcategory
            </p>

            <div className="flex gap-2 mb-3">
              <select
                value={selectedAttrId}
                onChange={e => setSelectedAttrId(Number(e.target.value))}
                className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-red transition-colors"
              >
                <option value={0}>— Select attribute —</option>
                {unassigned.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                ))}
              </select>
            </div>

            {selectedAttrId > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-text-muted">Role:</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsVariant(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${isVariant ? 'border-accent-red bg-accent-red/10 text-accent-red' : 'border-border text-text-muted hover:bg-bg-hover'}`}>
                    <Zap size={10} /> Variant axis
                  </button>
                  <button type="button" onClick={() => setIsVariant(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${!isVariant ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-border text-text-muted hover:bg-bg-hover'}`}>
                    <Info size={10} /> Info only
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleAssign} disabled={!selectedAttrId || assigning}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red hover:bg-accent-red/90 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
                {assigning ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Assign
              </button>
              <button onClick={() => setShowNewAttr(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-bg-hover hover:bg-bg-primary border border-border text-xs font-semibold text-text-secondary rounded-lg transition-colors">
                <PlusCircle size={11} /> New Attribute
              </button>
            </div>
          </div>

          {/* ── Assigned attributes list ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
              Assigned Attributes ({assigned.length})
            </p>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-accent-red" />
              </div>
            ) : assigned.length === 0 ? (
              <div className="text-center py-10 bg-bg-card border border-dashed border-border rounded-xl">
                <Layers size={24} className="text-text-muted opacity-30 mx-auto mb-2" />
                <p className="text-xs text-text-muted">No attributes assigned yet.</p>
                <p className="text-[11px] text-text-muted opacity-60 mt-1">
                  Assign attributes above so sellers can configure variants.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assigned.map(attr => (
                  <div key={attr.id} className="bg-bg-card border border-border rounded-xl overflow-hidden">

                    {/* Attribute header row */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                      <TypeIcon type={attr.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-primary">{attr.name}</span>
                          <span className="text-[9px] font-bold text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border uppercase tracking-wide">
                            {attr.type}
                          </span>
                          {/* Variant / Info toggle badge */}
                          <button
                            onClick={() => handleToggleVariant(attr)}
                            title="Click to toggle Variant / Info"
                            className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                              attr.is_variant
                                ? 'bg-accent-red/10 text-accent-red border-accent-red/25 hover:bg-accent-red/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/25 hover:bg-blue-500/20'
                            }`}
                          >
                            {attr.is_variant ? <><Zap size={8} /> Variant</> : <><Info size={8} /> Info</>}
                          </button>
                        </div>
                        <span className="text-[10px] text-text-muted font-mono">{attr.slug}</span>
                      </div>
                      <button
                        onClick={() => handleRemove(attr.id)}
                        disabled={removingId === attr.id}
                        className="p-1.5 rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors disabled:opacity-40"
                        title="Remove from subcategory"
                      >
                        {removingId === attr.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>

                    {/* Options list (for select / multiselect / color) */}
                    {['select', 'multiselect', 'color'].includes(attr.type) && (
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                            Values ({attr.options.length})
                          </span>
                          <button
                            onClick={() => setAddingOptionFor(addingOptionFor === attr.id ? null : attr.id)}
                            className="flex items-center gap-1 text-[10px] font-bold text-accent-red hover:opacity-80 transition-opacity"
                          >
                            <Plus size={10} /> Add value
                          </button>
                        </div>

                        {/* Existing options */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {attr.options.map(opt => (
                            <div key={opt.id}
                              className="flex items-center gap-1.5 bg-bg-primary border border-border rounded-lg px-2 py-1 text-xs font-medium text-text-secondary group">
                              {attr.type === 'color' && opt.color_hex && (
                                <span className="w-3 h-3 rounded-full border border-border flex-shrink-0" style={{ background: opt.color_hex }} />
                              )}
                              {opt.value}
                              <button
                                onClick={() => handleDeleteOption(attr, opt)}
                                disabled={deletingOptId === opt.id}
                                className="ml-0.5 text-text-muted hover:text-accent-red transition-colors opacity-0 group-hover:opacity-100"
                              >
                                {deletingOptId === opt.id ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                              </button>
                            </div>
                          ))}
                          {attr.options.length === 0 && (
                            <span className="text-[11px] text-text-muted italic">No values yet — add some below</span>
                          )}
                        </div>

                        {/* Add option inline form */}
                        {addingOptionFor === attr.id && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                            {attr.type === 'color' && (
                              <input type="color" value={newOptionHex} onChange={e => setNewOptionHex(e.target.value)}
                                className="w-8 h-8 rounded-lg border border-border cursor-pointer flex-shrink-0 bg-bg-primary p-0.5" />
                            )}
                            <input
                              value={newOptionValue}
                              onChange={e => setNewOptionValue(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddOption(attr))}
                              placeholder={attr.type === 'color' ? 'e.g. Red' : 'e.g. XL'}
                              className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-red transition-colors"
                            />
                            <button onClick={() => handleAddOption(attr)} disabled={savingOption || !newOptionValue.trim()}
                              className="px-3 py-1.5 bg-accent-red hover:bg-accent-red/90 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1">
                              {savingOption ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                              Add
                            </button>
                            <button onClick={() => { setAddingOptionFor(null); setNewOptionValue('') }}
                              className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Attribute Modal (above drawer) */}
      {showNewAttr && (
        <NewAttributeModal
          onClose={() => setShowNewAttr(false)}
          onCreated={(newAttr) => {
            setAllAttributes(prev => [...prev, newAttr])
            setSelectedAttrId(newAttr.id)
            setShowNewAttr(false)
          }}
        />
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function CategoriesPage() {
  const [categories,    setCategories]    = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loadingCats,   setLoadingCats]   = useState(true)
  const [loadingSubs,   setLoadingSubs]   = useState(false)
  const [selectedCat,   setSelectedCat]   = useState<Category | null>(null)
  const [managingSub,   setManagingSub]   = useState<Subcategory | null>(null)
  const [catSearch,     setCatSearch]     = useState('')
  const [subSearch,     setSubSearch]     = useState('')
  const [deletingId,    setDeletingId]    = useState<number | null>(null)
  const [deleteError,   setDeleteError]   = useState('')
  const [togglingId,    setTogglingId]    = useState<number | null>(null)

  const [catModal, setCatModal] = useState<{ open: boolean; item: Category | null }>({ open: false, item: null })
  const [subModal, setSubModal] = useState<{ open: boolean; item: Subcategory | null }>({ open: false, item: null })

  const loadCategories = useCallback(async () => {
    setLoadingCats(true)
    try {
      const res = await adminCategoriesApi.getAll()
      setCategories(res.data.data)
    } catch { } finally { setLoadingCats(false) }
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  const loadSubcategories = useCallback(async (catId: number) => {
    setLoadingSubs(true)
    try {
      const res = await adminSubcategoriesApi.getAll({ category_id: catId })
      setSubcategories(res.data.data)
    } catch { setSubcategories([]) } finally { setLoadingSubs(false) }
  }, [])

  useEffect(() => {
    if (selectedCat) loadSubcategories(selectedCat.id)
    else setSubcategories([])
  }, [selectedCat, loadSubcategories])

  const deleteCategory = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return
    setDeletingId(cat.id); setDeleteError('')
    try {
      await adminCategoriesApi.delete(cat.id)
      if (selectedCat?.id === cat.id) setSelectedCat(null)
      loadCategories()
    } catch (err: any) { setDeleteError(err?.response?.data?.message ?? 'Delete failed.') }
    finally { setDeletingId(null) }
  }

  const toggleCategory = async (cat: Category) => {
    setTogglingId(cat.id)
    try { await adminCategoriesApi.toggle(cat.id); loadCategories() }
    catch { } finally { setTogglingId(null) }
  }

  const deleteSubcategory = async (sub: Subcategory) => {
    if (!confirm(`Delete subcategory "${sub.name}"?`)) return
    setDeletingId(sub.id); setDeleteError('')
    try {
      await adminSubcategoriesApi.delete(sub.id)
      loadSubcategories(selectedCat!.id)
      loadCategories()
    } catch (err: any) { setDeleteError(err?.response?.data?.message ?? 'Delete failed.') }
    finally { setDeletingId(null) }
  }

  const filteredCats = categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
  const filteredSubs = subcategories.filter(s => s.name.toLowerCase().includes(subSearch.toLowerCase()))

  return (
    <div className="space-y-4">

      {/* ── New Category button ── */}
      <div className="flex justify-end">
        <button
          onClick={() => setCatModal({ open: true, item: null })}
          className="flex items-center gap-2 px-4 py-2 bg-accent-red hover:bg-accent-red/90 text-white text-sm font-bold rounded-xl transition-colors"
          style={{ boxShadow: '0 6px 20px rgba(219,20,46,0.35)' }}
        >
          <Plus size={15} /> New Category
        </button>
      </div>

      {/* ── Delete error banner ── */}
      {deleteError && (
        <div className="flex items-center gap-3 bg-accent-red/10 border border-accent-red/25 rounded-xl px-4 py-3 text-sm text-accent-red">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="flex-1">{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="hover:opacity-70 transition-opacity"><X size={13} /></button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Categories',    value: categories.length,                                                color: 'text-accent-red'   },
          { label: 'Active Categories',   value: categories.filter(c => c.is_active).length,                     color: 'text-accent-green' },
          { label: 'Total Subcategories', value: categories.reduce((a, c) => a + (c.subcategories_count ?? 0), 0), color: 'text-text-primary' },
        ].map(stat => (
          <div key={stat.label} className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Two-panel layout ── */}
      <div className="grid grid-cols-[380px_1fr] gap-4 items-start">

        {/* LEFT: Categories */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <Tag size={14} className="text-accent-red flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary">Categories</p>
              <p className="text-[11px] text-text-muted">{categories.length} total</p>
            </div>
          </div>
          <div className="px-4 py-3 border-b border-border">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Search categories…"
                className="w-full bg-bg-primary border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-red transition-colors" />
            </div>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {loadingCats ? (
              <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-accent-red" /></div>
            ) : filteredCats.length === 0 ? (
              <p className="text-center text-sm text-text-muted py-10">No categories found</p>
            ) : filteredCats.map(cat => {
              const isSelected = selectedCat?.id === cat.id
              return (
                <div key={cat.id} onClick={() => setSelectedCat(isSelected ? null : cat)}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-all"
                  style={{ background: isSelected ? 'rgba(219,20,46,0.06)' : 'transparent', borderLeft: `3px solid ${isSelected ? '#db142e' : 'transparent'}` }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: isSelected ? 'rgba(219,20,46,0.12)' : 'rgba(255,255,255,0.04)' }}>
                    {cat.icon || <Tag size={14} className="text-text-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-accent-red' : 'text-text-primary'}`}>{cat.name}</p>
                      <ActiveBadge active={cat.is_active} />
                    </div>
                    <div className="flex gap-3">
                      <span className="text-[10px] text-text-muted flex items-center gap-1"><Package size={8} /> {cat.products_count ?? 0} products</span>
                      <span className="text-[10px] text-text-muted flex items-center gap-1"><Layers size={8} /> {cat.subcategories_count ?? 0} subs</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleCategory(cat)} disabled={togglingId === cat.id} title={cat.is_active ? 'Deactivate' : 'Activate'}
                      className={`p-1.5 rounded-md transition-colors ${cat.is_active ? 'text-accent-green hover:bg-accent-green/10' : 'text-text-muted hover:bg-bg-hover'}`}>
                      {togglingId === cat.id ? <Loader2 size={13} className="animate-spin" /> : cat.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    </button>
                    <button onClick={() => setCatModal({ open: true, item: cat })} title="Edit"
                      className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"><Edit2 size={13} /></button>
                    <button onClick={() => deleteCategory(cat)} disabled={deletingId === cat.id} title="Delete"
                      className="p-1.5 rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors disabled:opacity-40">
                      {deletingId === cat.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                  {isSelected && <ChevronRight size={13} className="text-accent-red flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Subcategories */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <Layers size={14} className={selectedCat ? 'text-accent-red' : 'text-text-muted'} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary">
                {selectedCat ? `${selectedCat.name} — Subcategories` : 'Subcategories'}
              </p>
              <p className="text-[11px] text-text-muted">
                {selectedCat ? `${subcategories.length} subcategor${subcategories.length !== 1 ? 'ies' : 'y'} · click a row to manage its attributes` : 'Select a category'}
              </p>
            </div>
            {selectedCat && (
              <button onClick={() => setSubModal({ open: true, item: null })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 hover:bg-accent-red/20 text-accent-red border border-accent-red/25 text-xs font-bold rounded-lg transition-colors">
                <Plus size={12} /> Add Subcategory
              </button>
            )}
          </div>

          {!selectedCat ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-bg-primary border border-border flex items-center justify-center mb-4">
                <FolderOpen size={22} className="text-text-muted opacity-40" />
              </div>
              <p className="text-sm font-bold text-text-muted mb-1">No category selected</p>
              <p className="text-xs text-text-muted opacity-60">Click a category on the left to manage its subcategories and attributes</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <input value={subSearch} onChange={e => setSubSearch(e.target.value)} placeholder="Search subcategories…"
                    className="w-full bg-bg-primary border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-red transition-colors" />
                </div>
              </div>

              {loadingSubs ? (
                <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-accent-red" /></div>
              ) : filteredSubs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-12 h-12 rounded-xl bg-bg-primary border border-border flex items-center justify-center mb-3">
                    <Layers size={18} className="text-text-muted opacity-40" />
                  </div>
                  <p className="text-sm font-bold text-text-muted mb-1">No subcategories yet</p>
                  <p className="text-xs text-text-muted opacity-60 mb-4">Add subcategories to help sellers organize their products</p>
                  <button onClick={() => setSubModal({ open: true, item: null })}
                    className="flex items-center gap-2 px-4 py-2 bg-accent-red hover:bg-accent-red/90 text-white text-xs font-bold rounded-xl transition-colors">
                    <Plus size={12} /> Add First Subcategory
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        {['Subcategory', 'Slug', 'Products', 'Attributes', 'Status', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted bg-bg-primary">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredSubs.map(sub => (
                        <tr key={sub.id}
                          onClick={() => setManagingSub(sub)}
                          className="hover:bg-bg-hover/50 transition-colors cursor-pointer"
                          title="Click to manage attributes">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-bg-primary border border-border flex items-center justify-center text-sm flex-shrink-0">
                                {sub.icon || <Layers size={12} className="text-text-muted" />}
                              </div>
                              <div>
                                <p className="font-semibold text-text-primary text-xs">{sub.name}</p>
                                {sub.name_ar && <p className="text-[10px] text-text-muted" style={{ direction: 'rtl' }}>{sub.name_ar}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-[10px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border">{sub.slug}</code>
                          </td>
                          <td className="px-4 py-3 font-semibold text-text-primary">{sub.products_count ?? 0}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={e => { e.stopPropagation(); setManagingSub(sub) }}
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-primary border border-border rounded-lg text-[10px] font-bold text-text-secondary hover:border-accent-red hover:text-accent-red transition-colors"
                            >
                              <Settings size={10} /> Manage
                            </button>
                          </td>
                          <td className="px-4 py-3"><ActiveBadge active={sub.is_active} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <button onClick={() => setSubModal({ open: true, item: sub })} title="Edit"
                                className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"><Edit2 size={13} /></button>
                              <button onClick={() => deleteSubcategory(sub)} disabled={deletingId === sub.id} title="Delete"
                                className="p-1.5 rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors disabled:opacity-40">
                                {deletingId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {catModal.open && (
        <CategoryFormModal initial={catModal.item}
          onClose={() => setCatModal({ open: false, item: null })}
          onSaved={loadCategories} />
      )}
      {subModal.open && selectedCat && (
        <SubcategoryFormModal initial={subModal.item} categories={categories}
          defaultCategoryId={selectedCat.id}
          onClose={() => setSubModal({ open: false, item: null })}
          onSaved={() => loadSubcategories(selectedCat.id)} />
      )}

      {/* ── Attribute Manager Drawer ── */}
      {managingSub && (
        <AttributeManager
          subcategory={managingSub}
          onClose={() => setManagingSub(null)}
        />
      )}
    </div>
  )
}