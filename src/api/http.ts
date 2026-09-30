import axios, { type AxiosInstance } from 'axios'
import { auth } from '../../firebase'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const http: AxiosInstance = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

/** Attach the Firebase ID token; the backend derives the uid from it, never from a body. */
http.interceptors.request.use(async (config) => {
  const user = auth?.currentUser
  if (user) config.headers.Authorization = `Bearer ${await user.getIdToken()}`
  return config
})

/**
 * A string that is always safe to render. FastAPI's `detail` is a string for
 * HTTPException but an array of objects for 422s — rendering that array
 * white-screens React. [HARD-WON, game_stack.md §1]
 */
export function errorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } } | null | undefined)?.response
    ?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === 'object' && typeof (d as { msg?: unknown }).msg === 'string' ? (d as { msg: string }).msg : null))
      .filter((m): m is string => Boolean(m && m.trim()))
    if (msgs.length) return msgs.join('; ')
  }
  return fallback
}

export default http
