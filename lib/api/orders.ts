import api from '../axios'

interface OrdersParams {
  status?: string
  search?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
}

export const ordersApi = {
  async list(params: OrdersParams = {}) {
    const res = await api.get('/admin/orders', { params })
    return res.data.data
  },
  async get(id: number) {
    const res = await api.get(`/admin/orders/${id}`)
    return res.data.data
  },
}