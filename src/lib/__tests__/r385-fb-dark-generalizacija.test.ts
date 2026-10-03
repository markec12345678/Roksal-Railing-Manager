// r385-fb-dark-generalizacija.test.ts — R385 FEATURE (kanon R385 handover
// kandidat 2): R166 DARK stražar GENERALIZACIJA — navy-only → VSI barvni
// FB pari (ISTI jezik čez kontekste = starejši, močnejši kanon; val 62 je
// dokazal vzorec za rdečo, val 63 za amber — dark par sedaj tretja
// družina).
//
// ZGODOVINA KANONA:
//  - R166: border-roksal-navy/N mora imeti dark: obrobno varianto (per
//    datoteka, izvedljive vrstice; izjeme = svetla platna) — nauček
//    R163–R166: obrobe navy v temni temi izginejo (#1d2b3e na #1a2744);
//  - val 57 (R375) + val 61 (R383): focus FB navy dobí dark par
//    dark:focus-visible:border-roksal-ink/40 (ink = navy nevtralni
//    sorojenec v temni temi);
//  - val 62 (R384): FB red dobí dark par dark:focus-visible:border-
//    roksal-red/50 (rdeča ostane rdeča — barva je pomen; dark stopnja po
//    precedensu team-tab L619);
//  - val 63 (R385): FB amber dobí dark par dark:focus-visible:border-
//    roksal-amber/30 (amber ostane amber; dark stopnja po precedensu
//    audit-trail L53 'border-roksal-amber/50 dark:border-roksal-amber/30').
//
// GENERALIZACIJA (ta test): ZA VSAKO barvno družino velja — vsaka
// izvedljiva vrstica z LIGHT FB žetonom 'focus-visible:border-roksal-X/N'
// nosi svoj dark par NA ISTI vrstici (apply kanon val 61/62/63:
// PAR v enem koraku) + globalno števce light == dark (delna aplikacija =
// glasna regresija). Karantena ni potrebna: patterni so enolični FB
// žetoni, ne splošni border-ji (R166 per-datoteka izjeme se NE razširjajo
// — FB pari so doslej na vsaki vrstici popolni: 159/16/15, disk resnica
// ob nastanku).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const koren = join(process.cwd(), 'src/components/roksal')

// Družinska mapa: light FB žeton → dark FB žeton (ISTI vrstični PAR).
// Negative lookbehind (?<!dark:) loči light od dark polovice — LEKCIJA
// R384 (2): dark: token VSEBUJE light podniz.
const DRUŽINE = [
  { ime: 'navy', light: /(?<!dark:)focus-visible:border-roksal-navy\/40/, dark: 'dark:focus-visible:border-roksal-ink/40', lightZeton: 'focus-visible:border-roksal-navy/40' },
  { ime: 'red', light: /(?<!dark:)focus-visible:border-roksal-red\/40/, dark: 'dark:focus-visible:border-roksal-red/50', lightZeton: 'focus-visible:border-roksal-red/40' },
  { ime: 'amber', light: /(?<!dark:)focus-visible:border-roksal-amber\/50/, dark: 'dark:focus-visible:border-roksal-amber/30', lightZeton: 'focus-visible:border-roksal-amber/50' },
] as const

const vrsticeVseh = (): { f: string; n: number; l: string }[] => {
  const out: { f: string; n: number; l: string }[] = []
  for (const z of readdirSync(koren)) {
    if (!z.endsWith('.tsx')) continue
    readFileSync(join(koren, z), 'utf-8')
      .split('\n')
      .forEach((l, i) => out.push({ f: z, n: i + 1, l }))
  }
  return out
}

describe('R385 FEATURE — R166 dark stražar GENERALIZACIJA: vsi barvni FB pari nosijo dark polovico', () => {
  it.each(DRUŽINE)('%s: vsaka vrstica z light FB žetonom nosi dark par NA ISTI vrstici (PAR v enem koraku — val 61/62/63 kanon)', ({ light, dark, lightZeton, ime }) => {
    const kršitve = vrsticeVseh()
      .filter(({ l }) => light.test(l))
      .filter(({ l }) => !l.includes(dark))
      .map(({ f, n }) => `${f}:${n} ${ime} light FB brez dark para`)
    expect(kršitve, lightZeton).toEqual([])
  })

  it('GLOBALNA PARITETA: števce light == dark per družina (delna aplikacija = glasna regresija); disk resnica 159/16/15', () => {
    const vse = vrsticeVseh().map(({ l }) => l).join('\n')
    const pricakovano: Record<string, [number, number]> = {
      navy: [159, 159],
      red: [16, 16],
      amber: [15, 15],
    }
    for (const { ime, light, dark } of DRUŽINE) {
      const svetlo = (vse.match(new RegExp(light.source, 'g')) ?? []).length
      const temno = vse.split(dark).length - 1
      expect(svetlo, `${ime} light števec`).toBe(pricakovano[ime][0])
      expect(temno, `${ime} dark števec`).toBe(pricakovano[ime][1])
      expect(temno, `${ime} PAR`).toBe(svetlo)
    }
  })

  it('BREZ SIROT: nobena vrstica ne nosi dark FB brez light polovice (obrnjena regresija — čiščenje ne sme pustiti sirot)', () => {
    for (const { ime, light, lightZeton } of DRUŽINE) {
      const sirote = vrsticeVseh()
        .filter(({ l }) => l.includes('dark:focus-visible:border-roksal-'))
        .filter(({ l }) => !light.test(l))
        .filter(({ l }) => {
          // vrstica nosi dark FB TE družine, NE pa light žetona TE družine
          const darkTaDružina = ime === 'navy' ? 'dark:focus-visible:border-roksal-ink/' : `dark:focus-visible:border-roksal-${ime}/`
          return l.includes(darkTaDružina)
        })
        .map(({ f, n }) => `${f}:${n} ${ime} dark FB sirota (brez ${lightZeton})`)
      expect(sirote).toEqual([])
    }
  })
})
