import { useContext, useState, type ReactElement } from 'react'
import { Info } from 'lucide-react'
import Modal from '../../shared/Modal'
import { DocsConfigContext } from './docsContext'
import { DOCS, type DocCtx, type DocKey } from './entries'

export default function InfoButton(props: { doc: DocKey } & Omit<DocCtx, 'config'>): ReactElement | null {
  const config = useContext(DocsConfigContext)
  const [open, setOpen] = useState(false)
  if (!config) return null
  const ctx: DocCtx = { config, person: props.person, ingredient: props.ingredient, weather: props.weather }
  const doc = DOCS[props.doc]
  const title = doc.title(ctx)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`About ${title}`}
        aria-haspopup="dialog"
        className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-full text-brand-strong transition-colors after:absolute after:-inset-2 hover:bg-brand-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-strong"
      >
        <Info aria-hidden className="size-[18px]" strokeWidth={2.5} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {doc.body(ctx)}
      </Modal>
    </>
  )
}
