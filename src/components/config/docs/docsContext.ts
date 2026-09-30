import { createContext } from 'react'
import type { GameConfig } from '../../../types/game'

/** The config being edited, so help examples and charts reflect the player's values. */
export const DocsConfigContext = createContext<GameConfig | null>(null)
