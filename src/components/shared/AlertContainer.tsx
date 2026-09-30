import type { ReactElement } from 'react'
import { X } from 'lucide-react'
import { useAlerts } from '../../store/alerts'

const STYLE = {
  error: 'border-bad/40 bg-red-50 text-bad',
  info: 'border-border bg-surface-raised text-ink',
  success: 'border-good/40 bg-green-50 text-good',
} as const

export default function AlertContainer(): ReactElement {
  const { alerts, dismiss } = useAlerts()
  return (
    <div aria-live="assertive" className="pointer-events-none fixed top-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {alerts.map((a) => (
        <div key={a.id} role="alert" className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${STYLE[a.kind]}`}>
          <span className="flex-1">{a.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(a.id)} className="-m-1 rounded p-1 hover:bg-black/5">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
