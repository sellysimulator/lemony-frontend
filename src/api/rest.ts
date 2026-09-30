import http from './http'
import type { GameConfig, GameSummary } from '../types/game'

export interface ConfigDefaults {
  config: GameConfig
  weather_types: string[]
  person_types: string[]
  ingredient_names: string[]
  max_num_days: number
}

export async function getConfigDefaults(): Promise<ConfigDefaults> {
  return (await http.get<ConfigDefaults>('/config/defaults')).data
}

export async function validateConfig(config: GameConfig): Promise<{ valid: boolean; message: string | null }> {
  return (await http.post('/config/validate', config)).data
}

export interface UserStats {
  games_played: number
  days_played: number
  total_cups_sold: number
  total_visitors: number
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

export async function claimGuestGames(guestIdentity: string): Promise<number> {
  return (await http.post<{ claimed: number }>('/games/claim', { guest_identity: guestIdentity })).data.claimed
}
