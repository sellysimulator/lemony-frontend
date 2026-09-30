import { type ReactElement } from 'react'
import ErrorBoundary from '../shared/ErrorBoundary'
import Scene from './Scene'
import type { BoardProps } from '../day/types'

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Lazy-loaded (three + r3f + drei live in their own chunk). Falls back to 2D on any WebGL failure. */
export default function Board3D(props: BoardProps & { onFail(): void }): ReactElement {
  const { onFail, ...board } = props
  if (!webglAvailable()) {
    queueMicrotask(onFail)
    return <div />
  }
  return (
    <div className="relative aspect-[16/8] w-full overflow-hidden rounded-2xl border border-border">
      <ErrorBoundary fallback={<Fallback onFail={onFail} />}>
        <Scene {...board} />
      </ErrorBoundary>
      <p className="pointer-events-none absolute bottom-2 left-3 rounded bg-black/30 px-2 py-0.5 text-xs text-white">
        Drag to orbit · scroll to zoom
      </p>
    </div>
  )
}

function Fallback(props: { onFail(): void }): ReactElement {
  queueMicrotask(props.onFail)
  return <div className="p-6 text-center text-ink-muted">3D view unavailable — switching to 2D.</div>
}
