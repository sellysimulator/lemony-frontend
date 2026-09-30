import { create } from 'zustand'

export interface Alert {
  id: number
  kind: 'error' | 'info' | 'success'
  message: string
}

interface AlertStore {
  alerts: Alert[]
  push(kind: Alert['kind'], message: string): void
  dismiss(id: number): void
}

let nextId = 1

export const useAlerts = create<AlertStore>((set, get) => ({
  alerts: [],
  push(kind, message) {
    // Dedupe: a reconnect loop must not stack the same alert ten times.
    if (get().alerts.some((a) => a.message === message)) return
    const id = nextId++
    set((s) => ({ alerts: [...s.alerts, { id, kind, message }] }))
    setTimeout(() => get().dismiss(id), kind === 'error' ? 7000 : 4000)
  },
  dismiss(id) {
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }))
  },
}))
