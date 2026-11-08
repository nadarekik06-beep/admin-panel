'use client'

/**
 * Admin > Users "Create seller application": the storefront seller application
 * (choosetounsi-frontend/app/become-a-vendor/_components/ApplicationForm.tsx)
 * filled in on a user's behalf. Same 3 steps, fields, order and messages.
 * Admin differences: profile picture and samples are optional (the seller adds
 * them later; no picture = the default avatar), and "Approve immediately".
 * Same guidance as the storefront: fields checked on blur with the backend's rules
 * (lib/sellerApplication/normalize), handles turned into links, photos made lighter,
 * the draft kept in this browser until it is sent.
 */

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle, Upload, X } from 'lucide-react'
import {
  checkBusinessName, checkCategories, checkDescription, checkFullName, checkLink, checkPhone,
  formatPhone, normalizePhone, LIMITS, type Issue,
} from '@/lib/sellerApplication/normalize'
import { prepareImage, type PreparedImage } from '@/lib/sellerApplication/prepareImage'
import api from '@/lib/axios'
import { API_URL } from '@/lib/sellerPickupApi'
import PickupAddressFields from '@/components/pickup/PickupAddressFields'
import {
  emptyPickupAddress, pickupErrorsFromApi, pickupPayload, validatePickupAddress,
  type PickupAddressValue, type PickupErrors,
} from '@/lib/pickupAddress'

const FALLBACK_CATEGORIES = [
  'Fashion & Clothing', 'Electronics & Tech', 'Home & Living', 'Food & Grocery',
  'Beauty & Personal Care', 'Health & Wellness', 'Sports & Outdoors',
  'Arts & Crafts', 'Books & Stationery', 'Kids & Baby', 'Automotive', 'Other',
]

/** Same guidance as the storefront (vendor.guide.*, English). */
const GUIDE: Record<string, (v: Record<string, string | number>) => string> = {
  fullNameRequired:     () => "Write the applicant's full name: it's who we'll contact.",
  fullNameMax:          () => 'The name is a bit long: 255 characters maximum.',
  businessNameRequired: () => "Give the shop or brand name: it's what buyers will see.",
  businessNameMax:      () => 'The shop name is a bit long: 255 characters maximum.',
  phoneRequired:        () => '8 digits, without +216 (e.g. 22 123 456).',
  phoneLetters:         () => 'Digits only: 8 digits, without +216 (e.g. 22 123 456).',
  phoneDigits:          v => `${v.left} more digit${v.left === 1 ? '' : 's'}: 8 are needed, without +216 (e.g. 22 123 456).`,
  phoneTooMany:         () => "There's one digit too many: keep the 8 digits of the number, without +216.",
  phonePrefix:          () => 'Tunisian numbers start with 2, 4, 5 or 9: check the first digit.',
  categoryRequired:     () => 'Pick at least one category: it helps buyers find the shop.',
  categoriesMax:        () => 'Up to 5 categories.',
  descriptionShort:     v => `${v.left} more characters: describe what the shop sells, it reassures buyers.`,
  descriptionMax:       v => `The description is a bit long: remove ${v.extra} characters (2000 maximum).`,
  instagramHelp:        () => "Paste the page link, e.g. https://instagram.com/yourshop — or just the username, we'll handle the rest.",
  facebookHelp:         () => "Paste the page link, e.g. https://facebook.com/yourshop — or just its name, we'll handle the rest.",
  websiteHelp:          () => "Write the website address, e.g. yourshop.tn — https:// is added automatically.",
  linkTooLong:          () => 'This link is too long (255 characters maximum): keep just the page address.',
}
const guideText = (i: Issue | null) => (i ? (GUIDE[i.code]?.(i.values ?? {}) ?? i.code) : null)

type PhotoNote = { kind: 'reduced' | 'converted' | 'unreadable' } | { kind: 'kept'; count: number }
const PHOTO_NOTE = {
  reduced:    'This photo was heavy: it has been made lighter automatically ✓',
  converted:  'iPhone photo converted automatically ✓',
  unreadable: "This photo couldn't be opened: choose another one (JPG, PNG or WebP).",
}

const STEP_FIELDS: Record<1 | 2 | 3, string[]> = {
  1: ['full_name', 'phone_number', 'business_name', 'business_category', 'pricing_range'],
  2: ['pk:adresse_complete', 'pk:zone', 'pk:pin', 'pk:contact_name', 'pk:phone', 'pk:code_postal', 'pk:indications'],
  3: ['profile_picture', 'sample_images', 'business_description', 'facebook_url', 'instagram_url', 'website_url'],
}
const PICKUP_ORDER: (keyof PickupErrors)[] = ['adresse_complete', 'zone', 'pin', 'contact_name', 'phone', 'code_postal', 'indications']
const PICKUP_SERVER_KEYS = ['adresse_complete', 'intigo_zone_id', 'latitude', 'longitude', 'contact_name', 'phone', 'code_postal', 'indications']

