import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Select, { type SelectOption } from '../components/shared/Select'

const OPTIONS: SelectOption[] = [
  { value: 'sunny', label: 'Sunny' },
  { value: 'rainy', label: 'Rainy' },
  { value: 'cloudy', label: 'Cloudy', disabled: true, detail: 'Not today' },
]

function Harness(props: { onChange?: (v: string) => void }): ReactElement {
  const [value, setValue] = useState<string | null>('sunny')
  return (
    <Select
      aria-label="Weather"
      value={value}
      options={OPTIONS}
      onChange={(v) => {
        setValue(v)
        props.onChange?.(v)
      }}
    />
  )
}

describe('Select', () => {
  it('opens on click and picks an option', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const trigger = screen.getByRole('combobox', { name: 'Weather' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('option', { name: /Rainy/ }))
    expect(onChange).toHaveBeenCalledWith('rainy')
    expect(trigger).toHaveTextContent('Rainy')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('chooses with the keyboard', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    screen.getByRole('combobox').focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('rainy')
  })

  it('lists a disabled option with its reason but cannot choose it', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('combobox'))
    const disabled = screen.getByRole('option', { name: /Cloudy/ })
    expect(disabled).toHaveAttribute('aria-disabled', 'true')
    expect(disabled).toHaveTextContent('Not today')
    await userEvent.click(disabled)
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard('{End}{Enter}')
    expect(onChange).toHaveBeenCalledWith('rainy')
  })
})
