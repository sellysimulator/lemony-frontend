import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * A native <dialog>: the browser traps focus, closes on Escape and restores
 * focus to the opener. Content mounts only while open.
 */
export default function Modal(props: { open: boolean; onClose(): void; title: ReactNode; children: ReactNode }): ReactElement {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (props.open && !dialog.open) dialog.showModal()
    if (!props.open && dialog.open) dialog.close()
  }, [props.open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={props.onClose}
      // The dialog box is fully covered by its content, so a click on the dialog itself is a backdrop click.
      onClick={(e) => {
        if (e.target === ref.current) props.onClose()
      }}
      className="lemony-modal m-auto w-[min(44rem,calc(100vw-2rem))] max-w-none rounded-2xl border border-border bg-surface-raised p-0 text-ink shadow-2xl backdrop:bg-stone-900/50 backdrop:backdrop-blur-sm"
    >
      {props.open ? (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start gap-3 border-b border-border bg-brand-soft px-5 py-4">
            <h2 id={titleId} className="flex-1 text-xl font-extrabold">
              {props.title}
            </h2>
            <button
              type="button"
              onClick={props.onClose}
              aria-label="Close"
              className="-m-1 flex size-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-brand/40 focus-visible:outline-2 focus-visible:outline-brand-strong"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{props.children}</div>
        </div>
      ) : null}
    </dialog>
  )
}
