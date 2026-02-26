import api from '../axios'

interface SellersParams {
  status?: string
  search?: string
  page?: number
  per_page?: number
}

export const sellersApi = {
  async list(params: SellersParams = {}) {
    const res = await api.get('/admin/sellers', { params })
    return res.data.data
  },
  async get(id: number) {
    const res = await api.get(`/admin/sellers/${id}`)
    return res.data.data
  },
  async approve(id: number) {
    await api.patch(`/admin/sellers/${id}/approve`)
  },
  async reject(id: number, reason?: string) {
    await api.patch(`/admin/sellers/${id}/reject`, { reason })
  },
  async suspend(id: number) {
    await api.patch(`/admin/sellers/${id}/suspend`)
  },
}