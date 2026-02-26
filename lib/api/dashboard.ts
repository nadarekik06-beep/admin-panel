import api from '../axios'
import { DashboardData } from '@/types'

export const dashboardApi = {
  async getStats(): Promise<DashboardData> {
    const res = await api.get('/admin/dashboard')
    return res.data.data
  },
}