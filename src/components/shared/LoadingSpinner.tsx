import type { ReactElement } from 'react'

export default function LoadingSpinner(props: { label?: string; size?: 'sm' | 'lg' }): ReactElement {
  const dim = props.size === 'lg' ? 'h-10 w-10 border-4' : 'h-5 w-5 border-2'
  return (
    <div role="status" className="flex flex-col items-center gap-3 text-ink-muted">
      <span className={`${dim} animate-spin rounded-full border-brand-soft border-t-brand-strong`} />
      {props.label ? <span className="text-sm">{props.label}</span> : null}
    </div>
  )
}
