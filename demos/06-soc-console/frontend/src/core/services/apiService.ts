import axios, { type AxiosRequestConfig, isCancel } from 'axios'
import { useToastStore } from '../stores/toast'

const client = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!isCancel(error)) {
      const toast = useToastStore()
      const msg = error.response?.data?.error || error.response?.data?.message || error.message || 'Error de red'
      toast.error(String(msg))
    }
    return Promise.reject(error)
  },
)

export function isAbortError(err: unknown) {
  return isCancel(err)
}

export const apiService = {
  async request<T = any>(options: AxiosRequestConfig): Promise<T> {
    const res = await client.request<T>(options)
    return res.data
  },
}

export default apiService
