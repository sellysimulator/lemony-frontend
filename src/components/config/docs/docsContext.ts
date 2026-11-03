import { createContext } from 'react'
import type { GameConfig, Limits } from '../../../types/game'

/** The config being edited and the server's limits, so help examples reflect the player's values and the real bounds. */
export const DocsConfigContext = createContext<{ config: GameConfig; limits: Limits } | null>(null)
