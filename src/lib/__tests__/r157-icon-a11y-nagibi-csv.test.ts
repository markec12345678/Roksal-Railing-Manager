// R157 — testi (dostopnost ikonskih gumbov + izvoz nagibov v CSV).
// ---------------------------------------------------------------------------
//   • REGRESIJSKI STRAŽAR: vsak <Button> SAMO z ikono (brez vidnega besedila)
//     v src/components/roksal MORA imeti aria-label ali aria-labelledby —
//     bralniki zaslona in uporabniki tipkovnice ne morejo ugotoviti, kaj gumb
//     počne (vzorec, ki ga je R157 odpravil na 20 mestih; R156 je istega
//     zaprl na CRM zavihku).
//   • lib/nagibi-csv: BOM, glava, escape navedkov, null/neznana smer →
//     prazen stolpec (iskrenost — brez ugibanja), deterministično ime
//     datoteke, fail-closed na pokvarjenih podatkih.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildNagibiCsv, nagibiCsvFilename, type NagibiCsvRow } from '@/lib/nagibi-csv'

// ---------------------------------------------------------------------------
// 1) A11Y STRAŽAR — ikonski gumbi brez aria-label
// ---------------------------------------------------------------------------

/** Poišče konec JSX odpiralnega taga <Button …>, preskoči {} izraze in navedke. */
function findOpeningTagEnd(src: string, start: number): number {
  let i = start
  let depth = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '{') depth += 1
    else if (c === '}') depth -= 1
    else if ((c === '"' || c === "'") && depth === 0) {
      const q = c
      i += 1
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') i += 1
        i += 1
      }
    } else if (c === '>' && depth === 0) return i
    i += 1
  }
  return -1
}

/** Ima otrok <Button> vidno besedilo (besedilna vozlišča, fragmenti, {nizi})? */
function hasVisibleText(child: string): boolean {
  let i = 0
  let depthBrace = 0
  let inFragment = false
  let text = ''
  const n = child.length
  while (i < n) {
    const c = child[i]
    if (c === '{') {
      depthBrace += 1
      i += 1
      continue
    }
    if (c === '}') {
      depthBrace -= 1
      inFragment = false
      i += 1
      continue
    }
    if (c === '<') {
      if (depthBrace > 0 && child[i + 1] === '>') {
        inFragment = true
        i += 2
        continue
      }
      if (depthBrace > 0 && child[i + 1] === '/' && child[i + 2] === '>') {
        inFragment = false
        i += 3
        continue
      }
      i += 1
      while (i < n && child[i] !== '>') {
        if (child[i] === '"' || child[i] === "'") {
          const q = child[i]
          i += 1
          while (i < n && child[i] !== q) i += 1
        }
        i += 1
      }
      i += 1
      continue
    }
    if ((c === '"' || c === "'" || c === '`') && depthBrace > 0) {
      const q = c
      i += 1
      const buf: string[] = []
      while (i < n && child[i] !== q) {
        if (child[i] === '\\') {
          i += 1
          if (i < n) {
            buf.push(child[i])
            i += 1
          }
          continue
        }
        buf.push(child[i])
        i += 1
      }
      text += buf.join('')
      i += 1
      continue
    }
    if (depthBrace === 0 || inFragment) text += c
    i += 1
  }
  if (/[A-Za-zžščćđŽŠČĆĐ]/.test(text)) return true
  // {action.label} — samostojen identifikator v {} izriše vrednost (besedilo)
  const stripped = child.replace(/<[^<>]*>/g, '')
  for (const m of stripped.matchAll(/\{\s*([A-Za-z_$][\w.$]*)\s*\}/g)) {
    if (!/^(true|false|null|undefined)$/.test(m[1])) return true
  }
  return false
}

function iconOnlyButtonsWithoutLabel(src: string): number[] {
  const lines: number[] = []
  let idx = 0
  for (;;) {
    const start = src.indexOf('<Button', idx)
    if (start === -1) break
    const after = start + '<Button'.length
    if (after < src.length && /[A-Za-z0-9_]/.test(src[after])) {
      idx = start + 1
      continue
    }
    const tagEnd = findOpeningTagEnd(src, start)
    if (tagEnd === -1) {
      idx = start + 1
      continue
    }
    const tag = src.slice(start, tagEnd + 1)
    if (!tag.includes('aria-label') && !tag.includes('aria-labelledby')) {
      const close = src.indexOf('</Button>', tagEnd)
      const child = close !== -1 ? src.slice(tagEnd + 1, close) : ''
      if (!hasVisibleText(child)) {
        lines.push(src.slice(0, start).split('\n').length)
      }
    }
    idx = tagEnd
  }
  return lines
}

