// NEXT_PUBLIC_API_URL ends with /api (e.g. https://api.choosetounsi.tn/api): API_URL is the bare origin.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/api\/?$/, '')
export const API_BASE = `${API_URL}/api`
export const STORAGE_URL = `${API_URL}/storage`
