/**
 * Every socket listener, registered once at module load (imported first in
 * main.tsx, before React renders, so StrictMode double-mounts cannot double
 * register), plus the emit helpers the UI calls.
 */
import { socket } from './socket'
import { useGameStore } from '../store/gameStore'
import { useAlerts } from '../store/alerts'
import { clearStoredGame, getStoredGame, storeGame } from '../utils/storage'
import type {
  DayPlanPayload,
  DayResultEvent,
  GameConfig,
  GameCreatedEvent,
  GameFinishedEvent,
  GamePersistedEvent,
  GamePersistFailedEvent,
  GameStateEvent,
  PlanPreviewEvent,
  PlanPreviewRequest,
  ServerErrorEvent,
} from '../types/game'

/** Identity must be re-asserted on every (re)connect: resume the stored game or the active one. */
export function resumeGame(): void {
  const { gameId, sessionToken } = getStoredGame()
  socket.emit('resume_game', { game_id: gameId, session_token: sessionToken })
}

socket.on('connect', () => {
  resumeGame()
})

// A handshake the server REFUSED is not retried by socket.io-client (`socket.active` turns
// false); an unreachable server is, by the manager's own reconnect loop. The backend refuses
// with "Too many connections from your network. …" past its per-address caps
// (`handlers/connection.py`), and with "Connection rejected by server" when the ID token fails.
const TOO_MANY_CONNECTIONS = /too many connections/i
export const CAP_RETRY_BASE_MS = 2_000
export const CAP_RETRY_MAX_MS = 30_000
export const CAP_RETRY_ATTEMPTS = 6

let connectErrorShown: string | null = null
let capRetries = 0
let capRetryTimer: ReturnType<typeof setTimeout> | null = null

function showConnectError(message: string): void {
  if (connectErrorShown === message) return
  connectErrorShown = message
  useAlerts.getState().push('error', message)
}

/** Exponential backoff with jitter: half the step plus up to the other half at random. */
function capRetryDelay(attempt: number): number {
  const step = Math.min(CAP_RETRY_MAX_MS, CAP_RETRY_BASE_MS * 2 ** attempt)
  return step / 2 + Math.random() * (step / 2)
}

socket.on('connect_error', (err: Error) => {
  const refused = !socket.active
  if (refused && TOO_MANY_CONNECTIONS.test(err.message)) {
    if (capRetries >= CAP_RETRY_ATTEMPTS) {
      showConnectError('Too many connections from your network. Please reload the page in a few minutes.')
      return
    }
    showConnectError('Too many connections from your network. Retrying…')
    if (capRetryTimer) clearTimeout(capRetryTimer)
    capRetryTimer = setTimeout(() => {
      capRetryTimer = null
      if (!socket.connected && !socket.active) socket.connect()
    }, capRetryDelay(capRetries++))
    return
  }
  const authProblem = /unauthori|reject|forbidden/i.test(err.message)
  showConnectError(authProblem ? 'Your sign-in was refused by the server. Try signing in again.' : 'Could not reach the game server. Retrying…')
})
socket.on('connect', () => {
  connectErrorShown = null
  capRetries = 0
  if (capRetryTimer) clearTimeout(capRetryTimer)
  capRetryTimer = null
})

socket.on('game_created', (data: GameCreatedEvent) => {
  storeGame(data.game_id, data.session_token)
  useGameStore.getState().handleGameCreated(data.seq, data.game_id)
})

/**
 * A daily state or a day result only extends the history this client holds. If it
 * holds another game or none, it asks for the full state instead of guessing.
 */
function holdsGame(gameId: string): boolean {
  return useGameStore.getState().state?.game_id === gameId
}

socket.on('game_state', (data: GameStateEvent) => {
  storeGame(data.state.game_id, null)
  if (data.full === false) {
    if (holdsGame(data.state.game_id)) useGameStore.getState().handleDailyState(data.seq, data.state)
    else socket.emit('request_state', { game_id: data.state.game_id })
    return
  }
  useGameStore.getState().handleGameState(data.seq, data.state)
})

socket.on('day_result', (data: DayResultEvent) => {
  if (holdsGame(data.state.game_id)) useGameStore.getState().handleDayResult(data)
  else socket.emit('request_state', { game_id: data.state.game_id })
})

socket.on('game_finished', (data: GameFinishedEvent) => {
  useGameStore.getState().handleGameFinished(data.seq, data.summary)
})

socket.on('game_persisted', (data: GamePersistedEvent) => {
  useGameStore.getState().handleGamePersisted(data.seq, data.public_id)
})

socket.on('game_persist_failed', (data: GamePersistFailedEvent) => {
  useGameStore.getState().handleGamePersistFailed(data.seq)
})

socket.on('no_active_game', () => {
  clearStoredGame()
  useGameStore.getState().handleNoActiveGame()
})

