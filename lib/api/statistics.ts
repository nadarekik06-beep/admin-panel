import api from '../axios'

export const statisticsApi = {
  async getAll() {
    const res = await api.get('/admin/statistics')
    return res.data.data
  },
  async getRevenue() {
    const res = await api.get('/admin/statistics/revenue')
    return res.data.data
  },
  async getOrdersTrend() {
    const res = await api.get('/admin/statistics/orders-trend')
    return res.data.data
  },
  async getCategories() {
    const res = await api.get('/admin/statistics/categories')
    return res.data.data
  },
}