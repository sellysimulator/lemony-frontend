import { useId, type ReactElement } from 'react'

export interface LegendItem {
  key: string
  label: string
  swatch: { kind: 'line' | 'fill'; color: string; dash?: number[]; pointStyle?: string; hatched?: boolean }
}

function Marker({ style, color }: { style: string; color: string }): ReactElement {
  const c = 12
  const y = 6
  switch (style) {
    case 'rect':
      return <rect x={c - 3.5} y={y - 3.5} width="7" height="7" fill={color} />
    case 'rectRot':
      return <rect x={c - 3.5} y={y - 3.5} width="7" height="7" fill={color} transform={`rotate(45 ${c} ${y})`} />
    case 'triangle':
      return <polygon points={`${c},${y - 4} ${c + 4},${y + 3} ${c - 4},${y + 3}`} fill={color} />
    case 'crossRot':
      return <path d={`M${c - 3.5} ${y - 3.5}L${c + 3.5} ${y + 3.5}M${c + 3.5} ${y - 3.5}L${c - 3.5} ${y + 3.5}`} stroke={color} strokeWidth="2" fill="none" />
    default:
      return <circle cx={c} cy={y} r="3.5" fill={color} />
  }
}

function Swatch({ swatch }: { swatch: LegendItem['swatch'] }): ReactElement {
  const patternId = `legend-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  if (swatch.kind === 'line') {
    return (
      <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true" className="shrink-0">
        <line
          x1="0"
          y1="6"
          x2="24"
          y2="6"
          stroke={swatch.color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={swatch.dash && swatch.dash.length > 0 ? swatch.dash.join(' ') : undefined}
        />
        {swatch.pointStyle ? <Marker style={swatch.pointStyle} color={swatch.color} /> : null}
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0 rounded-xs">
      {swatch.hatched ? (
        <defs>
          <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={swatch.color} />
            <line x1="0" y1="0" x2="0" y2="6" strokeWidth="1.5" stroke="#ffffff" />
          </pattern>
        </defs>
      ) : null}
      <rect width="12" height="12" fill={swatch.hatched ? `url(#${patternId})` : swatch.color} />
    </svg>
  )
}

interface LegendProps {
  items: LegendItem[]
  /** Keys of the series currently hidden. With `onToggle`, items become switches. */
  hidden?: ReadonlySet<string>
  onToggle?(key: string): void
  /** Hover or focus on an item (its key), and leaving it (null). */
  onFocusItem?(key: string | null): void
}

/** DOM legend: a swatch and a label per item; switches when toggling is wired up. */
export default function Legend({ items, hidden, onToggle, onFocusItem }: LegendProps): ReactElement {
  const toggleable = onToggle !== undefined
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {items.map((item) => {
        const off = hidden?.has(item.key) ?? false
        const content = (
          <>
            <Swatch swatch={item.swatch} />
            <span className={off ? 'line-through' : undefined}>{item.label}</span>
          </>
        )
        return (
          <li key={item.key} className="text-sm text-ink-muted" onMouseEnter={() => onFocusItem?.(item.key)} onMouseLeave={() => onFocusItem?.(null)}>
            {toggleable ? (
              <button
                type="button"
                role="switch"
                aria-checked={!off}
                onClick={() => onToggle(item.key)}
                onFocus={() => onFocusItem?.(item.key)}
                onBlur={() => onFocusItem?.(null)}
                className={`flex min-h-6 items-center gap-2 ${off ? 'opacity-60' : ''}`}
              >
                {content}
              </button>
            ) : (
              <span className="flex items-center gap-2">{content}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
