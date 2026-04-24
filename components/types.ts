// types.ts — shared attribute types for brand product components
// Mirrors choosetounsi-frontend/types/Attributes.ts exactly

export interface AttributeOption {
  id: number
  value: string
  value_ar?: string
  color_hex?: string | null
  order?: number
}

export type AttributeType = 'select' | 'multiselect' | 'text' | 'number' | 'boolean' | 'color'

export interface Attribute {
  id: number
  slug: string
  name: string
  name_ar?: string
  type: AttributeType
  is_required: boolean
  is_variant: boolean
  is_filterable: boolean
  options: AttributeOption[]
}

export type AttributeValues = Record<string, number | number[] | string | boolean | null>