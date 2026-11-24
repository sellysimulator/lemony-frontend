/** Every browser-storage key the app uses, in one place. */
import { v4 as uuidv4 } from 'uuid'

export const GUEST_ID_KEY = 'guest_id'
const GAME_ID_KEY = 'lemony_game_id'
const SESSION_TOKEN_KEY = 'lemony_session_token'
const BOARD_VIEW_KEY = 'board_view'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode / blocked storage: the server can still resume by identity */
  }
}

// With storage blocked, a guest's id lives in this tab's memory: every handshake must carry an
// identity (the server refuses one without), and this keeps the same one across reconnects.
let memoryGuestId: string | null = null

export function getGuestId(): string | null {
  return read(GUEST_ID_KEY) ?? memoryGuestId
}

export function getOrCreateGuestId(): string {
  const existing = getGuestId()
  if (existing) return existing
  const id = `guest_${uuidv4()}`
  write(GUEST_ID_KEY, id)
  memoryGuestId = id
  return id
}

export function clearGuestId(): void {
  write(GUEST_ID_KEY, null)
  memoryGuestId = null
}

export function getStoredGame(): { gameId: string | null; sessionToken: string | null } {
  return { gameId: read(GAME_ID_KEY), sessionToken: read(SESSION_TOKEN_KEY) }
}

export function storeGame(gameId: string, sessionToken: string | null): void {
  write(GAME_ID_KEY, gameId)
  if (sessionToken) write(SESSION_TOKEN_KEY, sessionToken)
}

export function clearStoredGame(): void {
  write(GAME_ID_KEY, null)
  write(SESSION_TOKEN_KEY, null)
}

export type BoardView = '2D' | '3D'

export function getBoardView(): BoardView {
  const stored = read(BOARD_VIEW_KEY)
  if (stored === '2D' || stored === '3D') return stored
  return import.meta.env.VITE_BOARD_VIEW === '3D' ? '3D' : '2D'
}

export function setBoardView(view: BoardView): void {
  write(BOARD_VIEW_KEY, view)
}
