import type { Chart, Plugin } from 'chart.js'

type Listener = (index: number | null, source: Chart) => void

/** The index hovered or keyboard-selected across the charts of one screen. */
export interface CrosshairGroup {
  get(): number | null
  publish(index: number | null, source: Chart): void
  subscribe(listener: Listener): () => void
}

export function createCrosshairGroup(): CrosshairGroup {
  let current: number | null = null
  const listeners = new Set<Listener>()
  return {
    get: () => current,
    publish(index, source) {
      current = index
      for (const l of [...listeners]) l(index, source)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function pointCount(chart: Chart): number {
  return chart.data.labels?.length ?? Math.max(0, ...chart.data.datasets.map((d) => d.data.length))
}

function show(chart: Chart, index: number | null): void {
  const active = index === null || index >= pointCount(chart) ? [] : chart.data.datasets.map((_, datasetIndex) => ({ datasetIndex, index }))
  chart.setActiveElements(active)
  chart.tooltip?.setActiveElements(active, { x: 0, y: 0 })
  chart.update('none')
}

/**
 * Shares the hovered index between the charts that use the same group.
 * Arrow keys on a focused canvas move the index; Escape clears it.
 */
export function crosshairSync(group: CrosshairGroup): Plugin {
  const cleanups = new WeakMap<Chart, () => void>()
  return {
    id: 'crosshairSync',
    afterInit(chart) {
      const unsubscribe = group.subscribe((index, source) => {
        if (source !== chart) show(chart, index)
      })
      const canvas = chart.canvas
      const hadTabIndex = canvas.hasAttribute('tabindex')
      if (!hadTabIndex) canvas.tabIndex = 0
      const onKey = (e: KeyboardEvent): void => {
        const n = pointCount(chart)
        if (n === 0) return
        const now = group.get()
        let next: number | null
        if (e.key === 'ArrowRight') next = now === null ? 0 : Math.min(n - 1, now + 1)
        else if (e.key === 'ArrowLeft') next = now === null ? n - 1 : Math.max(0, now - 1)
        else if (e.key === 'Escape') next = null
        else return
        e.preventDefault()
        show(chart, next)
        group.publish(next, chart)
      }
      canvas.addEventListener('keydown', onKey)
      cleanups.set(chart, () => {
        unsubscribe()
        canvas.removeEventListener('keydown', onKey)
      })
    },
    afterEvent(chart, args) {
      const type = args.event.type
      if (type !== 'mousemove' && type !== 'mouseout') return
      const first = chart.getActiveElements()[0]
      const index = type === 'mouseout' ? null : (first?.index ?? null)
      if (index !== group.get()) group.publish(index, chart)
    },
    afterDestroy(chart) {
      cleanups.get(chart)?.()
      cleanups.delete(chart)
    },
  }
}
