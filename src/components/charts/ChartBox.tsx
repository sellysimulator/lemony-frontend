import { useState, type ReactElement, type ReactNode } from 'react'

/** A titled chart with a one-click table view of the same numbers. */
export default function ChartBox(props: { title: string; children: ReactNode; table: { head: string[]; rows: (string | number)[][] }; height?: number }): ReactElement {
  const [asTable, setAsTable] = useState(false)
  return (
    <figure className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
      <figcaption className="mb-2 flex items-center">
        <span className="font-bold">{props.title}</span>
        <button type="button" onClick={() => setAsTable(!asTable)} className="ml-auto text-xs text-ink-muted underline">
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </figcaption>
      {asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr>
                {props.table.head.map((h) => (
                  <th key={h} className="border-b border-border px-2 py-1 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.table.rows.map((r, i) => (
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
        </div>
      ) : (
        <div style={{ height: props.height ?? 240 }}>{props.children}</div>
      )}
    </figure>
  )
}
