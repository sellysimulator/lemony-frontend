import { useId, useState, type ReactElement, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

/** A field label with an optional info button beside it (kept outside the <label> so it is not part of the input's name). */
function FieldLabel(props: { htmlFor?: string; id?: string; children: ReactNode; info?: ReactNode }): ReactElement {
  return (
    <div className="flex min-h-7 items-center gap-1">
      {props.htmlFor ? (
        <label htmlFor={props.htmlFor} className="text-sm font-semibold">
          {props.children}
        </label>
      ) : (
        <span id={props.id} className="text-sm font-semibold">
          {props.children}
        </span>
      )}
      {props.info}
    </div>
  )
}

/** A number input that keeps whatever the player is typing and reports only valid numbers. */
export function NumberField(props: {
  label: ReactNode
  value: number
  onChange(value: number): void
  info?: ReactNode
  min?: number
  max?: number
  step?: number
  suffix?: string
  compact?: boolean
}): ReactElement {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className={props.compact ? '' : 'rounded-xl bg-surface-sunken/60 p-3'}>
      <FieldLabel htmlFor={id} info={props.info}>
        {props.label}
      </FieldLabel>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={draft ?? String(props.value)}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = Number(e.target.value)
            if (e.target.value.trim() !== '' && Number.isFinite(n)) props.onChange(n)
          }}
          onBlur={() => setDraft(null)}
          className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 tabular-nums focus:border-brand-strong focus:ring-2 focus:ring-brand/60 focus:outline-none"
        />
        {props.suffix ? <span className="text-sm font-semibold text-ink-muted">{props.suffix}</span> : null}
      </div>
    </div>
  )
}

export function RangeField(props: {
  label: ReactNode
  value: { min: number; max: number }
  onChange(value: { min: number; max: number }): void
  info?: ReactNode
  step?: number
  suffix?: string
}): ReactElement {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="rounded-xl bg-surface-sunken/60 p-3">
      <FieldLabel id={id} info={props.info}>
        {props.label}
      </FieldLabel>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <NumberField
          compact
          label="Min"
          value={props.value.min}
          step={props.step}
          suffix={props.suffix}
          onChange={(min) => props.onChange({ ...props.value, min })}
        />
        <NumberField
          compact
          label="Max"
          value={props.value.max}
          step={props.step}
          suffix={props.suffix}
          onChange={(max) => props.onChange({ ...props.value, max })}
        />
      </div>
    </div>
  )
}

export function CheckboxField(props: { label: ReactNode; checked: boolean; onChange(checked: boolean): void; info?: ReactNode }): ReactElement {
  const id = useId()
  return (
    <div className="flex min-h-11 items-center gap-1">
      <label htmlFor={id} className="-ml-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-surface-sunken">
        <input id={id} type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} className="size-5 accent-yellow-600" />
        {props.label}
      </label>
      {props.info}
    </div>
  )
}

/**
 * A header button that shows and hides its content. Content stays mounted
 * (just hidden) so half-typed values survive a collapse. Anything in `info`
 * sits beside the button, not inside it, so opening help never toggles.
 */
function useDisclosure(defaultOpen: boolean) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const toggle = {
    type: 'button' as const,
    'aria-expanded': open,
    'aria-controls': id,
    onClick: () => setOpen(!open),
  }
  return { open, id, toggle }
}

function Chevron(props: { open: boolean }): ReactElement {
  return <ChevronRight aria-hidden className={`size-5 shrink-0 text-ink-muted transition-transform duration-200 ${props.open ? 'rotate-90' : ''}`} />
}

/** A bordered group inside a section: one weather, customer type or ingredient. */
export function SubCard(props: { title: ReactNode; aside?: ReactNode; collapsible?: boolean; defaultOpen?: boolean; children: ReactNode }): ReactElement {
  const d = useDisclosure(props.defaultOpen ?? true)
  const open = !props.collapsible || d.open
  const heading = (
    <>
      {props.collapsible ? <Chevron open={open} /> : null}
      <span className="flex items-center gap-2 capitalize">{props.title}</span>
      {props.aside ? <span className="ml-auto text-sm font-semibold text-ink-muted tabular-nums">{props.aside}</span> : null}
    </>
  )
  return (
    <div className="rounded-xl border border-border">
      {props.collapsible ? (
        <button
          {...d.toggle}
          className="flex min-h-12 w-full items-center gap-2 rounded-xl px-4 py-3 text-left font-bold hover:bg-surface-sunken/60 focus-visible:outline-2 focus-visible:outline-brand-strong"
        >
          {heading}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-4 pt-4 font-bold">{heading}</div>
      )}
      <div id={d.id} hidden={!open} className={props.collapsible ? 'px-4 pt-1 pb-4' : 'p-4 pt-3'}>
        {props.children}
      </div>
    </div>
  )
}

export function Section(props: { title: string; icon?: ReactNode; info?: ReactNode; defaultOpen?: boolean; children: ReactNode }): ReactElement {
  const d = useDisclosure(props.defaultOpen ?? true)
  return (
    <section className="rounded-2xl border border-border bg-surface-raised shadow-sm">
      <div className="flex items-center gap-1 pr-4">
        <h2 className="min-w-0">
          <button
            {...d.toggle}
            className="flex min-h-14 items-center gap-2 rounded-2xl py-4 pr-2 pl-4 text-left text-xl font-bold hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-brand-strong"
          >
            <Chevron open={d.open} />
            {props.icon}
            {props.title}
          </button>
        </h2>
        {props.info}
      </div>
      <div id={d.id} hidden={!d.open} className="px-5 pb-5">
        {props.children}
      </div>
    </section>
  )
}
