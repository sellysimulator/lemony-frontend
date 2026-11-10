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
 *
 * A day's customers arrive once, in the `day_result` that played it, and only feed the
 * playback (`watch.events`). The server keeps none: a resumed played day or a day sent
 * again (`events: null`) opens straight on its report, never on an empty street.
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
  /** The server refused the latest request; `message` is its reason, shown as is. */
  refused: boolean
  message?: string | null
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
  /** The finished game's save failed (`game_persist_failed`) and no retry is under way. */
  persistFailed: boolean
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
  handleGamePersistFailed(seq: number): void
  /** A retry of the save was sent: show "saving" again until the server answers. */
  beginRetryPersist(): void
  handleNoActiveGame(): void
  handleGameAbandoned(): void
  handleError(code: string, message: string): void
  /** Makes `requestId` the only request whose reply is kept; the previous reply stays until it answers. */
  beginPlanPreview(requestId: string): void
  handlePlanPreview(event: PlanPreviewEvent): void
  /** `requestId` got no reply (the server drops requests past its rate limit): stop waiting, keep the last reply. */
  endPlanPreviewWait(requestId: string): void
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
  persistFailed: false,
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
    // A refresh mid-day: the server kept no customers to replay, so open the day's report.
    return { view: 'report', watch: { day: record.day, record, events: [] } }
  }
  return { view: 'over', watch: null }
}

/** Appends `record` unless that day (or a later one) is already held, so a replayed result never duplicates a day. */
function appendDay(days: DayRecord[], record: DayRecord): DayRecord[] {
  const last = days[days.length - 1]
  return last && last.day >= record.day ? days : [...days, record]
}

/** The history this client holds for `gameId`, empty if it holds another game or none. */
function heldHistory(s: GameStoreState, gameId: string): Pick<GameState, 'days' | 'summary'> {
  const held = s.state?.game_id === gameId ? s.state : null
  return { days: held?.days ?? [], summary: held?.summary ?? null }
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
      persistFailed: state.public_id ? false : s.persistFailed,
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
      applySequenced(seq, (s) => withState(s, { ...daily, ...heldHistory(s, daily.game_id) }))
    },

    handleDayResult(data) {
      applySequenced(data.seq, (s) => {
        const held = heldHistory(s, data.state.game_id)
        const state = { ...data.state, ...held, days: appendDay(held.days, data.record) }
        if (!Array.isArray(data.events)) {
          // Not available (a day sent again): the report, never an empty street. A playback or
          // report of that day already on screen carries on.
          const onIt = s.watch?.day === data.day && (s.view === 'day' || s.view === 'report')
          return { state, submitting: false, ...(onIt ? {} : { view: 'report' as const, watch: { day: data.day, record: data.record, events: [] } }) }
        }
        return { state, submitting: false, view: 'day', watch: { day: data.day, record: data.record, events: data.events } }
      })
    },

    handleGameFinished(seq, summary) {
      applySequenced(seq, () => ({ summary }))
    },

    handleGamePersisted(seq, publicId) {
      applySequenced(seq, (s) => ({
        publicId,
        persistFailed: false,
        summary: s.summary ? { ...s.summary, public_id: publicId } : s.summary,
      }))
    },

    handleGamePersistFailed(seq) {
      applySequenced(seq, (s) => (s.publicId ? {} : { persistFailed: true }))
    },

    beginRetryPersist() {
      set({ persistFailed: false })
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
      if ('error' in event && event.error)
        set({ planPreview: { requestId: event.request_id, reply: null, refused: true, message: event.error.message, waiting: false } })
      else set({ planPreview: { requestId: event.request_id, reply: event as PlanPreviewOk, refused: false, message: null, waiting: false } })
    },

    endPlanPreviewWait(requestId) {
      if (get().planPreview.requestId === requestId) set((s) => ({ planPreview: { ...s.planPreview, waiting: false } }))
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
