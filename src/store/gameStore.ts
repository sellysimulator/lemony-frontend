/**
 * The single game store, written only by socket handlers (and by UI flags that
 * are purely presentational). The server computes every number; the store
 * holds what it sent.
 *
 * Sequencing: every server event carries a per-game `seq`; an event not newer
 * than the last applied one is dropped (a stale emit after a resync).
 * `game_created` starts a new game and resets the counter.
 */
import { create } from 'zustand'
import type {
  CustomerEvent,
  DayRecord,
  DayResultEvent,
  GameState,
  GameSummary,
} from '../types/game'

export type ResumeStatus = 'unknown' | 'none' | 'active'

/** What the play screen shows. `day` = playing back `watch`; `report` = its summary. */
export type PlayView = 'plan' | 'day' | 'report' | 'over'

export interface WatchedDay {
  day: number
  record: DayRecord
  events: CustomerEvent[]
}

interface GameStoreState {
  lastSeq: number
  gameId: string | null
  state: GameState | null
  resume: ResumeStatus
  view: PlayView
  watch: WatchedDay | null
  summary: GameSummary | null
  publicId: string | null
  submitting: boolean
  creating: boolean
  /** Set by game_created; the config screen navigates on it and clears it. */
  justCreated: boolean
  lastError: { code: string; message: string } | null
}

interface GameStoreActions {
  handleGameCreated(seq: number, gameId: string): void
  handleGameState(seq: number, state: GameState): void
  handleDayResult(data: DayResultEvent): void
  handleGameFinished(seq: number, summary: GameSummary): void
  handleGamePersisted(seq: number, publicId: string): void
  handleNoActiveGame(): void
  handleGameAbandoned(): void
  handleError(code: string, message: string): void
  setView(view: PlayView): void
  setSubmitting(value: boolean): void
  setCreating(value: boolean): void
  reset(): void
}

const initial: GameStoreState = {
  lastSeq: 0,
  gameId: null,
  state: null,
  resume: 'unknown',
  view: 'plan',
  watch: null,
  summary: null,
  publicId: null,
  submitting: false,
  creating: false,
  justCreated: false,
  lastError: null,
}

/** Which view a freshly (re)synced state should open on. */
export function viewForState(state: GameState): { view: PlayView; watch: WatchedDay | null } {
  if (state.phase === 'planning') return { view: 'plan', watch: null }
  const record = state.days[state.days.length - 1]
  if (state.phase === 'played' && record) {
    // A refresh mid-day: replay the day that was being watched.
    return { view: 'day', watch: { day: record.day, record, events: state.last_day_events } }
  }
  return { view: 'over', watch: null }
}

export const useGameStore = create<GameStoreState & GameStoreActions>((set, get) => {
  function applySequenced(seq: number, update: (s: GameStoreState) => Partial<GameStoreState>): void {
    const current = get()
    if (typeof seq !== 'number' || !(seq > current.lastSeq)) return
    set({ ...update(current), lastSeq: seq })
  }

  return {
    ...initial,

    handleGameCreated(seq, gameId) {
      set({ ...initial, lastSeq: seq, gameId, resume: 'active', view: 'plan', justCreated: true })
    },

    handleGameState(seq, state) {
      applySequenced(seq, (s) => {
        const sameGame = s.gameId === state.game_id && s.state !== null
        // Keep a playback or report in progress when the state merely refreshes.
        const keep =
          sameGame && state.phase !== 'planning' && (s.view === 'day' || s.view === 'report') && s.watch !== null
        const next = keep ? { view: s.view, watch: s.watch } : viewForState(state)
        return {
          gameId: state.game_id,
          state,
          resume: 'active',
          publicId: state.public_id,
          summary: state.summary ?? s.summary,
          submitting: false,
          ...next,
        }
      })
    },

    handleDayResult(data) {
      applySequenced(data.seq, () => ({
        state: data.state,
        submitting: false,
        view: 'day',
        watch: { day: data.day, record: data.record, events: data.events },
      }))
    },

    handleGameFinished(seq, summary) {
      applySequenced(seq, () => ({ summary }))
    },

    handleGamePersisted(seq, publicId) {
      applySequenced(seq, (s) => ({
        publicId,
        summary: s.summary ? { ...s.summary, public_id: publicId } : s.summary,
      }))
    },

    handleNoActiveGame() {
      set({ ...initial, resume: 'none' })
    },

    handleGameAbandoned() {
      set({ ...initial, resume: 'none' })
    },

    handleError(code, message) {
      set({ lastError: { code, message }, submitting: false, creating: false })
    },

    setView(view) {
      set({ view })
    },
    setSubmitting(value) {
      set({ submitting: value })
    },
    setCreating(value) {
      set({ creating: value })
    },
    reset() {
      set({ ...initial })
    },
  }
})
