import type { ReactElement, ReactNode } from 'react'
import { Citrus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

/** App chrome: brand, who you are, profile and sign-out. */
export default function Layout(props: { children: ReactNode; wide?: boolean }): ReactElement {
  const { firebaseUser, mode, logout } = useAuth()
  const navigate = useNavigate()
  const name = firebaseUser?.displayName ?? (mode === 'guest' ? 'Guest' : '')
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className={`mx-auto flex items-center gap-4 px-4 py-3 ${props.wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <Link to="/home" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <Citrus aria-hidden className="size-6 text-brand-strong" strokeWidth={2.5} /> Lemony
          </Link>
          <nav className="ml-auto flex items-center gap-3 text-sm">
            <Link to="/profile" className="rounded-md px-2 py-1 text-ink-muted hover:text-ink">
              Profile
            </Link>
            {firebaseUser?.photoURL ? (
              <img src={firebaseUser.photoURL} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
            ) : null}
            <span className="hidden text-ink-muted sm:inline">{name}</span>
            <button
              type="button"
              onClick={() => void logout().then(() => navigate('/'))}
              className="rounded-md border border-border px-2 py-1 text-ink-muted hover:border-brand-strong hover:text-ink"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-6 ${props.wide ? 'max-w-7xl' : 'max-w-5xl'}`}>{props.children}</main>
      <footer className="border-t border-border py-3 text-center text-xs text-ink-subtle">
        3D models: CC-BY-4.0 — see <Link to="/credits" className="underline">credits</Link>
      </footer>
    </div>
  )
}
