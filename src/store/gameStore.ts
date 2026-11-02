/**
 * The single game store, written only by socket handlers (and by UI flags that
 * are purely presentational). The server computes every number; the store
 * holds what it sent.
 *
 * Sequencing: every server event carries a per-game `seq`; an event not newer
 * than the last applied one is dropped (a stale emit after a resync).
 * `game_created` starts a new game and resets the counter.
 *
 * History: only full states carry `days`. Round events send a daily state, and
 * the store keeps the days it holds, appending each `day_result.record`.
 */
import { create } from 'zustand'
import type {
  CustomerEvent,
  DailyGameState,
  DayRecord,
  DayResultEvent,
  GameState,
  GameSummary,
  PlanPreviewEvent,
  PlanPreviewOk,
} from '../types/game'

export type ResumeStatus = 'unknown' | 'none' | 'active'

/** What the play screen shows. `day` = playing back `watch`; `report` = its summary. */
export type PlayView = 'plan' | 'day' | 'report' | 'over'

export interface WatchedDay {
  day: number
  record: DayRecord
  events: CustomerEvent[]
}

/** The what-if reply to the latest `preview_plan` request only; request-scoped, so it never touches `lastSeq`. */
export interface PlanPreviewSlice {
  requestId: string | null
  reply: PlanPreviewOk | null
  /** The server refused the latest request; the plan's own validation explains why. */
  refused: boolean
  waiting: boolean
}

interface GameStoreState {
  planPreview: PlanPreviewSlice
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
  handleDailyState(seq: number, state: DailyGameState): void
  handleDayResult(data: DayResultEvent): void
  handleGameFinished(seq: number, summary: GameSummary): void
  handleGamePersisted(seq: number, publicId: string): void
  handleNoActiveGame(): void
  handleGameAbandoned(): void
  handleError(code: string, message: string): void
  /** Makes `requestId` the only request whose reply is kept; the previous reply stays until it answers. */
  beginPlanPreview(requestId: string): void
  handlePlanPreview(event: PlanPreviewEvent): void
  setView(view: PlayView): void
  /** Opens the report of a day already held; no events are kept for past days, so there is no replay. A day not held changes nothing. */
  openDayReport(day: number): void
  setSubmitting(value: boolean): void
  setCreating(value: boolean): void
  reset(): void
}

const initial: GameStoreState = {
  planPreview: { requestId: null, reply: null, refused: false, waiting: false },
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

/** Appends `record` unless that day (or a later one) is already held, so a replayed result never duplicates a day. */
function appendDay(days: DayRecord[], record: DayRecord): DayRecord[] {
  const last = days[days.length - 1]
  return last && last.day >= record.day ? days : [...days, record]
}

/** The history this client holds for `gameId`, empty if it holds another game or none. */
function heldHistory(s: GameStoreState, gameId: string): Pick<GameState, 'days' | 'last_day_events' | 'summary'> {
  const held = s.state?.game_id === gameId ? s.state : null
  return { days: held?.days ?? [], last_day_events: held?.last_day_events ?? [], summary: held?.summary ?? null }
}

export const useGameStore = create<GameStoreState & GameStoreActions>((set, get) => {
  function applySequenced(seq: number, update: (s: GameStoreState) => Partial<GameStoreState>): void {
    const current = get()
    if (typeof seq !== 'number' || !(seq > current.lastSeq)) return
    set({ ...update(current), lastSeq: seq })
  }

  function withState(s: GameStoreState, state: GameState): Partial<GameStoreState> {
    const sameGame = s.gameId === state.game_id && s.state !== null
    // Keep a playback or report in progress when the state merely refreshes.
    const keep = sameGame && state.phase !== 'planning' && (s.view === 'day' || s.view === 'report') && s.watch !== null
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
  }

  return {
    ...initial,

    handleGameCreated(seq, gameId) {
      set({ ...initial, lastSeq: seq, gameId, resume: 'active', view: 'plan', justCreated: true })
    },

    handleGameState(seq, state) {
      applySequenced(seq, (s) => withState(s, state))
    },

    handleDailyState(seq, daily) {
      applySequenced(seq, (s) => {
        const held = heldHistory(s, daily.game_id)
        // Acknowledging a day clears its events; a refused ack leaves the day being watched.
        const lastDayEvents = daily.phase === 'planning' ? [] : held.last_day_events
        return withState(s, { ...daily, ...held, last_day_events: lastDayEvents })
      })
    },

    handleDayResult(data) {
      applySequenced(data.seq, (s) => {
        const held = heldHistory(s, data.state.game_id)
        return {
          state: { ...data.state, ...held, days: appendDay(held.days, data.record), last_day_events: data.events },
          submitting: false,
          view: 'day',
          watch: { day: data.day, record: data.record, events: data.events },
        }
      })
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

    beginPlanPreview(requestId) {
      set((s) => ({ planPreview: { ...s.planPreview, requestId, waiting: true } }))
    },

    handlePlanPreview(event) {
      if (!event || event.request_id !== get().planPreview.requestId) return
      if ('error' in event && event.error) set({ planPreview: { requestId: event.request_id, reply: null, refused: true, waiting: false } })
      else set({ planPreview: { requestId: event.request_id, reply: event as PlanPreviewOk, refused: false, waiting: false } })
    },

    setView(view) {
      set({ view })
    },
    openDayReport(day) {
      const record = get().state?.days.find((d) => d.day === day)
      if (!record) return
      set({ view: 'report', watch: { day, record, events: [] } })
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