/** Laravel field names → ours ("sample_images.2" → "sample_images"). */
function fieldOfServerKey(key: string): string {
  const base = key.replace(/\.\d+$/, '')
  if (base === 'business_categories' || base === 'business_subcategories') return 'business_category'
  if (base === 'sample_captions') return 'sample_images'
  return base
}

const draftKey = (userId: number) => `ct_admin_seller_application_${userId}`

// `name` = original (English) name stored on the application, `label` = shown name
interface Category { id: number; name: string; label: string; slug: string }
type LocalizedRow = { name: string; base_name?: string }
const withBaseName = <T extends LocalizedRow>(rows: T[]) => rows.map(r => ({ ...r, name: r.base_name ?? r.name, label: r.name }))

interface Sample { file: File; preview: string; caption: string }

export interface ApplicantUser { id: number; name: string; email: string; phone?: string | null }

type Step = 1 | 2 | 3
type FormKey = 'full_name' | 'phone_number' | 'business_name' | 'facebook_url' | 'instagram_url' | 'website_url' | 'pricing_range' | 'business_description'
const LINK_KIND = { facebook_url: 'facebook', instagram_url: 'instagram', website_url: 'website' } as const
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

  const [touched,    setTouched]    = useState<Record<string, boolean>>({})
  const [photoNotes, setPhotoNotes] = useState<{ profile_picture?: PhotoNote; sample_images?: PhotoNote }>({})
  const [photosBusy, setPhotosBusy] = useState(0)
  // A new object each time: asking twice for the same field scrolls again
  const [guideTarget, setGuideTarget] = useState<{ key: string } | null>(null)

  // ── Draft: kept in this browser (per applicant) until the application is sent ──
  const draftReady = useRef(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(user.id))
      const d = raw ? JSON.parse(raw) : null
      if (d && Date.now() - (d.savedAt ?? 0) < 7 * 24 * 3600 * 1000) {
        if (d.form) setForm(prev => ({ ...prev, ...d.form }))
        if (d.pickup) setPickup({ ...emptyPickupAddress(), ...d.pickup })
        if (Array.isArray(d.cats)) setSelectedCats(d.cats.slice(0, 5))
        if (Array.isArray(d.subs)) setSelectedSubs(d.subs)
        if (d.step === 2 || d.step === 3) setStep(d.step)
      }
    } catch { /* no saved draft */ }
    draftReady.current = true
  }, [user.id])
  useEffect(() => {
    if (!draftReady.current) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(user.id), JSON.stringify({ savedAt: Date.now(), step, form, pickup, cats: selectedCats, subs: selectedSubs }))
      } catch { /* storage full or blocked: the form still works */ }
    }, 400)
    return () => clearTimeout(timer)
  }, [user.id, step, form, pickup, selectedCats, selectedSubs])

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
      return prev.length >= LIMITS.categories ? prev : [...prev, name]
    })
    setTouched(prev => ({ ...prev, business_category: true }))
    setErrors(prev => { const n = { ...prev }; delete n.business_category; return n })
  }
  const toggleSub = (name: string) => setSelectedSubs(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name])

  const change = (key: FormKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    setError(null)
  }

  /** Leaving a field: check it (hint or ✓) and tidy what was typed. */
  const blur = (key: FormKey) => () => {
    setTouched(prev => (prev[key] ? prev : { ...prev, [key]: true }))
    setForm(prev => {
      const v = prev[key]
      const tidy = key === 'phone_number' && !checkPhone(v) ? normalizePhone(v) : v.trim()
      return tidy === v ? prev : { ...prev, [key]: tidy }
    })
  }

  const noteFor = (r: PreparedImage): PhotoNote | undefined =>
    r.converted ? { kind: 'converted' } : r.reduced ? { kind: 'reduced' } : undefined

  const onProfilePic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotosBusy(n => n + 1)
    try {
      const r = await prepareImage(file)
      if (profilePicPreview) URL.revokeObjectURL(profilePicPreview)
      setProfilePic(r.file)
      setProfilePicPreview(URL.createObjectURL(r.file))
      setPhotoNotes(p => ({ ...p, profile_picture: noteFor(r) }))
      setErrors(prev => { const n = { ...prev }; delete n.profile_picture; return n })
    } catch (err) {
      console.error('[seller application] profile picture could not be read', err)
      setPhotoNotes(p => ({ ...p, profile_picture: { kind: 'unreadable' } }))
    } finally {
      setPhotosBusy(n => n - 1)
    }
  }
  const onSamples = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!picked.length) return
    const room = Math.max(0, LIMITS.samples - samples.length)
    setPhotosBusy(n => n + 1)
    try {
      const results = await Promise.all(picked.slice(0, room).map(f => prepareImage(f).catch(err => {
        console.error('[seller application] product photo could not be read', err)
        return null
      })))
      const ready = results.filter((r): r is PreparedImage => r !== null)
      setSamples(prev => [...prev, ...ready.map(r => ({ file: r.file, preview: URL.createObjectURL(r.file), caption: '' }))].slice(0, LIMITS.samples))
      const note: PhotoNote | undefined =
        ready.length < results.length ? { kind: 'unreadable' }
        : picked.length > room ? { kind: 'kept', count: room }
        : ready.some(r => r.converted) ? { kind: 'converted' }
        : ready.some(r => r.reduced) ? { kind: 'reduced' }
        : undefined
      setPhotoNotes(p => ({ ...p, sample_images: note }))
      setErrors(prev => { const n = { ...prev }; delete n.sample_images; return n })
    } finally {
      setPhotosBusy(n => n - 1)
    }
  }
  const removeSample = (i: number) => setSamples(prev => {
    URL.revokeObjectURL(prev[i].preview)
    return prev.filter((_, j) => j !== i)
  })

  // ── Guidance (same rules as the backend and the storefront; images optional here) ──
  const linkCheck = (k: keyof typeof LINK_KIND) => checkLink(LINK_KIND[k], form[k])

  const issueOf = (key: string): Issue | null => {
    switch (key) {
      case 'full_name':            return checkFullName(form.full_name)
      case 'phone_number':         return checkPhone(form.phone_number)
      case 'business_name':        return checkBusinessName(form.business_name)
      case 'business_category':    return checkCategories(selectedCats)
      case 'business_description': return checkDescription(form.business_description)
      case 'facebook_url':
      case 'instagram_url':
      case 'website_url':          return linkCheck(key).issue
      default:                     return null
    }
  }
  /** The server's message first, then ours once the field was left. */
  const hintOf = (key: string): string | null => errors[key] ?? (touched[key] ? guideText(issueOf(key)) : null)
  const okOf = (key: string, filled: boolean) => !!touched[key] && filled && !errors[key] && !issueOf(key)

  const blockingFields = (s: Step): string[] => {
    if (s === 2) {
      const pe = { ...pickupErrors, ...validatePickupAddress(pickup) }
      return PICKUP_ORDER.filter(k => pe[k]).map(k => `pk:${k}`)
    }
    return STEP_FIELDS[s].filter(k => errors[k] || issueOf(k)?.blocking)
  }

  /** Something missing: go to the first field to fix and highlight it (never a silent refusal). */
  const validateStep = (s: Step): boolean => {
    setTouched(prev => { const n = { ...prev }; STEP_FIELDS[s].forEach(k => { n[k] = true }); return n })
    if (s === 2) setPickupErrors(prev => ({ ...prev, ...validatePickupAddress(pickup) }))
    const blocking = blockingFields(s)
    if (blocking.length) { setGuideTarget({ key: blocking[0] }); return false }
    return true
  }

  useEffect(() => {
    if (!guideTarget) return
    const target = guideTarget.key
    // A timer, not requestAnimationFrame: it also runs while the tab is in the background
    const timer = setTimeout(() => {
      setGuideTarget(null)
      const domId = target.startsWith('pk:')
        ? null
        : `adm-${target}`
      const el = domId
        ? document.getElementById(domId)
        : document.querySelector<HTMLElement>('[data-pickup-fields] [aria-invalid="true"], [data-pickup-fields] .text-accent-red')
      if (!el) return
      el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true })
      el.classList.add('ring-2', 'ring-amber-400', 'rounded-lg')
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 2200)
    }, 30)
    return () => clearTimeout(timer)
  }, [guideTarget, step])

  const next = () => {
    if (!validateStep(step)) return
    if (step === 1) {
      // The courier's contact defaults to the applicant
      setPickup(p => ({ ...p, contact_name: p.contact_name || form.full_name.trim(), phone: p.phone || normalizePhone(form.phone_number) }))
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
    if (photosBusy > 0) { setError('One moment: the photos are still being prepared. Click again in a few seconds.'); return }
    // Every step again: zone + pin missing must show before anything is sent
    for (const s of [1, 2, 3] as Step[]) {
      if (!validateStep(s)) { setStep(s); setError(s === 2 ? 'The pickup address is incomplete: the zone and the map pin are required.' : null); return }
    }
    setLoading(true); setError(null); setErrors({})
    try {
      const fd = new FormData()
      // Sent as the backend stores them (it normalizes the same way again)
      const values: Record<string, string> = {
        full_name:            form.full_name.trim(),
        phone_number:         normalizePhone(form.phone_number),
        business_name:        form.business_name.trim(),
        facebook_url:         linkCheck('facebook_url').value,
        instagram_url:        linkCheck('instagram_url').value,
        website_url:          linkCheck('website_url').value,
        pricing_range:        form.pricing_range,
        business_description: form.business_description.trim(),
      }
      Object.entries(values).forEach(([k, v]) => { if (v) fd.append(k, v) })
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
      try { localStorage.removeItem(draftKey(user.id)) } catch { /* nothing saved */ }
      draftReady.current = false
      onDone(res.data?.message ?? 'Seller application created.')
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[] | string> } } }
      const status = e?.response?.status
      const body = e?.response?.data
      if (!e?.response) {
        console.error('[seller application] no response from the server', err)
        setError('The connection dropped. Everything typed is kept: click Submit again.')
      } else if (status === 413) {
        setError('A photo is too large for the server. Choose another one or try again: it will be made lighter.')
      } else if (status === 422 && body?.errors && Object.keys(body.errors).length) {
        const be: Record<string, string[]> = {}
        Object.entries(body.errors).forEach(([k, v]) => { be[k] = Array.isArray(v) ? v.map(String) : [String(v)] })
        const mapped: Record<string, string> = {}
        Object.entries(be).forEach(([k, v]) => {
          if (PICKUP_SERVER_KEYS.includes(k)) return
          const f = fieldOfServerKey(k)
          if (!mapped[f]) mapped[f] = v[0]
        })
        const pe = pickupErrorsFromApi(be)
        setErrors(mapped)
        setPickupErrors(pe)
        // Go to the first field to fix, on its step
        const order = [...STEP_FIELDS[1], ...STEP_FIELDS[2], ...STEP_FIELDS[3]]
        const first = order.find(k => (k.startsWith('pk:') ? pe[k.slice(3) as keyof PickupErrors] : mapped[k]))
        if (first) {
          setStep(STEP_FIELDS[1].includes(first) ? 1 : STEP_FIELDS[2].includes(first) ? 2 : 3)
          setGuideTarget({ key: first })
          setError('One thing to fix: you have been taken to the field.')
        } else {
          setError(Object.values(mapped)[0] ?? body.message ?? 'One thing to fix.')
        }
      } else if (status && status >= 500) {
        console.error('[seller application] server error', status, body, err)
        setError('A problem on the server. Everything typed is kept: try again in a moment.')
      } else {
        setError(body?.message ?? 'Something went wrong. Everything typed is kept: try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  const input = (hint?: string | null) =>
    `w-full bg-bg-primary border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple ${hint ? 'border-amber-400' : 'border-border'}`
  const lbl = 'block text-sm font-semibold text-text-secondary mb-1.5'
  const opt = <span className="ml-1.5 text-xs font-normal text-text-muted">(optional)</span>
  /** 💡 what to fix (amber, never red) or a green confirmation. */
  const Guide = ({ hint, success }: { hint?: string | null; success?: string | null }) =>
    hint ? <p role="status" className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1.5 mt-1.5 flex gap-1.5"><span aria-hidden>💡</span><span>{hint}</span></p>
    : success ? <p className="text-xs text-accent-green mt-1.5 break-all">{success}</p>
    : null
  const FieldError = ({ k, success }: { k: string; success?: string | null }) => <Guide hint={hintOf(k)} success={success} />
  const Ok = ({ k, filled }: { k: string; filled: boolean }) =>
    okOf(k, filled) ? <Check size={13} className="inline ml-1.5 text-accent-green" aria-hidden /> : null
  const photoGuide = (note?: PhotoNote) =>
    !note ? null
    : note.kind === 'kept' ? <Guide hint={`5 photos maximum: the first ${note.count} were kept.`} />
    : note.kind === 'unreadable' ? <Guide hint={PHOTO_NOTE.unreadable} />
    : <Guide success={PHOTO_NOTE[note.kind]} />

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
              <label className={lbl} htmlFor="adm-full_name">Full name<Ok k="full_name" filled={!!form.full_name.trim()} /></label>
              <input id="adm-full_name" placeholder="Your full name" maxLength={LIMITS.name} value={form.full_name} onChange={change('full_name')} onBlur={blur('full_name')} className={input(hintOf('full_name'))} />
              <FieldError k="full_name" />
            </div>
            <div>
              <label className={lbl} htmlFor="adm-phone_number">Phone number<Ok k="phone_number" filled={!!form.phone_number.trim()} /></label>
              <input id="adm-phone_number" type="tel" dir="ltr" placeholder="22 123 456" value={form.phone_number} onChange={change('phone_number')} onBlur={blur('phone_number')} className={input(hintOf('phone_number'))} />
              <FieldError k="phone_number" success={okOf('phone_number', !!form.phone_number.trim()) ? `We'll use: ${formatPhone(normalizePhone(form.phone_number))} ✓` : null} />
            </div>
          </div>

          <div>
            <label className={lbl} htmlFor="adm-business_name">Business name<Ok k="business_name" filled={!!form.business_name.trim()} /></label>
            <input id="adm-business_name" placeholder="Your shop or brand name" maxLength={LIMITS.name} value={form.business_name} onChange={change('business_name')} onBlur={blur('business_name')} className={input(hintOf('business_name'))} />
            <FieldError k="business_name" />
          </div>

          <div id="adm-business_category">
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
          <div data-pickup-fields>
            <PickupAddressFields value={pickup} onChange={changePickup} errors={pickupErrors} disabled={loading} />
          </div>
        </>
      )}

      {/* ══ STEP 3 ══ */}
      {step === 3 && (
        <>
          <div id="adm-profile_picture">
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
                <p className="text-xs text-text-muted mt-0.5">JPG, PNG, WebP or iPhone photo · heavy photos are made lighter automatically. None: the default avatar is shown until the seller adds one.</p>
              </div>
            </div>
            {photosBusy > 0 && <p className="text-xs text-text-muted mt-1.5">Preparing the photo…</p>}
            {errors.profile_picture ? <FieldError k="profile_picture" /> : photoGuide(photoNotes.profile_picture)}
            <input ref={profileRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={onProfilePic} />
          </div>

          <div id="adm-sample_images">
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
            {errors.sample_images ? <FieldError k="sample_images" /> : photoGuide(photoNotes.sample_images)}
            <input ref={samplesRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={onSamples} />
          </div>

          <div>
            <label className={lbl} htmlFor="adm-business_description">Business description {opt}</label>
            <textarea id="adm-business_description" rows={4} maxLength={LIMITS.description}
              placeholder="Tell us about the business, what it sells, and its story…"
              value={form.business_description} onChange={change('business_description')} onBlur={blur('business_description')}
              className={`${input(errors.business_description)} resize-none`} />
            <p className={`text-[11px] text-right ${form.business_description.length >= 50 ? 'text-accent-green' : 'text-text-muted'}`}>
              {form.business_description.length} / 2000{form.business_description.length >= 50 && ' ✓'}
            </p>
            <FieldError k="business_description" />
          </div>

          <div>
            <p className={lbl}>Social media {opt}</p>
            <div className="flex flex-col gap-3">
              {([
                ['facebook_url',  'Facebook',  'yourshop or https://facebook.com/yourshop'],
                ['instagram_url', 'Instagram', '@yourshop or https://instagram.com/yourshop'],
                ['website_url',   'Website',   'yourshop.tn'],
              ] as const).map(([k, label, ph]) => {
                const { issue, value } = linkCheck(k)
                const success = touched[k] && !errors[k] && !issue && value ? `We'll use: ${value} ✓` : null
                return (
                  <div key={k}>
                    <label className="block text-xs font-semibold text-text-muted mb-1" htmlFor={`adm-${k}`}>{label}<Ok k={k} filled={!!form[k].trim()} /></label>
                    {/* type="text": "@shop" or "shop.tn" must not be refused by the browser */}
                    <input id={`adm-${k}`} type="text" inputMode="url" dir="ltr" autoCapitalize="none" spellCheck={false} maxLength={LIMITS.link}
                      placeholder={ph} value={form[k]} onChange={change(k)} onBlur={blur(k)} className={input(hintOf(k))} />
                    <FieldError k={k} success={success} />
                  </div>
                )
              })}
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
        <div role="status" className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <AlertCircle size={15} className="text-amber-300 shrink-0" />
          <p className="text-xs text-amber-200">{error}</p>
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
