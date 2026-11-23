/** The "Reconnecting…" notice shows only while a link that was up is down. */
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ReconnectingNotice from '../components/shared/ReconnectingNotice'
import { useConnection } from '../store/connection'

describe('ReconnectingNotice', () => {
  it('shows only after a link that was up dropped, and goes once it is back', () => {
    useConnection.setState({ connected: false, everConnected: false })
    render(<ReconnectingNotice />)
    expect(screen.queryByRole('status')).toBeNull() // still opening the first link
    act(() => useConnection.setState({ connected: true, everConnected: true }))
    expect(screen.queryByRole('status')).toBeNull()
    act(() => useConnection.setState({ connected: false }))
    expect(screen.getByRole('status').textContent).toBe('Connection lost. Reconnecting…')
    act(() => useConnection.setState({ connected: true }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
