'use client'

/**
 * Admin > Users "Create seller application": the storefront seller application
 * (choosetounsi-frontend/app/become-a-vendor/_components/ApplicationForm.tsx)
 * filled in on a user's behalf. Same 3 steps, fields, order and messages.
 * Admin differences: profile picture and samples are optional (the seller adds
 * them later; no picture = the default avatar), and "Approve immediately".
 */

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle, Upload, X } from 'lucide-react'
import api from '@/lib/axios'
import { API_URL } from '@/lib/sellerPickupApi'
import PickupAddressFields from '@/components/pickup/PickupAddressFields'
import {
  emptyPickupAddress, pickupErrorsFromApi, pickupPayload, validatePickupAddress, validateTunisianPhone,
  PICKUP_MESSAGES, type PickupAddressValue, type PickupErrors,
} from '@/lib/pickupAddress'

const FALLBACK_CATEGORIES = [
  'Fashion & Clothing', 'Electronics & Tech', 'Home & Living', 'Food & Grocery',
  'Beauty & Personal Care', 'Health & Wellness', 'Sports & Outdoors',
  'Arts & Crafts', 'Books & Stationery', 'Kids & Baby', 'Automotive', 'Other',
]

/** Same wording as the storefront (vendor.errors.*). */
const MSG = {
  fullName:     'Full name is required.',
  phone:        'Phone number is required.',
  businessName: 'Business name is required.',
  category:     'Please select at least one category.',
  maxSamples:   'Maximum 5 sample images allowed.',
}

// `name` = original (English) name stored on the application, `label` = shown name
interface Category { id: number; name: string; label: string; slug: string }
type LocalizedRow = { name: string; base_name?: string }
const withBaseName = <T extends LocalizedRow>(rows: T[]) => rows.map(r => ({ ...r, name: r.base_name ?? r.name, label: r.name }))

interface Sample { file: File; preview: string; caption: string }

export interface ApplicantUser { id: number; name: string; email: string; phone?: string | null }

type Step = 1 | 2 | 3
const STEP_LABEL: Record<Step, string> = { 1: 'Business info', 2: 'Location', 3: 'Media & description' }

