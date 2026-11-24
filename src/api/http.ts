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

/** A 429 waits this long when its `Retry-After` can't be read (the browser hides it unless CORS exposes it). */
const DEFAULT_RETRY_AFTER_MS = 5_000

/**
 * For a rate-limited request (429), how long to wait before asking again, in ms: its
 * `Retry-After` kept within 1–60 s, else `DEFAULT_RETRY_AFTER_MS`. Null for any other outcome.
 */
export function retryAfterMs(err: unknown): number | null {
  const response = (err as { response?: { status?: number; headers?: Record<string, unknown> } } | null | undefined)?.response
  if (response?.status !== 429) return null
  const seconds = retryAfterSeconds(response.headers?.['retry-after'])
  if (seconds === null) return DEFAULT_RETRY_AFTER_MS
  return Math.min(60_000, Math.max(1_000, seconds * 1_000))
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
