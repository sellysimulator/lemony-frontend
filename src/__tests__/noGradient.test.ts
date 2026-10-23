/**
 * Flat fills only: no file under `src/` other than `src/__tests__/` contains
 * `gradient` (Tailwind `bg-gradient-*` / `bg-linear-*` utilities, CSS
 * `*-gradient()`, canvas `create*Gradient`). The scanner is tested on in-memory
 * files first, so the scan over `src/` cannot pass merely because it scans nothing.
 */
import { describe, expect, it } from 'vitest'

interface SourceFile {
  path: string
  text: string
}

/** The files whose text contains `gradient` or a Tailwind `bg-linear-*` / `bg-radial-*` / `bg-conic-*` utility. */
function findGradients(files: SourceFile[]): string[] {
  return files.filter((f) => /gradient|\bbg-(linear|radial|conic)-/i.test(f.text)).map((f) => f.path)
}

/** Every source file under `src/` except the tests, as text, with paths relative to `src/`. */
function listSources(): SourceFile[] {
  const raw = import.meta.glob<string>('../**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true })
  return Object.entries(raw)
    .map(([path, text]) => ({ path: path.replace(/^\.\.\//, ''), text }))
    .filter((f) => !f.path.startsWith('__tests__/'))
}

describe('the gradient scanner', () => {
  it('flags a Tailwind gradient utility in an in-memory file list', () => {
    const files: SourceFile[] = [
      { path: 'ok.tsx', text: '<div className="bg-surface rounded-lg" />' },
      { path: 'bad.tsx', text: '<div className="bg-gradient-to-b from-sky-200" />' },
      { path: 'v4.tsx', text: '<div className="bg-linear-to-b from-sky-200" />' },
    ]
    expect(findGradients(files)).toEqual(['bad.tsx', 'v4.tsx'])
  })

  it.each(['linear-gradient(red, blue)', 'createLinearGradient', 'RADIAL-GRADIENT(x)', 'bg-[repeating-linear-gradient(90deg,#fff_0_8px)]'])(
    'flags %s regardless of case',
    (text) => {
      expect(findGradients([{ path: 'x.css', text }])).toEqual(['x.css'])
    },
  )

  it('passes a clean list', () => {
    expect(findGradients([{ path: 'a.ts', text: 'const a = 1' }])).toEqual([])
  })
})

describe('src/', () => {
  const sources = listSources()

  it('scans real files, including the stylesheet, the pages and the 2D board', () => {
    const paths = sources.map((s) => s.path)
    expect(paths).toContain('index.css')
    expect(paths).toContain('pages/WelcomeScreen.tsx')
    expect(paths).toContain('components/board2d/Board2D.tsx')
    expect(paths.some((p) => p.startsWith('__tests__'))).toBe(false)
  })

  it('contains no gradient anywhere', () => {
    expect(findGradients(sources)).toEqual([])
  })
})
