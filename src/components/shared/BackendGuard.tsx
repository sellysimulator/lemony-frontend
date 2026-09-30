import type { ReactElement, ReactNode } from 'react'
import { useBackendStatus } from '../../contexts/BackendStatusContext'
import BackendWakeUp from './BackendWakeUp'

export default function BackendGuard(props: { children: ReactNode }): ReactElement {
  const { status } = useBackendStatus()
  if (status !== 'ok') return <BackendWakeUp />
  return <>{props.children}</>
}
