import type { ReactElement } from 'react'
import Layout from '../components/shared/Layout'
import { MODEL_CREDITS } from '../components/board3d/credits'
import type { RouteDescriptor } from '../routes/registry'

function CreditsPage(): ReactElement {
  return (
    <Layout>
      <h1 className="text-2xl font-bold">Credits</h1>
      <p className="mt-2 text-ink-muted">3D models used in the 3D view, all licensed CC-BY-4.0.</p>
      <ul className="mt-4 space-y-2">
        {MODEL_CREDITS.map((c) => (
          <li key={c.file} className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm">
            <a href={c.source} target="_blank" rel="noreferrer" className="font-semibold underline">
              {c.title}
            </a>{' '}
            by {c.author} — <a href="http://creativecommons.org/licenses/by/4.0/" className="underline" target="_blank" rel="noreferrer">CC-BY-4.0</a>
          </li>
        ))}
      </ul>
    </Layout>
  )
}

export const route: RouteDescriptor = { path: '/credits', guard: 'public', element: <CreditsPage /> }
