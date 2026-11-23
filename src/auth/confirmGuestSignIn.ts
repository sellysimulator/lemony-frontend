import { useGameStore } from '../store/gameStore'
import type { AuthMode } from './AuthContext'

export const GUEST_GAME_STAYS_BEHIND =
  'You have a game in progress as a guest. It will not carry over to your Google account: after signing in it cannot be resumed. ' +
  'Finished games can be moved onto your account from your profile. Sign in anyway?'

/**
 * A guest with an unfinished game is asked before signing in: the live game belongs to the guest
 * identity, and the account starts without it (only finished games can be claimed). `true` means go on.
 */
export function confirmGuestSignIn(mode: AuthMode): boolean {
  const { state } = useGameStore.getState()
  if (mode !== 'guest' || !state || state.phase === 'finished') return true
  return confirm(GUEST_GAME_STAYS_BEHIND)
}
