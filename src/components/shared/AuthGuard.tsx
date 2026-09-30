import { Navigate, useLocation } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'
import { useAuth } from '../../auth/AuthContext'
import LoadingSpinner from './LoadingSpinner'

/** No identity chosen yet → back to the welcome screen, remembering where they were going. */
export default function AuthGuard(props: { children: ReactNode }): ReactElement {
  const { mode, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Checking your sign-in" />
      </div>
    )
  }
  if (mode === null) return <Navigate to="/" replace state={{ from: location }} />
  return <>{props.children}</>
}
