import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PlanDay from '../components/plan/PlanDay'
import { planningState } from './fixtures/gameState'

vi.mock('../api/socketHandlers', () => ({ submitDay: vi.fn() }))

describe('PlanDay price', () => {
  it('lets go of focus on a mouse wheel, so scrolling cannot step the price', () => {
    render(<PlanDay state={planningState()} />)
    const input = screen.getByLabelText('Price per cup ($)')
    input.focus()
    expect(document.activeElement).toBe(input)
    fireEvent.wheel(input)
    expect(document.activeElement).not.toBe(input)
  })
})
