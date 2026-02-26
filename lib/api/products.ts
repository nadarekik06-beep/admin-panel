import api from '../axios'

interface ProductsParams {
  status?: string
  search?: string
  category_id?: number
  page?: number
  per_page?: number
}

export const productsApi = {
  async list(params: ProductsParams = {}) {
    const res = await api.get('/admin/products', { params })
    return res.data.data
  },
  async get(id: number) {
    const res = await api.get(`/admin/products/${id}`)
    return res.data.data
  },
  async approve(id: number) {
    await api.patch(`/admin/products/${id}/approve`)
  },
  async disable(id: number) {
    await api.patch(`/admin/products/${id}/disable`)
  },
  async delete(id: number) {
    await api.delete(`/admin/products/${id}`)
  },
}