import api from '../axios'

interface UsersParams {
  search?: string
  status?: 'active' | 'banned'
  page?: number
  per_page?: number
}

export const usersApi = {
  async list(params: UsersParams = {}) {
    const res = await api.get('/admin/users', { params })
    return res.data.data
  },
  async get(id: number) {
    const res = await api.get(`/admin/users/${id}`)
    return res.data.data
  },
  async ban(id: number) {
    await api.patch(`/admin/users/${id}/ban`)
  },
  async unban(id: number) {
    await api.patch(`/admin/users/${id}/unban`)
  },
  async delete(id: number) {
    await api.delete(`/admin/users/${id}`)
  },
}