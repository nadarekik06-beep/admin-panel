// admin-panel/lib/api/genderMenu.ts
// Gender menu of gendered categories (Mode & Vêtements → Femme / Homme) and product genders.

import api from '@/lib/axios'

/** Femme / Homme columns of a gendered category, 'all' columns of the others */
export type MenuGender = 'women' | 'men' | 'all'
export type ProductGender = 'women' | 'men' | 'unisex' | 'kids'
export type GenderSource = 'seller' | 'inherited' | 'admin'

export interface GenderMenuItem {
  id: number
  group_id: number
  subcategory_id: number
  sort_order: number
  subcategory: { id: number; category_id: number; name: string; name_fr: string | null; name_ar: string | null; slug: string; is_active: boolean } | null
}

export interface GenderMenuGroup {
  id: number
  category_id: number
  gender: MenuGender
  key: string
  name: string
  name_fr: string | null
  name_ar: string | null
  sort_order: number
  items: GenderMenuItem[]
}

export interface GenderMenuSubcategory {
  id: number
  category_id: number
  category_name: string
  name: string
  name_fr: string | null
  name_ar: string | null
  slug: string
  is_active: boolean
  genders: MenuGender[]
  images: Partial<Record<MenuGender, string>>
  counts: Partial<Record<ProductGender | 'none', number>>
}

export interface GenderMenuData {
  category: { id: number; name: string; name_fr: string | null; name_ar: string | null; slug: string; is_gendered: boolean }
  groups: Record<MenuGender, GenderMenuGroup[]>
  subcategories: GenderMenuSubcategory[]
}

export interface ProductGenderRow {
  id: number
  name: string
  slug: string
  is_active: boolean | number
  is_approved: boolean | number
  gender: ProductGender | null
  gender_source: GenderSource | null
  gender_override: ProductGender | null
  category_name: string | null
  subcategory_name: string | null
  image_url: string | null
}

export interface Paged<T> { data: T[]; current_page: number; last_page: number; total: number }

export const adminGenderMenuApi = {
  /** "Masquer les sous-catégories vides dans le mega-menu" (off by default) */
  getSettings: () =>
    api.get<{ success: boolean; data: { hide_empty: boolean } }>('/admin/gender-menu/settings'),

  updateSettings: (hideEmpty: boolean) =>
    api.put<{ success: boolean; data: { hide_empty: boolean } }>('/admin/gender-menu/settings', { hide_empty: hideEmpty }),

  get: (categoryId: number) =>
    api.get<{ success: boolean; data: GenderMenuData }>(`/admin/gender-menu/${categoryId}`),

  createGroup: (categoryId: number, payload: { gender: MenuGender; name: string; name_fr?: string; name_ar?: string }) =>
    api.post(`/admin/gender-menu/${categoryId}/groups`, payload),

  updateGroup: (id: number, payload: { name?: string; name_fr?: string | null; name_ar?: string | null }) =>
    api.put(`/admin/gender-menu/groups/${id}`, payload),

  deleteGroup: (id: number) => api.delete(`/admin/gender-menu/groups/${id}`),

  addItem: (groupId: number, subcategoryId: number) =>
    api.post(`/admin/gender-menu/groups/${groupId}/items`, { subcategory_id: subcategoryId }),

  removeItem: (itemId: number) => api.delete(`/admin/gender-menu/items/${itemId}`),

  /** Full order of one gender, top to bottom: [{ id: groupId, items: [itemId…] }] */
  reorder: (categoryId: number, gender: MenuGender, groups: { id: number; items: number[] }[]) =>
    api.put(`/admin/gender-menu/${categoryId}/order`, { gender, groups }),

  setSubcategoryGenders: (categoryId: number, subId: number, genders: MenuGender[]) =>
    api.put(`/admin/gender-menu/${categoryId}/subcategories/${subId}/genders`, { genders }),

  uploadImage: (subId: number, gender: MenuGender, file: File) => {
    const fd = new FormData()
    fd.append('gender', gender)
    fd.append('image', file)
    return api.post<{ success: boolean; data: { image: string } }>(`/admin/subcategories/${subId}/gender-image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteImage: (subId: number, gender: MenuGender) =>
    api.delete(`/admin/subcategories/${subId}/gender-image`, { params: { gender } }),

  products: (params: { gender?: string; source?: string; category_id?: number; search?: string; page?: number }) =>
    api.get<{ success: boolean; summary: Record<string, number>; data: Paged<ProductGenderRow> }>('/admin/product-genders', { params }),

  setProductGender: (productId: number, gender: ProductGender | 'auto') =>
    api.put<{ success: boolean; data: { id: number; gender: ProductGender | null; gender_source: GenderSource | null; gender_override: ProductGender | null } }>(
      `/admin/products/${productId}/gender`, { gender }
    ),
}