describe('R157 regresijski stražar — ikonski gumbi morajo imeti aria-label', () => {
  it('noben ikonski <Button> v roksal komponentah ni brez aria-label/aria-labelledby', () => {
    const dir = join(process.cwd(), 'src', 'components', 'roksal')
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'))
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8')
      const lines = iconOnlyButtonsWithoutLabel(src)
      for (const line of lines) offenders.push(`${f}:${line}`)
    }
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 2) buildNagibiCsv — determinističen, iskren izvoz
// ---------------------------------------------------------------------------

const base: NagibiCsvRow = {
  kotStopinje: 2.34,
  smer: 'Y',
  lokacija: 'Talna plošča balkona',
  createdAt: '2026-09-26T08:30:00.000Z',
}

describe('R157 buildNagibiCsv', () => {
  it('vsebuje BOM, glavo in formatirane vrstice (sl-SI datum/ura, kot 1 decimalka)', () => {
    const { csv, vrstic } = buildNagibiCsv([base])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Datum,Ura,Kot (stopinje),Smer,Lokacija')
    expect(vrstic).toBe(1)
    // 2.34 → "2.3"; smer Y → Levo-desno
    expect(csv).toContain('2.3,"Levo-desno","Talna plošča balkona"')
  })

  it('je determinističen — dva klica na istih podatkih data enak izhod', () => {
    const a = buildNagibiCsv([base, { ...base, kotStopinje: 1.05, smer: 'X' }])
    const b = buildNagibiCsv([base, { ...base, kotStopinje: 1.05, smer: 'X' }])
    expect(a).toEqual(b)
  })

  it('neznana/null smer → PRAZEN stolpec (iskrenost, brez ugibanja)', () => {
    const { csv } = buildNagibiCsv([{ ...base, smer: null }])
    expect(csv).toContain(',"",')
    const { csv: csv2 } = buildNagibiCsv([{ ...base, smer: 'Z' }])
    expect(csv2).toContain(',"",')
  })

  it('escape navedkov v lokaciji (CSV injekcija varna)', () => {
    const { csv } = buildNagibiCsv([{ ...base, lokacija: 'Tratnikov "posebni" kot' }])
    expect(csv).toContain('"Tratnikov ""posebni"" kot"')
  })

  it('null lokacija → prazen, ne "null" besedilo', () => {
    const { csv } = buildNagibiCsv([{ ...base, lokacija: null }])
    expect(csv).not.toContain('"null"')
  })

  it('prazno polje → samo glava, vrstic 0', () => {
    const { csv, vrstic } = buildNagibiCsv([])
    expect(csv).toBe('\uFEFFDatum,Ura,Kot (stopinje),Smer,Lokacija')
    expect(vrstic).toBe(0)
  })

  it('fail-closed: pokvarjen datum ali ne-finite kot → TypeError (ne tiho pokvarjen CSV)', () => {
    expect(() => buildNagibiCsv([{ ...base, createdAt: 'ni-datum' }])).toThrow(TypeError)
    expect(() => buildNagibiCsv([{ ...base, kotStopinje: Number.NaN }])).toThrow(TypeError)
    expect(() => buildNagibiCsv('ne-polje' as unknown as NagibiCsvRow[])).toThrow(TypeError)
  })
})

describe('R157 nagibiCsvFilename', () => {
  it('deterministično ime: nagibi_<projectId>_<YYYY-MM-DD>.csv', () => {
    expect(nagibiCsvFilename('proj-123', '2026-09-26')).toBe('nagibi_proj-123_2026-09-26.csv')
  })

  it('fail-closed: brez projectId ali slaba oblika datuma → TypeError', () => {
    expect(() => nagibiCsvFilename('', '2026-09-26')).toThrow(TypeError)
    expect(() => nagibiCsvFilename('proj', '26.09.2026')).toThrow(TypeError)
    expect(() => nagibiCsvFilename('proj', 'ne-datum')).toThrow(TypeError)
  })
})
