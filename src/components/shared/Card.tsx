import type { ReactElement, ReactNode } from 'react'

export default function Card(props: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }): ReactElement {
  return (
    <section className={`rounded-2xl border border-border bg-surface-raised p-5 shadow-sm ${props.className ?? ''}`}>
      {props.title || props.actions ? (
        <div className="mb-3 flex items-center gap-2">
          {props.title ? <h2 className="text-lg font-bold">{props.title}</h2> : null}
          <div className="ml-auto">{props.actions}</div>
        </div>
      ) : null}
      {props.children}
    </section>
  )
}

export function Stat(props: { label: string; value: ReactNode; tone?: 'good' | 'bad' | 'neutral'; hint?: string }): ReactElement {
  const tone = props.tone === 'good' ? 'text-good' : props.tone === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <div className="rounded-xl bg-surface-sunken/60 px-3 py-2" title={props.hint}>
      <div className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{props.label}</div>
      <div className={`text-xl font-extrabold tabular-nums ${tone}`}>{props.value}</div>
    </div>
  )
}
