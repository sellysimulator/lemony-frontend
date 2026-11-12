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

/** Whole seconds from a `Retry-After` header (seconds or an HTTP date), or null. */
function retryAfterSeconds(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  const seconds = /^\d+$/.test(text) ? Number(text) : Math.ceil((Date.parse(text) - Date.now()) / 1000)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

/**
 * A string that is always safe to render. FastAPI's `detail` is a string for
 * HTTPException but an array of objects for 422s — rendering that array
 * white-screens React. [HARD-WON, game_stack.md §1]
 *
 * The backend's abuse limits (`core/abuse.py`) and a busy host get their own words,
 * whatever the body says: 429 (with `Retry-After`), 413 and 503.
 */
export function errorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { status?: number; headers?: Record<string, unknown>; data?: { detail?: unknown } } } | null | undefined)
    ?.response
  if (response?.status === 429) {
    const wait = retryAfterSeconds(response.headers?.['retry-after'])
    return `Too many requests from your network. Please wait ${wait ? `about ${wait} seconds` : 'a moment'} and try again.`
  }
  if (response?.status === 413) return 'That request was too large.'
  if (response?.status === 503) return 'The server is busy right now — please try again in a minute.'
  const detail = response?.data?.detail
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
