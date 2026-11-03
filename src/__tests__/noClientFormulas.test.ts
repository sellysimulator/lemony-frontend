/**
 * The server is the one source of every game rule and figure: no file under `src/` other
 * than `src/__tests__/` brings back a formula the client used to copy from it. Each
 * pattern below is one of the copies that was removed (the demand maths, pack prices,
 * the plan's spend, cash and margin, the popularity factor, success rates, the refusals
 * per hour, the spoilage total, the playback's sales and stock, the money rounding).
 * The scanner is tested on in-memory files first, so the scan over `src/` cannot pass
 * merely because it scans nothing.
 */
import { describe, expect, it } from 'vitest'

interface SourceFile {
  path: string
  text: string
}

const COPIES: [string, RegExp][] = [
  ['a module of client game maths', /from '[./]*(game\/configMath|game\/costing|utils\/money)'/],
  ['the money rounding rule', /\broundCents\b|toPrecision\(12\)/],
  ['a pack price', /\bpackPrice\(|unit_cost\s*\*|\*\s*\w*\.?unit_cost\b/],
  ['the plan spend', /\bpurchaseCost\(/],
  ['the demand maths', /\b(buyProbability|willingnessToPay|expectedSpawn|spawnBonus|ingredientScore|buyDecision|refusalReason|applyPopularity|weatherOdds|cheapFloor)\(/],
  ['the spoilage maths', /\b(hazard|survival)\([^)]*,/],
  // Code, not the help's prose ("multiplied by 0.5 + popularity").
  ['the popularity factor', /0\.5\s*\+\s*(\w+\.)+popularity|\(0\.5\s*\+\s*\w\)|(\w+\.)+popularity\s*\+\s*0\.5/],
  ['a success rate', /\.buyers\s*\/|\btotal_buyers\s*\/|total_cups_sold\s*\//],
  ['the refusals or non-buyers per hour', /\.visitors\s*-\s*[\w.]*buyers/],
  ['the cash after spending', /\.cash\s*-\s*\w/],
  ['a margin per cup', /\bprice\s*-\s*[\w.]*cost_per_cup|price\s*-\s*costPerCup|price\s*-\s*c\.cost_per_cup/],
  ['the sales during a day', /\.buyers\s*\*\s*[\w.]*price|\*\s*props\.price/],
  ['a cash change', /cash_end\s*-|\]\s*-\s*spans\[/],
  ['a sum of day money', /\.reduce\([^\n]*(perished_value|revenue|spend|profit)/],
  ['stock used by the cups sold', /\bperCup\b|buyers\s*\*\s*perCup/],
]

/** `path: what` for every copy found. */
function findCopies(files: SourceFile[]): string[] {
  return files.flatMap((f) => COPIES.filter(([, re]) => re.test(f.text)).map(([what]) => `${f.path}: ${what}`))
}

/** Every source file under `src/` except the tests, as text, with paths relative to `src/`. */
function listSources(): SourceFile[] {
  const raw = import.meta.glob<string>('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
  return Object.entries(raw)
    .map(([path, text]) => ({ path: path.replace(/^\.\.\//, ''), text }))
    .filter((f) => !f.path.startsWith('__tests__/'))
}

describe('the formula scanner', () => {
  it.each([
    ["import { packPrice } from '../game/configMath'", 'a module of client game maths'],
    ['const c = roundCents(v)', 'the money rounding rule'],
    ['const p = pack.size * cfg.unit_cost * (1 - pack.discount)', 'a pack price'],
    ['const cost = purchaseCost(cfg, purchases)', 'the plan spend'],
    ['const c = buyProbability(p, price, wtp)', 'the demand maths'],
    ['const h = hazard(cfg, i + 1)', 'the spoilage maths'],
    ['`×${(0.5 + state.popularity).toFixed(2)}`', 'the popularity factor'],
    ['pct(s.total_buyers / s.total_visitors)', 'a success rate'],
    ['h.visitors - h.buyers - h.sold_out', 'the refusals or non-buyers per hour'],
    ['const cashLeft = state.cash - cost', 'the cash after spending'],
    ['const margin = price - costPerCup', 'a margin per cup'],
    ['money(t.buyers * props.price)', 'the sales during a day'],
    ['money(d.cash_end - before)', 'a cash change'],
    ['days.reduce((sum, d) => sum + d.perished_value, 0)', 'a sum of day money'],
    ['const perCup = { ...recipe, cups: 1 }', 'stock used by the cups sold'],
  ])('flags %s', (text, what) => {
    expect(findCopies([{ path: 'x.tsx', text }])).toEqual([`x.tsx: ${what}`])
  })

  it('passes display formatting, layout, chart scales and prose', () => {
    const text = [
      'hint="Every buy chance today is multiplied by 0.5 + popularity, up to 100%."',
      'const pctText = `${Math.round(n * 100)}%`',
      'const width = props.max > 0 ? (props.value / props.max) * 100 : 0',
      'const share = opening[n] > 0 ? stock[n] / opening[n] : 0',
      'money(record.revenue)',
      'pct(d.conversion)',
    ].join('\n')
    expect(findCopies([{ path: 'ok.tsx', text }])).toEqual([])
  })
})

describe('src/', () => {
  const sources = listSources()

  it('scans real files: the plan screen, the help, the charts and the playback', () => {
    const paths = sources.map((s) => s.path)
    for (const p of ['components/plan/PlanDay.tsx', 'components/config/docs/entries.tsx', 'components/charts/endgame/config.ts', 'components/day/Hud.tsx'])
      expect(paths).toContain(p)
    expect(paths.some((p) => p.startsWith('__tests__'))).toBe(false)
  })

  it('copies no formula from the server', () => {
    expect(findCopies(sources)).toEqual([])
  })
})
