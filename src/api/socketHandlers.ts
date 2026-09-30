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
  GameStateEvent,
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

let connectErrorShown = false
socket.on('connect_error', (err: Error) => {
  if (connectErrorShown) return
  connectErrorShown = true
  const authProblem = /unauthori|reject|forbidden/i.test(err.message)
  useAlerts
    .getState()
    .push('error', authProblem ? 'Your sign-in was refused by the server. Try signing in again.' : 'Could not reach the game server. Retrying…')
})
socket.on('connect', () => {
  connectErrorShown = false
})

socket.on('game_created', (data: GameCreatedEvent) => {
  storeGame(data.game_id, data.session_token)
  useGameStore.getState().handleGameCreated(data.seq, data.game_id)
})

socket.on('game_state', (data: GameStateEvent) => {
  storeGame(data.state.game_id, null)
  useGameStore.getState().handleGameState(data.seq, data.state)
})

socket.on('day_result', (data: DayResultEvent) => {
  useGameStore.getState().handleDayResult(data)
})

socket.on('game_finished', (data: GameFinishedEvent) => {
  useGameStore.getState().handleGameFinished(data.seq, data.summary)
})

socket.on('game_persisted', (data: GamePersistedEvent) => {
  useGameStore.getState().handleGamePersisted(data.seq, data.public_id)
})

socket.on('no_active_game', () => {
  clearStoredGame()
  useGameStore.getState().handleNoActiveGame()
})

socket.on('game_abandoned', () => {
  clearStoredGame()
  useGameStore.getState().handleGameAbandoned()
})

socket.on('error', (data: ServerErrorEvent) => {
  const code = data?.code ?? 'SERVER_ERROR'
  const message = data?.message ?? 'Something went wrong.'
  useGameStore.getState().handleError(code, message)
  if (code === 'NO_GAME') clearStoredGame()
  if (code !== 'ACTIVE_GAME_EXISTS') useAlerts.getState().push('error', message)
})

// ------------------------------------------------------------------ emits
export function createGame(config: GameConfig, replace = false): void {
  useGameStore.getState().setCreating(true)
  socket.emit('create_game', { config, replace })
}

export function submitDay(plan: DayPlanPayload): void {
  const { gameId, state } = useGameStore.getState()
  if (!gameId || !state) return
  useGameStore.getState().setSubmitting(true)
  socket.emit('submit_day', { game_id: gameId, day: state.day, ...plan })
}

export function acknowledgeDay(day: number): void {
  const { gameId } = useGameStore.getState()
  if (gameId) socket.emit('ack_day', { game_id: gameId, day })
}

export function abandonGame(): void {
  const { gameId } = useGameStore.getState()
  if (gameId) socket.emit('abandon_game', { game_id: gameId })
}
