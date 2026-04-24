'use client'

/**
 * DynamicAttributeSection.tsx — admin brand products
 * Same logic as seller version; uses direct fetch (no sellerApi dependency).
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Attribute, AttributeValues } from '@/components/types'
import AttributeField from '../../app/(dashboard)/brand-products/AttributeField'

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/api\/?$/, '')

interface Props {
  subcategoryId: number
  values: AttributeValues
  onChange: (values: AttributeValues) => void
  disabled?: boolean
  overrideAttributes?: Attribute[]
}

export default function DynamicAttributeSection({
  subcategoryId, values, onChange, disabled = false, overrideAttributes,
}: Props) {
  const [attributes, setAttributes] = useState<Attribute[]>(overrideAttributes ?? [])
  const [loading, setLoading] = useState(!overrideAttributes)

  useEffect(() => {
    if (overrideAttributes !== undefined) {
      setAttributes(overrideAttributes)
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`${BASE}/api/subcategories/${subcategoryId}/attributes`, { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(j => {
        const data = j.data ?? {}
        setAttributes(Array.isArray(data) ? data : (data.info_attributes ?? []))
      })
      .catch(() => setAttributes([]))
      .finally(() => setLoading(false))
  }, [subcategoryId, overrideAttributes])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
        <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
        Loading attributes…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (attributes.length === 0) return null

  const handleChange = (slug: string, val: AttributeValues[string]) => {
    onChange({ ...values, [slug]: val })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {attributes.map(attr => (
        <AttributeField key={attr.id} attr={attr} values={values} onChange={handleChange} disabled={disabled} />
      ))}
    </div>
  )
}