// ---------------------------------------------------------------------------
// R254 (P1-d) — IKONSKI aria-hidden DETEKTOR + IZJEME-AUDIT — testi.
// Codemod R254 je vstavil aria-hidden="true" na 1114 lucide ikon v 80
// datotekah (detektor: 1373 pokritih / 0 manjkajočih; izjeme-audit: 0
// ikona-samo interaktivnih elementov brez aria-label na staršu). Ta test
// sta TRAJNA zaščita:
//  • detektor: VSAKA lucide ikona v src/**/*.tsx mora imeti aria-hidden
//    (dekorsijske ikone so izven screen-reader drevesa — enak jezik kot
//    ostali aria-hidden že od začetka);
//  • izjeme-audit: ikona-samo interaktivni element (<button>/<a>, vsebina =
//    samo ikona) MORA imeti aria-label na odpiralni oznaki — sicer bi
//    aria-hidden odvzel dostopno ime kontrolniku (edina zakonska izjema).
// Skener je oznaka-zaveden: string literali, template literali in JSX izrazi
// {…} znotraj oznake se preskočijo; večvrstične oznake so pokrite.
// WYSIWYG vir resnice: niz mora biti dobesedno iz virov (r254 lekcija: needle
// = dobeseden izvleček, ne parafraza).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(process.cwd(), 'src')

function zberiTsx(dir: string): string[] {
  const out: string[] = []
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...zberiTsx(p))
    else if (f.endsWith('.tsx')) out.push(p)
  }
  return out
}

function lucideImena(src: string): Set<string> {
  const imena = new Set<string>()
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    // R321 — SLEPA PEGA ZAPRTA (odkrita v R319 pri dekompoziciji
    // measurements): vejica v uvoznem komentarju je razdelila blok pri
    // split(',') in ikona postala NEVIDNA stražarju (primer: 5 ikon v
    // measurements-tab, 3 v dashboard-tab). ISTI popravek kot v
    // r254-aria-detektor.py in r254-aria-codemod.py — enaka logika v treh
    // virih (kanon ENA resnica).
    const blok = m[1].replace(/\/\/[^\n]*/g, '')
    for (const part of blok.split(',')) {
      const ime = part.trim().split(' as ').pop()!.trim()
      if (/^[A-Z][A-Za-z0-9]*$/.test(ime)) imena.add(ime)
    }
  }
  return imena
}

/** True = `<Ime` v tip/generik poziciji (useState<Layers>) — NI JSX uporaba
 *  ikone (r254 lekcija; ISTI guard kot v r254-aria-codemod.py: znak pred `<`
 *  je identifier znak → generic, ne oznaka). */
function jeTipPozicija(src: string, start: number): boolean {
  if (start <= 0) return false
  return /[A-Za-z0-9_$]/.test(src[start - 1])
}

/** Indeks ZA zaključkom odpiralne JSX oznake, ki se začne na `start` ('<'). */
function scanTag(src: string, start: number): number {
  let i = start + 1
  let braceGlobina = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '"' || c === "'") {
      const q = c
      i++
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (c === '`') {
      i++
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (c === '{') braceGlobina++
    if (c === '}') braceGlobina--
    if (braceGlobina === 0) {
      if (c === '>' && i > start && src[i - 1] === '/') return i + 1
      if (c === '>') return i + 1
    }
    i++
  }
  return -1
}

/** Indeks ZA zaključnim </tag> — globinsko štetje ujemajočih parov. */
function scanPair(src: string, openStart: number, tag: string): number {
  const re = new RegExp(`</${tag}>|<${tag}\\b`, 'g')
  let globina = 0
  re.lastIndex = openStart
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (m[0].startsWith('</')) {
      globina--
      if (globina === 0) return m.index + m[0].length
    } else {
      const end = scanTag(src, m.index)
      if (end > 0 && src.slice(end - 2, end) === '/>') continue
      globina++
    }
  }
  return -1
}

interface Kršitev { datoteka: string; vrstica: number; ikona: string }
interface Izjema { datoteka: string; vrstica: number; element: string; ikona: string }

function preglej(): { krsitve: Kršitev[]; izjeme: Izjema[]; pokrite: number } {
  const krsitve: Kršitev[] = []
  const izjeme: Izjema[] = []
  let pokrite = 0
  const datoteke = zberiTsx(SRC).sort()
  for (const pot of datoteke) {
    const rel = pot.slice(pot.indexOf('src'))
    const src = readFileSync(pot, 'utf8')
    const imena = lucideImena(src)
    for (const ime of imena) {
      const re = new RegExp(`<${ime}\\b`, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        if (jeTipPozicija(src, m.index)) continue
        const end = scanTag(src, m.index)
        if (end === -1) continue
        const oznaka = src.slice(m.index, end)
        if (/aria-hidden(\s*=|\s*>)/.test(oznaka)) {
          pokrite++
        } else {
          const vrstica = src.slice(0, m.index).split('\n').length
          krsitve.push({ datoteka: rel, vrstica, ikona: ime })
        }
      }
    }
    // izjeme-audit: ikona-samo <button>/<a> brez aria-label
    for (const m of src.matchAll(/<(button|a)\b/g)) {
      if (jeTipPozicija(src, m.index)) continue
      const openEnd = scanTag(src, m.index)
      if (openEnd === -1) continue
      const closeEnd = scanPair(src, m.index, m[1])
      if (closeEnd === -1) continue
      const openTag = src.slice(m.index, openEnd)
      const vsebina = src.slice(openEnd, closeEnd)
      const ikone = [...imena].filter((ime) => new RegExp(`<${ime}\\b`).test(vsebina))
      if (ikone.length !== 1) continue
      const brezIkone = vsebina.replace(
        // brez 's' flaga (es2018 target — TS1501): [\s\S] pokrije večvrstično
        /<[A-Z][A-Za-z0-9]*\b[^>]*(\/>|>[\s\S]*?<\/[A-Z][A-Za-z0-9]*>)/g,
        '',
      )
      if (/\S/.test(brezIkone)) continue
      if (!/aria-label\s*=/.test(openTag)) {
        const vrstica = src.slice(0, m.index).split('\n').length
        izjeme.push({ datoteka: rel, vrstica, element: m[1], ikona: ikone[0] })
      }
    }
  }
  return { krsitve, izjeme, pokrite }
}

const lib = readFileSync(join(process.cwd(), 'scripts/r254-aria-codemod.py'), 'utf8')
const detektor = readFileSync(join(process.cwd(), 'scripts/r254-aria-detektor.py'), 'utf8')

describe('R254 — detektor: VSAKA lucide ikona v src ima aria-hidden (P1-d, 1114 mest codemod)', () => {
  it('ni ikon brez aria-hidden="true" (codemod R254: 1373 pokritih — tla nad 1300, da skener ne tiho prazna)', () => {
    const { krsitve, pokrite } = preglej()
    expect(krsitve).toEqual([])
    expect(pokrite).toBeGreaterThan(1300)
  })

  it('izjeme-audit: ikona-samo interaktivni elementi VEDNO z aria-label na staršu (0 izjem ob R254)', () => {
    const { izjeme } = preglej()
    expect(izjeme).toEqual([])
  })

  it('skripti (python) obstajata v repozitoriju — codemod + detektor sta PERZISTENTNA orodja, ne enkratna roka', () => {
    expect(lib).toContain('def codemod_file')
    expect(lib).toContain("aria-hidden=\"true\"")
    expect(detektor).toContain('def main')
    expect(detektor).toContain("'manjkajoci'")
  })
})
