// r386-ring-o2-generalizacija.test.ts — R386 FEATURE (kanon R386): O2
// pairing stražar GENERALIZACIJA — val 52 (navy), val 59 (red), val 51
// (amber) pairing kanoni, zdaj TRAJNO varovani kot EN živ test čez VSE
// tri barvne družine (komplement r385-fb-dark-generalizacija.test.ts, ki
// varuje FB dark polovice).
//
// ZGODOVINA KANONA:
//  - val 52 (R369): navy ring dobi O2 ('focus-visible:ring-offset-2' TIK
//    ZA navy/40) — offset-2 pairing;
//  - val 59 (R379): red ring dobi O2 (14 × INS, 8 datotek; r372 izjema
//    #1 resolvana);
//  - val 51 (R368): amber ring dobi O2 (31 žetonov / 30 površin, razcep
//    števca = 0);
//  - val 61 (R383): FROZEN izjema #2 — roksal-catalog L95 <Input>
//    (iskalno polje z goli navy ring-2 brez O2; zamrznjena izjema, kanon
//    R377 — NI v obsegu pairing rund, dokumentirana dobesedno).
//
// GENERALIZACIJA (ta test): za VSAKO barvno družino (navy/red/amber)
// velja — vsaka izvedljiva vrstica z 'focus-visible:ring-2
// focus-visible:ring-roksal-{BARVA}/N' nosi 'focus-visible:ring-offset-2',
// RAZEN enojna FROZEN izjema roksal-catalog L95 <Input> (dokumentirana +
// obstoj preverjen). Globalna števca per družino zamrznjena (delna
// regresija = glasna): navy 237, red 25, amber 26 (disk resnica ob
// nastanku R386 — val 63/64 FB vstavljanja NE dodajajo ring vrstic).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const koren = join(process.cwd(), 'src/components/roksal')

const DRUŽINE = [
  { ime: 'navy', pričakovano: 238 }, // [PIN SHIFT R402 §19: +1 invoice-manager gumb Poslan]
  { ime: 'red', pričakovano: 25 },
  { ime: 'amber', pričakovano: 26 },
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

describe('R386 FEATURE — O2 pairing stražar GENERALIZACIJA: vsak barvni focus ring nosi ring-offset-2', () => {
  it.each(DRUŽINE)('%s: vsaka vrstica z focus ringom nosi O2 (razcep = 0) — razen FROZEN izjema roksal-catalog L95 <Input>', ({ ime }) => {
    const kršitve = vrsticeVseh()
      .filter(({ f, n }) => !(f === 'roksal-catalog.tsx' && n === 95))
      .filter(({ l }) => l.includes('focus-visible:ring-2') && l.includes(`focus-visible:ring-roksal-${ime}/`))
      .filter(({ l }) => !l.includes('focus-visible:ring-offset-2'))
      .map(({ f, n }) => `${f}:${n} ${ime} focus ring brez O2`)
    expect(kršitve).toEqual([])
  })

  it('FROZEN izjema #2 (kanon R377): roksal-catalog L95 <Input> je TOČNO ena — dokumentirana in obstaja (tihageneralizacija izjem = glasna regresija)', () => {
    const lines = readFileSync(join(koren, 'roksal-catalog.tsx'), 'utf-8').split('\n')
    const v = lines[94]
    expect(v.includes('focus-visible:ring-roksal-navy/40'), 'L95 navy ring prisoten').toBe(true)
    expect(v.includes('focus-visible:ring-offset-2'), 'L95 FROZEN: brez O2').toBe(false)
    const ostaleIzjeme = vrsticeVseh()
      .filter(({ f, n }) => !(f === 'roksal-catalog.tsx' && n === 95))
      .filter(({ l }) => l.includes('focus-visible:ring-2') && /focus-visible:ring-roksal-(navy|red|amber)\//.test(l))
      .filter(({ l }) => !l.includes('focus-visible:ring-offset-2'))
    expect(ostaleIzjeme, 'izjem mora biti TOČNO 1 (FROZEN L95)').toEqual([])
  })

  it('GLOBALNA ŠTEVCA per družina zamrznjena (delna regresija = glasna): navy 238 / red 25 / amber 26 [PIN SHIFT R402 §19: navy +1 — gumb Poslan]', () => {
    const števci: Record<string, number> = { navy: 0, red: 0, amber: 0 }
    for (const { l } of vrsticeVseh()) {
      if (!l.includes('focus-visible:ring-2')) continue
      for (const { ime } of DRUŽINE) {
        if (l.includes(`focus-visible:ring-roksal-${ime}/`)) števci[ime] += 1
      }
    }
    for (const { ime, pričakovano } of DRUŽINE) {
      expect(števci[ime], `${ime} focus-ring vrstic`).toBe(pričakovano)
    }
  })
})
