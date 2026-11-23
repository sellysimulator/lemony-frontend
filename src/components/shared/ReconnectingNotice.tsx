import type { ReactElement } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useReconnecting } from '../../store/connection'

/**
 * A small, non-blocking notice while a link that was up is down. The socket retries on its own
 * (it never gives up), and the game waits on the server, so there is nothing to click.
 */
export default function ReconnectingNotice(): ReactElement | null {
  const reconnecting = useReconnecting()
  if (!reconnecting) return null
  return (
    <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface-sunken px-4 py-2 text-sm text-ink">
      <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-warn" />
      <span>Connection lost. Reconnecting…</span>
    </div>
  )
}
