// admin-panel/lib/api/categories.ts
// Extended with attribute management for subcategories.

import api from '@/lib/axios'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  id: number
  name: string
  name_ar: string | null
  slug: string
  description: string | null
  icon: string | null
  image: string | null
  is_active: boolean
  order: number
  products_count?: number
  subcategories_count?: number
  subcategories?: Subcategory[]
  created_at: string
  updated_at: string
}

export interface Subcategory {
  id: number
  category_id: number
  name: string
  name_ar: string | null
  slug: string
  icon: string | null
  is_active: boolean
  order: number
  products_count?: number
  category?: Pick<Category, 'id' | 'name' | 'slug'>
  created_at: string
  updated_at: string
}

export interface AttributeOption {
  id: number
  attribute_id: number
  value: string
  value_ar: string | null
  color_hex: string | null
  order: number
}

export interface Attribute {
  id: number
  name: string
  name_ar: string | null
  slug: string
  type: 'select' | 'multiselect' | 'text' | 'number' | 'boolean' | 'color'
  is_filterable: boolean
  is_visible: boolean
  order: number
  options: AttributeOption[]
}

/** Attribute as assigned to a subcategory — includes pivot fields */
export interface SubcategoryAttribute extends Attribute {
  is_variant: boolean
  is_required: boolean
}

export interface CategoryPayload {
  name: string
  name_ar?: string
  description?: string
  icon?: string
  image?: string
  is_active?: boolean
  order?: number
}

export interface SubcategoryPayload {
  category_id: number
  name: string
  name_ar?: string
  icon?: string
  is_active?: boolean
  order?: number
}

export interface AttributePayload {
  name: string
  name_ar?: string
  type: Attribute['type']
  is_filterable?: boolean
  is_visible?: boolean
  order?: number
}

export interface AttributeOptionPayload {
  value: string
  value_ar?: string
  color_hex?: string
  order?: number
}

export interface AssignAttributePayload {
  attribute_id: number
  is_variant: boolean
  is_required?: boolean
  order?: number
}

// ─── Category API ─────────────────────────────────────────────────────────────

export const adminCategoriesApi = {
  getAll: (params?: { search?: string; with_subcategories?: boolean }) =>
    api.get<{ success: boolean; data: Category[] }>('/admin/categories', { params }),

  getOne: (id: number) =>
    api.get<{ success: boolean; data: Category }>(`/admin/categories/${id}`),

  create: (payload: CategoryPayload) =>
    api.post<{ success: boolean; message: string; data: Category }>('/admin/categories', payload),

  update: (id: number, payload: Partial<CategoryPayload>) =>
    api.put<{ success: boolean; message: string; data: Category }>(`/admin/categories/${id}`, payload),

  toggle: (id: number) =>
    api.patch<{ success: boolean; message: string; is_active: boolean }>(`/admin/categories/${id}/toggle`),

  delete: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/admin/categories/${id}`),
}

// ─── Subcategory API ──────────────────────────────────────────────────────────

export const adminSubcategoriesApi = {
  getAll: (params?: { category_id?: number; search?: string }) =>
    api.get<{ success: boolean; data: Subcategory[] }>('/admin/subcategories', { params }),

  getOne: (id: number) =>
    api.get<{ success: boolean; data: Subcategory }>(`/admin/subcategories/${id}`),

  create: (payload: SubcategoryPayload) =>
    api.post<{ success: boolean; message: string; data: Subcategory }>('/admin/subcategories', payload),

  update: (id: number, payload: Partial<SubcategoryPayload>) =>
    api.put<{ success: boolean; message: string; data: Subcategory }>(`/admin/subcategories/${id}`, payload),

  delete: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/admin/subcategories/${id}`),

  getAttributes: (subcategoryId: number) =>
    api.get<{ success: boolean; data: SubcategoryAttribute[] }>(
      `/admin/subcategories/${subcategoryId}/attributes`
    ),

  assignAttribute: (subcategoryId: number, payload: AssignAttributePayload) =>
    api.post<{ success: boolean; message: string }>(
      `/admin/subcategories/${subcategoryId}/attributes`,
      payload
    ),

  updateAssignment: (subcategoryId: number, attrId: number, payload: { is_variant?: boolean; is_required?: boolean; order?: number }) =>
    api.put<{ success: boolean; message: string }>(
      `/admin/subcategories/${subcategoryId}/attributes/${attrId}`,
      payload
    ),

  removeAttribute: (subcategoryId: number, attrId: number) =>
    api.delete<{ success: boolean; message: string }>(
      `/admin/subcategories/${subcategoryId}/attributes/${attrId}`
    ),
}

// ─── Global Attribute API ─────────────────────────────────────────────────────

export const adminAttributesApi = {
  getAll: () =>
    api.get<{ success: boolean; data: Attribute[] }>('/admin/attributes'),

  create: (payload: AttributePayload) =>
    api.post<{ success: boolean; message: string; data: Attribute }>('/admin/attributes', payload),

  update: (id: number, payload: Partial<AttributePayload>) =>
    api.put<{ success: boolean; message: string; data: Attribute }>(`/admin/attributes/${id}`, payload),

  delete: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/admin/attributes/${id}`),

  addOption: (attrId: number, payload: AttributeOptionPayload) =>
    api.post<{ success: boolean; message: string; data: AttributeOption }>(
      `/admin/attributes/${attrId}/options`,
      payload
    ),

  updateOption: (attrId: number, optId: number, payload: Partial<AttributeOptionPayload>) =>
    api.put<{ success: boolean; message: string; data: AttributeOption }>(
      `/admin/attributes/${attrId}/options/${optId}`,
      payload
    ),

  deleteOption: (attrId: number, optId: number) =>
    api.delete<{ success: boolean; message: string }>(
      `/admin/attributes/${attrId}/options/${optId}`
    ),
}