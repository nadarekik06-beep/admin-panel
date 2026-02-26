// lib/auth.ts

import Cookies from 'js-cookie'
import { Admin } from '@/types'

const TOKEN_KEY  = 'admin_token'
const ADMIN_KEY  = 'admin_user'

export const authStorage = {
  setToken(token: string) {
    Cookies.set(TOKEN_KEY, token, {
      expires: 1,        // 1 day
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })
  },

  getToken(): string | undefined {
    return Cookies.get(TOKEN_KEY)
  },

  setAdmin(admin: Admin) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
    }
  },

  getAdmin(): Admin | null {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(ADMIN_KEY)
    return raw ? JSON.parse(raw) : null
  },

  clear() {
    Cookies.remove(TOKEN_KEY)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ADMIN_KEY)
    }
  },

  isAuthenticated(): boolean {
    return !!Cookies.get(TOKEN_KEY)
  },
}