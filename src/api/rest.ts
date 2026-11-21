import http from './http'
import type { ConfigPreview, GameConfig, GameSummary, Limits } from '../types/game'

export interface ConfigDefaults {
  config: GameConfig
  weather_types: string[]
  person_types: string[]
  ingredient_names: string[]
  /** Every bound the server enforces; the config screen and the help read them from here. */
  limits: Limits
}

export async function getConfigDefaults(): Promise<ConfigDefaults> {
  return (await http.get<ConfigDefaults>('/config/defaults')).data
}

/**
 * The server's verdict on a draft config and every figure the config screen and its help
 * show for it (pack prices, spoilage, odds, charts, worked examples). The client works out none.
 */
export async function getConfigPreview(config: GameConfig): Promise<ConfigPreview> {
  return (await http.post<ConfigPreview>('/config/preview', config)).data
}

export interface UserStats {
  games_played: number
  days_played: number
  total_cups_sold: number
  total_visitors: number
  /** All cups sold ÷ all visitors (server); null with no visitors. */
  conversion: number | null
  total_profit: number
  best_profit: number | null
  avg_profit: number | null
  best_game_id: string | null
}

export interface GameListItem {
  public_id: string
  num_days: number
  days_played: number
  starting_cash: number
  final_cash: number
  total_profit: number
  total_visitors: number
  total_buyers: number
  total_sold_out: number
  final_popularity?: number | null
  /** Cups sold ÷ visitors (server); null with no visitors. */
  conversion: number | null
  /** ISO-8601 UTC with a `Z` (e.g. `2026-11-18T14:00:00Z`): `new Date()` parses it as UTC. */
  started_at: string
  finished_at: string
}

export async function getMyStats(): Promise<UserStats> {
  return (await http.get<UserStats>('/users/me/stats')).data
}

export async function getMyGames(page = 1, pageSize = 20): Promise<{ items: GameListItem[]; total: number }> {
  return (await http.get('/users/me/games', { params: { page, page_size: pageSize } })).data
}

export async function getMyGame(publicId: string): Promise<GameSummary> {
  return (await http.get<GameSummary>(`/users/me/games/${encodeURIComponent(publicId)}`)).data
}

/**
 * A finished game's results by its public id: open, no sign-in (the token is sent if there is
 * one, and changes nothing). The owner's detail without its settings or start time.
 */
export async function getGameResults(publicId: string): Promise<GameSummary> {
  return (await http.get<GameSummary>(`/games/id/${encodeURIComponent(publicId)}/results`)).data
}

export async function claimGuestGames(guestIdentity: string): Promise<number> {
  return (await http.post<{ claimed: number }>('/games/claim', { guest_identity: guestIdentity })).data.claimed
}
