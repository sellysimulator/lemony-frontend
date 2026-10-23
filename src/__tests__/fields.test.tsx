import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NumberField, RangeField } from '../components/config/fields'

describe('NumberField', () => {
  it('reports what is typed after clearing, and never an empty or partial value', async () => {
    const onChange = vi.fn()
    render(<NumberField label="Starting cash" value={1} onChange={onChange} />)
    const input = screen.getByLabelText('Starting cash')
    await userEvent.clear(input)
    await userEvent.type(input, '22')
    expect(input).toHaveValue(22)
    expect(onChange.mock.calls.map(([v]) => v)).toEqual([2, 22])
    expect(onChange.mock.calls.every(([v]) => Number.isFinite(v))).toBe(true)
  })

  it('does not report a cleared field; leaving it shows the last valid value again', async () => {
    const onChange = vi.fn()
    render(<NumberField label="Starting cash" value={100} onChange={onChange} />)
    const input = screen.getByLabelText('Starting cash')
    await userEvent.clear(input)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(input).toHaveValue(100)
  })

  it('lets go of focus on a mouse wheel, so scrolling cannot step the value', () => {
    render(<NumberField label="Starting cash" value={100} onChange={() => {}} />)
    const input = screen.getByLabelText('Starting cash')
    input.focus()
    expect(document.activeElement).toBe(input)
    fireEvent.wheel(input)
    expect(document.activeElement).not.toBe(input)
  })
})

describe('RangeField', () => {
  it('lets go of focus on a mouse wheel in either bound', () => {
    render(<RangeField label="Temperature" value={{ min: 0, max: 40 }} onChange={() => {}} />)
    for (const name of ['Min', 'Max']) {
      const input = screen.getByLabelText(name)
      input.focus()
      expect(document.activeElement).toBe(input)
      fireEvent.wheel(input)
      expect(document.activeElement).not.toBe(input)
    }
  })
})