socket.on('game_abandoned', () => {
  clearStoredGame()
  useGameStore.getState().handleGameAbandoned()
})

// A request-scoped reply: no seq, so it bypasses the gate and never touches lastSeq. A refusal
// rides inside it and is never an `error` event, so nothing is toasted.
socket.on('plan_preview', (data: PlanPreviewEvent) => {
  useGameStore.getState().handlePlanPreview(data)
})

/** Codes whose server wording is replaced by the client's own. */
const ERROR_TEXT: Record<string, string> = {
  RATE_LIMITED: 'Too many requests from your network. Please wait a minute and try again.',
}

socket.on('error', (data: ServerErrorEvent) => {
  const code = data?.code ?? 'SERVER_ERROR'
  const message = ERROR_TEXT[code] ?? data?.message ?? 'Something went wrong.'
  useGameStore.getState().handleError(code, message)
  if (code === 'NO_GAME') clearStoredGame()
  if (code !== 'ACTIVE_GAME_EXISTS') useAlerts.getState().push('error', message)
})

// ------------------------------------------------------------------ emits
// The server drops a socket's events past its rate limits WITHOUT answering (`core/abuse.py`).
// So no button or figure waits forever, a request still unanswered after these times is let go.
export const PREVIEW_REPLY_TIMEOUT_MS = 3_000
export const REPLY_TIMEOUT_MS = 20_000
const NO_ANSWER = 'The server did not answer. Please try again.'

const replyTimers: Partial<Record<string, ReturnType<typeof setTimeout>>> = {}

/** Calls `giveUp` if `stillWaiting()` after `ms`; a newer request of the same `kind` restarts the wait. */
function expectReply(kind: string, ms: number, stillWaiting: () => boolean, giveUp: () => void): void {
  clearTimeout(replyTimers[kind])
  replyTimers[kind] = setTimeout(() => {
    delete replyTimers[kind]
    if (stillWaiting()) giveUp()
  }, ms)
}

export function createGame(config: GameConfig, replace = false): void {
  useGameStore.getState().setCreating(true)
  socket.emit('create_game', { config, replace })
  expectReply('create', REPLY_TIMEOUT_MS, () => useGameStore.getState().creating, () => {
    useGameStore.getState().setCreating(false)
    useAlerts.getState().push('error', NO_ANSWER)
  })
}

export function submitDay(plan: DayPlanPayload): void {
  const { gameId, state } = useGameStore.getState()
  if (!gameId || !state) return
  useGameStore.getState().setSubmitting(true)
  socket.emit('submit_day', { game_id: gameId, day: state.day, ...plan })
  expectReply('submit', REPLY_TIMEOUT_MS, () => useGameStore.getState().submitting, () => {
    useGameStore.getState().setSubmitting(false)
    useAlerts.getState().push('error', NO_ANSWER)
  })
}

let previewCount = 0

/**
 * Asks the server for the what-if curve and every figure of this plan, at this price. Only the
 * latest request's reply is kept. An unanswered request is sent once more, then let go quietly:
 * the last reply stays on screen and the next change asks again.
 */
export function previewPlan(plan: PlanPreviewRequest): void {
  const { gameId, state } = useGameStore.getState()
  if (!gameId || !state) return
  const requestId = `p${Date.now().toString(36)}-${++previewCount}`
  const payload = { request_id: requestId, game_id: gameId, day: state.day, purchases: plan.purchases, recipe: plan.recipe, price: plan.price }
  const unanswered = () => {
    const { requestId: latest, waiting } = useGameStore.getState().planPreview
    return latest === requestId && waiting
  }
  useGameStore.getState().beginPlanPreview(requestId)
  socket.emit('preview_plan', payload)
  expectReply('preview', PREVIEW_REPLY_TIMEOUT_MS, unanswered, () => {
    socket.emit('preview_plan', payload)
    expectReply('preview', PREVIEW_REPLY_TIMEOUT_MS, unanswered, () => useGameStore.getState().endPlanPreviewWait(requestId))
  })
}

export function acknowledgeDay(day: number): void {
  const { gameId } = useGameStore.getState()
  if (gameId) socket.emit('ack_day', { game_id: gameId, day })
}

/** Asks the server to save the finished game again after `game_persist_failed`. */
export function retryPersist(): void {
  const { gameId } = useGameStore.getState()
  if (!gameId) return
  useGameStore.getState().beginRetryPersist()
  socket.emit('retry_persist', { game_id: gameId })
  // Unanswered: offer the retry again.
  expectReply('persist', REPLY_TIMEOUT_MS, () => {
    const s = useGameStore.getState()
    return s.gameId === gameId && !s.publicId && !s.persistFailed
  }, () => useGameStore.setState({ persistFailed: true }))
}

export function abandonGame(): void {
  const { gameId } = useGameStore.getState()
  if (gameId) socket.emit('abandon_game', { game_id: gameId })
}
