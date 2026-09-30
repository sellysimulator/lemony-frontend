import { Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { discoverRoutes, type RouteGuard } from './routes/registry'
import AuthGuard from './components/shared/AuthGuard'
import BackendGuard from './components/shared/BackendGuard'
import NotFound from './components/shared/NotFound'

/** Auth outermost: an unidentified visitor is redirected before waiting on a cold backend. */
function withGuards(element: ReactElement, guard: RouteGuard): ReactElement {
  let wrapped = element
  if (guard === 'backend' || guard === 'auth+backend') wrapped = <BackendGuard>{wrapped}</BackendGuard>
  if (guard === 'auth' || guard === 'auth+backend') wrapped = <AuthGuard>{wrapped}</AuthGuard>
  return wrapped
}

/** Routes are discovered from `src/pages/*` (each exports `route`); no page is named here. */
export default function App(): ReactElement {
  return (
    <Routes>
      {discoverRoutes().map((d) => (
        <Route key={`${d.path}:${d.guard}`} path={d.path} element={withGuards(d.element, d.guard)} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
