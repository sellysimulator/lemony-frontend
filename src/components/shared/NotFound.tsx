import type { ReactElement } from 'react'
import { Citrus } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFound(): ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <Citrus aria-hidden className="size-16 text-brand-strong" />
      <h1 className="text-2xl font-bold">This page squeezed out</h1>
      <Link to="/home" className="rounded-lg bg-brand px-4 py-2 font-semibold text-ink">
        Back home
      </Link>
    </div>
  )
}
