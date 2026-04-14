import axios from 'axios'
import { clearStoredAuth, getStoredToken } from '@/lib/auth-storage'

export const api = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] ?? '',
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearStoredAuth()
      window.location.href = '/sign-in'
    }
    return Promise.reject(err)
  },
)