export default function SellerApplicationForm({ user, onDone, onCancel }: {
  user: ApplicantUser
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const [step,    setStep]    = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [errors,  setErrors]  = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    full_name: user.name ?? '', phone_number: user.phone ?? '', business_name: '',
    facebook_url: '', instagram_url: '', website_url: '',
    pricing_range: '' as '' | 'budget' | 'mid' | 'premium', business_description: '',
  })
  const [pickup,       setPickup]       = useState<PickupAddressValue>(emptyPickupAddress)
  const [pickupErrors, setPickupErrors] = useState<PickupErrors>({})
  const [approve,      setApprove]      = useState(true)

  const [profilePic,        setProfilePic]        = useState<File | null>(null)
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null)
  const [samples,           setSamples]           = useState<Sample[]>([])
  const profileRef = useRef<HTMLInputElement>(null)
  const samplesRef = useRef<HTMLInputElement>(null)

  const [categories,     setCategories]     = useState<Category[]>([])
  const [catsLoading,    setCatsLoading]    = useState(false)
  const [selectedCats,   setSelectedCats]   = useState<string[]>([])
  const [subsMap,        setSubsMap]        = useState<Record<string, Category[]>>({})
  const [subsLoading,    setSubsLoading]    = useState(false)
  const [selectedSubs,   setSelectedSubs]   = useState<string[]>([])

  // ── Categories / subcategories (public API, as on the storefront) ───────
  useEffect(() => {
    setCatsLoading(true)
    fetch(`${API_URL}/categories`, { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(json => setCategories(withBaseName(json?.data ?? [])))
      .catch(() => {})
      .finally(() => setCatsLoading(false))
  }, [])

  useEffect(() => {
    const toFetch = selectedCats.filter(c => categories.some(a => a.name === c) && !subsMap[c])
    if (!toFetch.length) return
    setSubsLoading(true)
    Promise.all(toFetch.map(catName => {
      const cat = categories.find(c => c.name === catName)!
      return fetch(`${API_URL}/categories/${cat.slug}/subcategories`, { headers: { Accept: 'application/json' } })
        .then(r => r.json())
        .then(json => ({ catName, subs: withBaseName(json?.data ?? []) as Category[] }))
        .catch(() => ({ catName, subs: [] as Category[] }))
    })).then(results => setSubsMap(prev => {
      const next = { ...prev }
      results.forEach(({ catName, subs }) => { next[catName] = subs })
      return next
    })).finally(() => setSubsLoading(false))
  }, [selectedCats, categories]) // eslint-disable-line react-hooks/exhaustive-deps

  // Previews are object URLs: free them when the modal closes
  useEffect(() => () => {
    if (profilePicPreview) URL.revokeObjectURL(profilePicPreview)
    samples.forEach(s => URL.revokeObjectURL(s.preview))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const catLabel = (name: string) => categories.find(c => c.name === name)?.label ?? name

  const toggleCat = (name: string) => {
    setSelectedCats(prev => {
      if (prev.includes(name)) {
        const subs = subsMap[name]?.map(s => s.name) ?? []
        setSelectedSubs(ps => ps.filter(s => !subs.includes(s)))
        return prev.filter(c => c !== name)
      }
      return prev.length >= 5 ? prev : [...prev, name]
    })
    setErrors(prev => { const n = { ...prev }; delete n.business_category; return n })
  }
  const toggleSub = (name: string) => setSelectedSubs(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name])

  const change = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const onProfilePic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (profilePicPreview) URL.revokeObjectURL(profilePicPreview)
    setProfilePic(file)
    setProfilePicPreview(URL.createObjectURL(file))
  }
  const onSamples = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (samples.length + incoming.length > 5) { setError(MSG.maxSamples); return }
    setSamples(prev => [...prev, ...incoming.map(file => ({ file, preview: URL.createObjectURL(file), caption: '' }))])
    setError(null)
  }
  const removeSample = (i: number) => setSamples(prev => {
    URL.revokeObjectURL(prev[i].preview)
    return prev.filter((_, j) => j !== i)
  })

  // ── Validation (same rules as the storefront; images optional here) ─────
  const stepErrors = (s: Step): { errs: Record<string, string>; pe: PickupErrors } => {
    const errs: Record<string, string> = {}
    let pe: PickupErrors = {}
    if (s === 1) {
      if (!form.full_name.trim())     errs.full_name = MSG.fullName
      if (!form.phone_number.trim())  errs.phone_number = MSG.phone
      else if (!validateTunisianPhone(form.phone_number).valid) errs.phone_number = PICKUP_MESSAGES.phone
      if (!form.business_name.trim()) errs.business_name = MSG.businessName
      if (!selectedCats.length)       errs.business_category = MSG.category
    }
    if (s === 2) pe = validatePickupAddress(pickup)
    return { errs, pe }
  }

  const validateStep = (s: Step): boolean => {
    const { errs, pe } = stepErrors(s)
    setErrors(errs)
    setPickupErrors(pe)
    return !Object.keys(errs).length && !Object.keys(pe).length
  }

  const next = () => {
    if (!validateStep(step)) return
    if (step === 1) {
      // The courier's contact defaults to the applicant
      setPickup(p => ({ ...p, contact_name: p.contact_name || form.full_name, phone: p.phone || form.phone_number }))
    }
    setStep(s => (s < 3 ? (s + 1) as Step : s))
  }
  const prev = () => setStep(s => (s > 1 ? (s - 1) as Step : s))

  const changePickup = (v: PickupAddressValue) => {
    setPickup(v)
    // Clear the messages of the fields now valid
    setPickupErrors(prev => {
      const now = validatePickupAddress(v)
      const out: PickupErrors = {}
      for (const k of Object.keys(prev) as (keyof PickupErrors)[]) if (now[k]) out[k] = prev[k]
      return out
    })
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  const submit = async () => {
    // Every step again: zone + pin missing must show before anything is sent
    for (const s of [1, 2] as Step[]) {
      if (!validateStep(s)) { setStep(s); setError(s === 2 ? 'The pickup address is incomplete: the zone and the map pin are required.' : null); return }
    }
    setLoading(true); setError(null); setErrors({})
    try {
      const fd = new FormData()
      ;(['full_name', 'phone_number', 'business_name', 'facebook_url', 'instagram_url', 'website_url', 'pricing_range', 'business_description'] as const)
        .forEach(k => { if (form[k]) fd.append(k, form[k]) })
      Object.entries(pickupPayload(pickup)).forEach(([k, v]) => { if (v !== null && v !== '') fd.append(k, String(v)) })
      fd.append('business_category', selectedCats[0] ?? '')
      selectedCats.forEach((c, i) => fd.append(`business_categories[${i}]`, c))
      selectedSubs.forEach((s, i) => fd.append(`business_subcategories[${i}]`, s))
      fd.append('preferred_plan', 'green')
      if (profilePic) fd.append('profile_picture', profilePic)
      samples.forEach(s => fd.append('sample_images[]', s.file))
      samples.forEach((s, i) => { if (s.caption.trim()) fd.append(`sample_captions[${i}]`, s.caption.trim()) })
      fd.append('approve_immediately', approve ? '1' : '0')

      const res = await api.post(`/admin/users/${user.id}/seller-application`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      onDone(res.data?.message ?? 'Seller application created.')
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const be = e?.response?.data?.errors ?? {}
      setError(e?.response?.data?.message ?? 'Something went wrong. Please try again.')
      const mapped: Record<string, string> = {}
      Object.entries(be).forEach(([k, v]) => { mapped[k.replace(/\.\d+$/, '')] = Array.isArray(v) ? v[0] : String(v) })
      setErrors(mapped)
      const pe = pickupErrorsFromApi(be)
      setPickupErrors(pe)
      // Go to the step holding the first error
      const step1 = ['full_name', 'phone_number', 'business_name', 'business_category', 'business_categories', 'pricing_range']
      if (Object.keys(mapped).some(k => step1.includes(k))) setStep(1)
      else if (Object.keys(pe).length) setStep(2)
      else if (Object.keys(mapped).length) setStep(3)
    } finally {
      setLoading(false)
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  const input = (err?: string) =>
    `w-full bg-bg-primary border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple ${err ? 'border-accent-red' : 'border-border'}`
  const lbl = 'block text-sm font-semibold text-text-secondary mb-1.5'
  const opt = <span className="ml-1.5 text-xs font-normal text-text-muted">(optional)</span>
  const FieldError = ({ k }: { k: string }) =>
    errors[k] ? <p className="text-xs text-accent-red mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{errors[k]}</p> : null

  const availableSubs = selectedCats.flatMap(c => subsMap[c] ?? [])

  return (
    <div className="flex flex-col gap-5">
      {/* Applicant */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 rounded-lg bg-bg-primary border border-border text-sm">
        <span className="text-text-muted">Applicant:</span>
        <b className="text-text-primary">{user.name}</b>
        <span className="text-text-secondary break-all">{user.email}</span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {([1, 2, 3] as Step[]).map(s => (
          <div key={s} className="flex items-center gap-2.5">
            <button type="button" onClick={() => { if (s < step) setStep(s) }}
              className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${
                step === s ? 'bg-accent-purple text-white' : step > s ? 'bg-accent-green text-white cursor-pointer' : 'bg-bg-hover text-text-muted cursor-default'}`}>
              {step > s ? <Check size={14} /> : s}
            </button>
            {s < 3 && <div className={`h-0.5 w-8 rounded ${step > s ? 'bg-accent-green' : 'bg-border'}`} />}
          </div>
        ))}
        <span className="ml-1 text-xs font-semibold text-text-muted">{STEP_LABEL[step]}</span>
      </div>

      {/* ══ STEP 1 ══ */}
      {step === 1 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl} htmlFor="adm-full_name">Full name</label>
              <input id="adm-full_name" placeholder="Your full name" value={form.full_name} onChange={change('full_name')} className={input(errors.full_name)} />
              <FieldError k="full_name" />
            </div>
            <div>
              <label className={lbl} htmlFor="adm-phone_number">Phone number</label>
              <input id="adm-phone_number" type="tel" dir="ltr" placeholder="+216 XX XXX XXX" value={form.phone_number} onChange={change('phone_number')} className={input(errors.phone_number)} />
              <FieldError k="phone_number" />
            </div>
          </div>

          <div>
            <label className={lbl} htmlFor="adm-business_name">Business name</label>
            <input id="adm-business_name" placeholder="Your shop or brand name" value={form.business_name} onChange={change('business_name')} className={input(errors.business_name)} />
            <FieldError k="business_name" />
          </div>

          <div>
            <label className={lbl}>Business categories <span className="text-xs font-normal text-text-muted">(select up to 5)</span></label>
            {catsLoading ? (
              <p className="text-xs text-text-muted">Loading categories…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                {(categories.length ? categories.map(c => c.name) : FALLBACK_CATEGORIES).map(name => {
                  const on = selectedCats.includes(name)
                  return (
                    <button key={name} type="button" onClick={() => toggleCat(name)} aria-pressed={on}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors border ${
                        on ? 'border-accent-purple bg-accent-purple/15 text-text-primary font-bold' : 'border-border bg-bg-primary text-text-secondary hover:border-border-light'}`}>
                      {on && <span className="w-3.5 h-3.5 rounded-full bg-accent-purple flex items-center justify-center shrink-0"><Check size={9} className="text-white" /></span>}
                      {catLabel(name)}
                    </button>
                  )
                })}
              </div>
            )}
            {selectedCats.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedCats.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent-purple/15 text-accent-purple-light border border-accent-purple/30">
                    {catLabel(c)}
                    <button type="button" onClick={() => toggleCat(c)} aria-label={`Remove ${catLabel(c)}`}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            <FieldError k="business_category" />

            {selectedCats.length > 0 && (
              <div className="mt-3 p-3.5 rounded-lg bg-bg-primary border border-border">
                <p className="text-xs font-bold text-text-secondary mb-2.5">
                  Subcategories <span className="font-normal text-text-muted">(optional — select all that apply)</span>
                </p>
                {subsLoading && <p className="text-xs text-text-muted">Loading subcategories…</p>}
                {!subsLoading && availableSubs.length === 0 && <p className="text-xs text-text-muted">No subcategories available for the selected categories.</p>}
                {!subsLoading && selectedCats.map(catName => {
                  const subs = subsMap[catName] ?? []
                  if (!subs.length) return null
                  return (
                    <div key={catName} className="mb-3 last:mb-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-accent-purple-light mb-2">{catLabel(catName)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {subs.map(sub => {
                          const on = selectedSubs.includes(sub.name)
                          return (
                            <button key={sub.id} type="button" onClick={() => toggleSub(sub.name)} aria-pressed={on}
                              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                on ? 'border-accent-purple bg-accent-purple/20 text-text-primary font-semibold' : 'border-border text-text-secondary hover:border-border-light'}`}>
                              {on && <Check size={10} className="inline mr-1" />}{sub.label ?? sub.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {selectedSubs.length > 0 && (
                  <p className="text-xs font-semibold text-accent-green mt-2">
                    ✓ {selectedSubs.length} {selectedSubs.length === 1 ? 'subcategory' : 'subcategories'} selected
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={lbl}>Pricing range {opt}</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'budget',  label: 'Budget',    desc: 'Affordable prices', emoji: '💚' },
                { value: 'mid',     label: 'Mid-range', desc: 'Quality & value',   emoji: '💛' },
                { value: 'premium', label: 'Premium',   desc: 'High-end products', emoji: '🖤' },
              ] as const).map(o => {
                const on = form.pricing_range === o.value
                return (
                  <button key={o.value} type="button" aria-pressed={on}
                    onClick={() => setForm(p => ({ ...p, pricing_range: p.pricing_range === o.value ? '' : o.value }))}
                    className={`px-2 py-3 rounded-lg text-center border transition-colors ${on ? 'border-accent-purple bg-accent-purple/15' : 'border-border bg-bg-primary hover:border-border-light'}`}>
                    <div className="text-lg mb-1">{o.emoji}</div>
                    <div className={`text-xs font-bold ${on ? 'text-text-primary' : 'text-text-secondary'}`}>{o.label}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{o.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ══ STEP 2 ══ */}
      {step === 2 && (
        <>
          <p className="text-xs text-text-muted">
            Where the Intigo courier collects the parcels. The zone and the map pin are required to approve the seller.
            The address stays “Non vérifiée” until you check it, as for any application.
          </p>
          <PickupAddressFields value={pickup} onChange={changePickup} errors={pickupErrors} disabled={loading} />
        </>
      )}

      {/* ══ STEP 3 ══ */}
      {step === 3 && (
        <>
          <div>
            <label className={lbl}>Profile picture {opt}</label>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => profileRef.current?.click()} aria-label="Upload photo"
                className="w-[72px] h-[72px] rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-bg-primary shrink-0">
                {profilePicPreview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={profilePicPreview} alt="Profile picture" className="w-full h-full object-cover" />
                  : <Upload size={20} className="text-text-muted" />}
              </button>
              <div>
                <button type="button" onClick={() => profileRef.current?.click()} className="text-sm font-bold text-accent-purple-light">
                  {profilePicPreview ? 'Change photo' : 'Upload photo'}
                </button>
                {profilePic && (
                  <button type="button" onClick={() => { if (profilePicPreview) URL.revokeObjectURL(profilePicPreview); setProfilePic(null); setProfilePicPreview(null) }}
                    className="ml-3 text-xs text-text-muted hover:text-accent-red">Remove</button>
                )}
                <p className="text-xs text-text-muted mt-0.5">JPG, PNG or WebP · max 4MB. None: the default avatar is shown until the seller adds one.</p>
              </div>
            </div>
            <FieldError k="profile_picture" />
            <input ref={profileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onProfilePic} />
          </div>

          <div>
            <label className={lbl}>Product samples <span className="text-xs font-normal text-text-muted">(optional, up to 5)</span></label>
            <p className="text-xs text-text-muted mb-3">The seller can add them later from the seller dashboard.</p>
            {samples.length > 0 && (
              <div className="flex flex-col gap-2.5 mb-3">
                {samples.map((s, i) => (
                  <div key={s.preview} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-bg-primary border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.preview} alt={`Sample ${i + 1}`} className="w-14 h-14 rounded-md object-cover shrink-0 border border-border" />
                    <input placeholder={`Caption for image ${i + 1}`} aria-label={`Caption for image ${i + 1}`} maxLength={200} value={s.caption}
                      onChange={e => setSamples(prev => prev.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))}
                      className={`${input()} flex-1 min-w-0 text-xs`} />
                    <button type="button" onClick={() => removeSample(i)} aria-label="Remove image"
                      className="w-7 h-7 rounded-md border border-accent-red/40 bg-accent-red/10 flex items-center justify-center shrink-0">
                      <X size={12} className="text-accent-red" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {samples.length < 5 && (
              <button type="button" onClick={() => samplesRef.current?.click()}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border-2 border-dashed border-border bg-bg-primary text-xs text-text-muted hover:border-border-light">
                <Upload size={16} />
                {samples.length === 0 ? 'Upload product images' : `Add more (${5 - samples.length} remaining)`}
              </button>
            )}
            <FieldError k="sample_images" />
            <input ref={samplesRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onSamples} />
          </div>

          <div>
            <label className={lbl} htmlFor="adm-business_description">Business description {opt}</label>
            <textarea id="adm-business_description" rows={4} maxLength={2000}
              placeholder="Tell us about the business, what it sells, and its story…"
              value={form.business_description} onChange={change('business_description')} className={`${input(errors.business_description)} resize-none`} />
            <p className={`text-[11px] text-right ${form.business_description.length >= 50 ? 'text-accent-green' : 'text-text-muted'}`}>
              {form.business_description.length} / 2000{form.business_description.length >= 50 && ' ✓'}
            </p>
            <FieldError k="business_description" />
          </div>

          <div>
            <p className={lbl}>Social media {opt}</p>
            <div className="flex flex-col gap-3">
              {([
                ['facebook_url',  'Facebook URL',  'https://facebook.com/yourbusiness'],
                ['instagram_url', 'Instagram URL', 'https://instagram.com/yourbusiness'],
                ['website_url',   'Website URL',   'https://yourbusiness.tn'],
              ] as const).map(([k, label, ph]) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-text-muted mb-1" htmlFor={`adm-${k}`}>{label}</label>
                  <input id={`adm-${k}`} type="url" dir="ltr" placeholder={ph} value={form[k]} onChange={change(k)} className={input(errors[k])} />
                  <FieldError k={k} />
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 p-3.5 rounded-lg border border-accent-green/40 bg-accent-green/10 cursor-pointer">
            <input type="checkbox" checked={approve} onChange={e => setApprove(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-500" />
            <span>
              <span className="block text-sm font-bold text-text-primary">Approve immediately</span>
              <span className="block text-xs text-text-secondary mt-0.5">
                {approve
                  ? 'The user becomes a seller now (Green Pepper plan) and gets the “application approved” e-mail. No logout needed.'
                  : 'The application is created as pending and appears in Applications for review.'}
              </span>
            </span>
          </label>
        </>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 px-4 py-3 rounded-lg bg-accent-red/10 border border-accent-red/40">
          <AlertCircle size={15} className="text-accent-red shrink-0" />
          <p className="text-xs text-accent-red">{error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-border flex-wrap">
        <span className="text-xs text-text-muted">Step {step} of 3</span>
        <div className="flex gap-2.5">
          {step === 1
            ? <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text-secondary hover:text-text-primary">Cancel</button>
            : <button type="button" onClick={prev} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text-secondary hover:text-text-primary">← Back</button>}
          {step < 3 ? (
            <button type="button" onClick={next} className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-accent-purple hover:bg-accent-purple/90">Continue →</button>
          ) : (
            <button type="button" onClick={submit} disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold text-white bg-accent-green hover:bg-accent-green/90 disabled:opacity-60">
              <CheckCircle size={15} />
              {loading ? 'Submitting…' : approve ? 'Submit & approve' : 'Submit application'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
