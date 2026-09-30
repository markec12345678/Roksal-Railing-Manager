// R317 — MANDATORY STIL val 8 (r162/…/R316 vzorec): IZVOZNA družina gumbov —
// focus-visible ring harmonizacija na roksal žetone.
//
// Motiv (sweep R317, 53 gumbov): ui/button BAZA nosi generičen
// focus-visible:ring-ring/50 — vsak gumb JE ima ring, IZVOZNA družina pa
// NOSI IZRECNE roksal žetone (49× navy/40; 2× amber/50 + offset — novi vodja
// gumbi R316 JSON + R317 CSV, bratska simetrija v isti blok glavi). Pred
// R317: site-survey PDF gumb je edini brez izrecnega žetona (speto na
// generično bazo) → harmoniziran na družinski kanon navy/40.
//
// R318 PIN SHIFT (48. člen): vodja blok glava dobi ČETRTI amber gumb (PDF
// brat CSV-ja — bratska simetrija; register ×3 → ×4 z obrnjeno regresijo:
// stari ×3 pin je prepovedan — polzaporedje ne sme nazaj; precedens
// R316 JSON → R317 CSV → R318 PDF).
//
// STRAŽAR (kanon GLOBALNI sken r310/r316 prenesen na izvozno družino):
//  • vsak izvozni gumb (aria-label="Izvozi …") nosi IZRECEN
//    focus-visible:ring-2 žeton (ne samo baza);
//  • barva = roksal žeton (navy/40 ali amber/50) — 0 surovih barv;
//  • amber/50 SAMO v vodja-dashboard (izrecen zaklenjen register z razlogom
//    — R308/R316 lekcija: semantične izjeme + bratska simetrija blok glav);
//  • anti-stale: števec gumbov mora ujemati pričakovanje (zastarel test =
//    fail, kanon r316-stil-val7).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROKSAL_DIR = join(process.cwd(), 'src/components/roksal')

/** Najdi vse izvozne gumbe (aria-label="Izvozi …") z oknom className vrstic. */
function izvozniGumbi(): Array<{ datoteka: string; vrstica: number; okno: string }> {
  const najdeni: Array<{ datoteka: string; vrstica: number; okno: string }> = []
  for (const f of readdirSync(ROKSAL_DIR).filter((n) => n.endsWith('.tsx'))) {
    const vrstice = readFileSync(join(ROKSAL_DIR, f), 'utf8').split('\n')
    for (let i = 0; i < vrstice.length; i++) {
      if (!vrstice[i].includes('aria-label="Izvozi')) continue
      // className je tipično do 6 vrstic nad aria-label ali do 5 pod njo
      najdeni.push({
        datoteka: f.replace('.tsx', ''),
        vrstica: i + 1,
        okno: vrstice.slice(Math.max(0, i - 8), i + 6).join('\n'),
      })
    }
  }
  return najdeni
}

describe('r317 STIL val 8 — izvozna družina: focus-visible ring STRAŽAR', () => {
  const gumbi = izvozniGumbi()
  const AMBER_ZETONI = new Set(['vodja-dashboard'])

  it('anti-stale: 54 izvoznih gumbov v drevesu (53 pred R318 + NOV audit PDF)', () => {
    expect(gumbi.length).toBeGreaterThanOrEqual(54)
    // novi gumb 48. člena je prisoten
    expect(gumbi.some((g) => g.okno.includes('Izvozi avtomatizacijski audit kot PDF'))).toBe(true)
  })

  it('vsak izvozni gumb nosi IZRECEN focus-visible ring žeton (ne samo ui baza)', () => {
    const brez = gumbi.filter((g) => !g.okno.includes('focus-visible:ring-2'))
    expect(brez).toEqual([])
  })

  it('ring barva = roksal žeton (navy/40 ali amber/50) — 0 surovih barv', () => {
    const kršitve = gumbi
      .map((g) => ({
        ...g,
        barve: [
          ...g.okno.matchAll(
            /focus-visible:ring-(roksal-(?:navy|amber|green|red|ink)\/?\d*|amber-\d+(?:\/\d+)?|red-\d+|white|black)/g,
          ),
        ].map((m) => m[1]),
      }))
      .filter((g) => g.barve.length === 0 || g.barve.some((b) => !b.startsWith('roksal-')))
    expect(kršitve).toEqual([])
  })

  it('amber/50 ring SAMO v zaklenjenem registru (vodja-dashboard — blok glavni gumbi, bratska simetrija)', () => {
    const kršitve = gumbi.filter(
      (g) => g.okno.includes('focus-visible:ring-roksal-amber/50') && !AMBER_ZETONI.has(g.datoteka),
    )
    expect(kršitve).toEqual([])
    // R318 register je ŽIV: vodja res nosi 4 amber gumbe (dnevni CSV R163 +
    // JSON 46. + CSV 47. + PDF 48. člen — isti vodja blok glavni vzorec z
    // offset-2; PIN SHIFT ×3 → ×4 z obrnjeno regresijo)
    const vodjaAmber = gumbi.filter(
      (g) => g.datoteka === 'vodja-dashboard' && g.okno.includes('focus-visible:ring-roksal-amber/50'),
    )
    expect(vodjaAmber.length).toBe(4)
    const ariaVseh = vodjaAmber.map((g) => {
      const m = g.okno.match(/aria-label="([^"]+)"/)
      return m ? m[1] : ''
    })
    expect(ariaVseh).toContain('Izvozi dnevni pregled vodje kot CSV')
    expect(ariaVseh).toContain('Izvozi poročilo končne verifikacije kot JSON')
    expect(ariaVseh).toContain('Izvozi avtomatizacijski audit kot CSV')
    expect(ariaVseh).toContain('Izvozi avtomatizacijski audit kot PDF')
  })

  it('R317 harmonizirana vrstica: site-survey PDF gumb ima družinski ring (regresijski pin — nazaj = fail)', () => {
    const raw = readFileSync(join(ROKSAL_DIR, 'site-survey-tab.tsx'), 'utf8')
    expect(raw).toContain(
      'hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:outline-none',
    )
  })
})
