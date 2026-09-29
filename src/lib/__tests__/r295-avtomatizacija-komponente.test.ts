// ---------------------------------------------------------------------------
// R295 — AVTOMATIZACIJA KOMPONENTNI SLOJ (issue #1 nadaljevanje) — strazar +
// pariteta pomožnikov.
//
// Strazar: (a) skener pregledajKomponente nad REALNIM drevesom src/components
// → 0 nedokumentiranih kršitev (komponentna migracija R294/R295 popolna —
// locale*/localeCompare NIČ v ARTIFACT domeni, Math.random samo prek izjem,
// AI gostitelji NIKOLI); (b) izjeme AVTOMATIZACIJA_IZJEME_KOMPONENTE vsaka z
// obveznim razlogom in obstoječo datoteko (izjema ne sme sanjati); (c)
// politika ARTIFACT domene: locale*/localeCompare se flagata SAMO v
// komponenti z jsPDF importom; (d) fail-closed: pokvarjen vhod → TypeError;
// (e) pariteta NOVIH pomožnikov csv-export (slMesecevaOkrajsava,
// slMesecevaOkrajsavaLeto, slMesecevaOkrajsavaUra, slDatumPolni) z ICU
// resnico node sl-SI — bajtno, vključno z 'maj' brez pike.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  pregledajKomponente,
  AVTOMATIZACIJA_IZJEME_KOMPONENTE,
} from '../avtomatizacija-audit'
import {
  slMesecevaOkrajsava,
  slMesecevaOkrajsavaLeto,
  slMesecevaOkrajsavaUra,
  slDatumPolni,
} from '../csv-export'

/** Zberi VSE komponente (tsx in ts) — ISTI obseg kot runda scan. */
function zberiKomponente(): { pot: string; vsebina: string }[] {
  const root = join(process.cwd(), 'src', 'components')
  const out: { pot: string; vsebina: string }[] = []
  const obiski = (dir: string, rel: string): void => {
    for (const f of readdirSync(dir)) {
      const cel = join(dir, f)
      if (statSync(cel).isDirectory()) obiski(cel, `${rel}/${f}`)
      else if (f.endsWith('.tsx') || f.endsWith('.ts'))
        out.push({ pot: `src/components${rel}/${f}`, vsebina: readFileSync(cel, 'utf8') })
    }
  }
  obiski(root, '')
  return out
}

describe('R295 — pregledajKomponente (politika komponentnega sloja)', () => {
  it('ARTIFACT domena (jsPDF import): locale klic je kršitev', () => {
    const kr = pregledajKomponente([
      {
        pot: 'src/components/roksal/testni.tsx',
        vsebina: "import jsPDF from 'jspdf'\nconst d = new Date().toLocaleDateString('sl-SI')\n",
      },
    ])
    expect(kr).toHaveLength(1)
    expect(kr[0].pot).toBe('src/components/roksal/testni.tsx')
    expect(kr[0].vzorec).toBe('locale-odvisni-izpis')
    expect(kr[0].vrstica).toBe(2)
  })

  it('ne-ARTIFACT komponenta (UI prikaz): locale klic NI kršitev (opazovalec zdaj)', () => {
    const kr = pregledajKomponente([
      {
        pot: 'src/components/roksal/cisto-ui.tsx',
        vsebina: "export const x = () => new Date().toLocaleDateString('sl-SI')\n",
      },
    ])
    expect(kr).toHaveLength(0)
  })

  it('izjema po TOČNI poti: dovoljeni vzorec ne flaga, drugi vzorci ostanejo aktivni', () => {
    const kr = pregledajKomponente([
      {
        pot: 'src/components/roksal/photo-tab.tsx',
        vsebina: "const id = Date.now() + Math.random()\nconst u = fetch('https://api.openai.com/v1/x')\n",
      },
    ])
    // Math.random = dovoljen (izjema), AI gostitelj = NIKOLI dovoljen
    expect(kr.map((k) => k.vzorec)).toEqual(['AI-API-gostitelj'])
  })

  it('SEAM pravilo: privzeta vrednost parametra ni kršitev', () => {
    const kr = pregledajKomponente([
      {
        pot: 'src/components/roksal/testni.tsx',
        vsebina: "import jsPDF from 'jspdf'\nfunction izpisi(now: Date = new Date()): void {\n  console.log(now)\n}\n",
      },
    ])
    expect(kr).toHaveLength(0)
  })

  it('fail-closed: ne-polje vhoda → TypeError', () => {
    expect(() => pregledajKomponente(null as unknown as readonly { pot: string; vsebina: string }[])).toThrow(TypeError)
    expect(() =>
      pregledajKomponente([{ pot: 42, vsebina: 'x' } as unknown as { pot: string; vsebina: string }]),
    ).toThrow(TypeError)
  })

  it('vsaka komponentna izjema ima razlog in obstoječo datoteko (izjema ne sme sanjati)', () => {
    expect(AVTOMATIZACIJA_IZJEME_KOMPONENTE.length).toBeGreaterThanOrEqual(6)
    for (const iz of AVTOMATIZACIJA_IZJEME_KOMPONENTE) {
      expect(iz.pot.startsWith('src/components/')).toBe(true)
      expect(iz.razlog.trim().length).toBeGreaterThan(10)
      expect(iz.dovoljeni.length).toBeGreaterThan(0)
      expect(() => statSync(join(process.cwd(), iz.pot))).not.toThrow()
    }
  })
})

