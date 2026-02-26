import api from '../axios'
import { authStorage } from '../auth'

export const adminAuthApi = {
  async login(email: string, password: string) {
    const res = await api.post('/admin/login', { email, password })
    const { token, admin } = res.data
    authStorage.setToken(token)
    authStorage.setAdmin(admin)
    return admin
  },

  async logout() {
    await api.post('/admin/logout')
    authStorage.clear()
  },

  async me() {
    const res = await api.get('/admin/me')
    return res.data.admin
  },
}