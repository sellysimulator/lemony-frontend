import { Component, useState, type ReactElement, type ReactNode } from 'react'

export interface TableRows {
  head: string[]
  rows: (string | number)[][]
}

/** Turns the older `{ head, rows }` table into the node `ChartBox` shows. */
// eslint-disable-next-line react-refresh/only-export-components -- the kit's one table helper lives beside ChartBox
export function tableFromRows(t: TableRows): ReactElement {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr>
          {t.head.map((h) => (
            <th key={h} className="border-b border-border px-2 py-1 text-left font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {t.rows.map((r, i) => (
          <tr key={i} className="odd:bg-surface-sunken/40">
            {r.map((c, j) => (
              <td key={j} className="px-2 py-1">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Shows `fallback` once a descendant throws. */
class ChartErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

interface ChartBoxProps {
  title: string
  caption?: string
  /** Read out for the plot; defaults to the title. */
  ariaLabel?: string
  /** Plot height in px; defaults to 240. */
  height?: number
  /** A row under the title for choosing what the chart shows. */
  controls?: ReactNode
  legend?: ReactNode
  table: ReactNode | TableRows
  children: ReactNode
}

function isRows(t: ReactNode | TableRows): t is TableRows {
  return typeof t === 'object' && t !== null && !Array.isArray(t) && 'head' in t && 'rows' in t && Array.isArray((t as TableRows).head)
}

/** A titled chart with a one-click table view of the same numbers. */
export default function ChartBox({ title, caption, ariaLabel, height = 240, controls, legend, table, children }: ChartBoxProps): ReactElement {
  const [asTable, setAsTable] = useState(false)
  const tableNode = isRows(table) ? tableFromRows(table) : table
  return (
    <figure className="min-w-0 rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
      <figcaption className="mb-2 flex items-center">
        <span className="flex min-w-0 flex-col">
          <span className="font-bold">{title}</span>
          {caption ? <span className="text-xs text-ink-muted">{caption}</span> : null}
        </span>
        <button type="button" onClick={() => setAsTable(!asTable)} className="ml-auto text-xs text-ink-muted underline print:hidden">
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </figcaption>
      {controls ? <div className="mb-2 print:hidden">{controls}</div> : null}
      {legend ? <div className="mb-2">{legend}</div> : null}
      {asTable ? (
        <div className="max-h-72 overflow-auto">{tableNode}</div>
      ) : (
        <div role="img" aria-label={ariaLabel ?? title} className="relative" style={{ height }}>
          <ChartErrorBoundary fallback={<p className="text-sm text-ink-muted">The chart could not be drawn here. The same figures are in the table.</p>}>
            {children}
          </ChartErrorBoundary>
        </div>
      )}
    </figure>
  )
}
