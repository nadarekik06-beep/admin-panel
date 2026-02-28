// lib/api/auth.ts
import api from '../axios'
import { authStorage } from '../auth'

export const adminAuthApi = {
  async login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password })  // ← fix endpoint
    const { token, user } = res.data                                 // ← fix destructuring

    if (user.role !== 'admin') {
      throw new Error('Access denied. Admin accounts only.')
    }

    authStorage.setToken(token)
    authStorage.setAdmin(user)   // ← was 'admin', now 'user'
    return user
  },

  async logout() {
    await api.post('/auth/logout')   // ← fix endpoint
    authStorage.clear()
  },

  async me() {
    const res = await api.get('/auth/user')   // ← fix endpoint
    return res.data.user                       // ← fix key
  },
}