describe('R295 — STRAŽAR: skener nad REALNIM drevesom src/components = 0 kršitev', () => {
  it('komponentna migracija (R294 WIP + R295 zaključek) je POPOLNA — 120+ datotek, 0 hitov', () => {
    const viri = zberiKomponente()
    expect(viri.length).toBeGreaterThanOrEqual(100)
    const kr = pregledajKomponente(viri)
    expect(kr).toEqual([])
  })
})

describe('R295 — pariteta novih pomožnikov z ICU resnico node sl-SI (bajtno)', () => {
  const primeri = [
    new Date(2026, 9, 15, 14, 30, 5),
    new Date(2026, 4, 15, 8, 5, 9),
    new Date(2026, 2, 5, 23, 59, 1),
    new Date(2027, 0, 1, 0, 0, 0),
  ]

  it('slMesecevaOkrajsava ≡ toLocaleDateString {day:numeric, month:short}', () => {
    for (const d of primeri) {
      expect(slMesecevaOkrajsava(d)).toBe(
        d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }),
      )
    }
    expect(slMesecevaOkrajsava(new Date(2026, 4, 15))).toBe('15. maj') // 'maj' brez pike
  })

  it('slMesecevaOkrajsavaLeto ≡ toLocaleDateString {day:numeric, month:short, year:2-digit}', () => {
    for (const d of primeri) {
      expect(slMesecevaOkrajsavaLeto(d)).toBe(
        d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: '2-digit' }),
      )
    }
    expect(slMesecevaOkrajsavaLeto(new Date(2026, 4, 15))).toBe('15. maj 26')
  })

  it('slMesecevaOkrajsavaUra ≡ toLocaleString {day:numeric, month:short, hour:2-digit, minute:2-digit} (vejica pred uro)', () => {
    for (const d of primeri) {
      expect(slMesecevaOkrajsavaUra(d)).toBe(
        d.toLocaleString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      )
    }
    expect(slMesecevaOkrajsavaUra(new Date(2026, 9, 15, 14, 30, 5))).toBe('15. okt., 14:30')
  })

  it('slDatumPolni ≡ toLocaleDateString {year:numeric, month:long, day:numeric}', () => {
    for (const d of primeri) {
      expect(slDatumPolni(d)).toBe(
        d.toLocaleDateString('sl-SI', { year: 'numeric', month: 'long', day: 'numeric' }),
      )
    }
    expect(slDatumPolni(new Date(2026, 9, 15))).toBe('15. oktober 2026')
  })

  it('pomembniki so deterministični f(datum) — dvakrat isti klic = bajtno isti niz', () => {
    const d = new Date(2026, 8, 21, 7, 3, 2)
    expect(slMesecevaOkrajsava(d)).toBe(slMesecevaOkrajsava(new Date(2026, 8, 21, 23, 59, 59)))
    expect(slMesecevaOkrajsavaUra(d)).toBe('21. sep., 07:03')
    expect(slMesecevaOkrajsavaLeto(d)).toBe('21. sep. 26')
  })
})
