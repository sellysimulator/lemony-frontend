import { create } from 'zustand'

/**
 * The socket's link to the server, written only by `socketHandlers`. `everConnected`
 * tells a dropped link (show "Reconnecting…") from one still being opened.
 */
interface ConnectionState {
  connected: boolean
  everConnected: boolean
}

export const useConnection = create<ConnectionState>(() => ({ connected: false, everConnected: false }))

/** True while a link that was up is down: the client is reconnecting. */
export function useReconnecting(): boolean {
  return useConnection((s) => s.everConnected && !s.connected)
}
