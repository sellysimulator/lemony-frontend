import { createContext } from 'react'
import type { ConfigPreview, GameConfig, Limits } from '../../../types/game'

/**
 * The config being edited, the server's limits, and the server's latest figures for it
 * (`POST /config/preview`), so help examples reflect the player's values and the real rules.
 * `preview` is the latest reply, which may be for an earlier edit (`stale`) or not have
 * arrived yet (null).
 */
export const DocsConfigContext = createContext<{ config: GameConfig; limits: Limits; preview: ConfigPreview | null; stale: boolean } | null>(null)
