// r387-fb-border-generalizacija.test.ts — R387 FEATURE (tretji varuh v
// družini stražarjev; kanon R387 handover kandidat): FB-BORDER PARITETA
// STRAŽAR GENERALIZACIJA — 'ISTI jezik čez kontekste' (LEKCIJA R382 (2))
// sedaj TRAJNO varovan kot test za TRETJO os: FB border.
//
// TRIA VARUHA (skupaj pokrivajo celoten FB jezik):
//  1. r385-fb-dark-generalizacija — vsak light FB nosi dark par (tema);
//  2. r386-ring-o2-generalizacija — vsak barvni ring nosi O2 (pairing);
//  3. TA TEST — vsaka bordered+O2 vrstica z barvnim ringom nosi FB ISTE
//     barve (val 57/61 navy + val 62 red + val 63/64/65 amber triažni
//     kanon, sedaj za VEDNO zamrznjen kot regresijski varuh).
//
// DISK RESNICA ob nastanku (r387 val 65 zaključek amber simetrije):
// bordered+O2 vrstic z barvnim ringom — navy 159 / red 16 / amber 20
// [/50 ×15 + /40 ×3 + /60 ×2]; FB nosilcev ISTIJE števila (0 kršitev);
// obrnjena resnica: 0 FB border žetonov brez ringa iste barve na vrstici.
//
// OBSEG (iskreno dokumentiran): line-based guard — vrstica MORA nositi
// ring-2 + O2 + light barvni ring + VIDLJIV border token na ISTI vrstici;
// template-literali, kjer je border ISKLJUČIVO na nadaljevalni vrstici, so
// izven obsega (vrstični varuh jih ne vidi — doslej take tarče NISO bile
// triažirane kot tarče; triaža rNNN-triaza.py je vedno delovala po ISTEM
// vrstičnem pravilu — konsistentnost orodje↔test). N/A vrstici (brez
// borderja — photo L2414, dashboard L1749, measurements L3329) so ISKRENO
// izven obsega (triaža jih je dokumentirala, ničesar obarvati).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const koren = join(process.cwd(), 'src/components/roksal')
const O2 = 'focus-visible:ring-offset-2'
const BARVE = ['navy', 'red', 'amber'] as const
const BORDER_PAT = /(?<![\w-])(border(?:-[a-zA-Z0-9./[\]%-]+)?)(?![\w-])/g

function imaBorder(l: string): boolean {
  const stripped = l.replace(/(?<!dark:)focus-visible:border-\S+/g, '')
  const toks = stripped.match(BORDER_PAT) ?? []
  return toks.some((t) => t === 'border' || (t.startsWith('border-') && !t.includes('focus-visible') && !t.startsWith('border-dashed-none')))
}

function vrsticeVseh(): { f: string; n: number; l: string }[] {
  const out: { f: string; n: number; l: string }[] = []
  for (const z of readdirSync(koren)) {
    if (!z.endsWith('.tsx')) continue
    readFileSync(join(koren, z), 'utf-8')
      .split('\n')
      .forEach((l, i) => out.push({ f: z, n: i + 1, l }))
  }
  return out
}

describe('R387 FEATURE — FB-border pariteta stražar GENERALIZACIJA: vsaka bordered+O2 barvna ring vrstica nosi FB iste barve', () => {
  it.each(BARVE)('%s: vsaka ring-2+O2+border vrstica z light ring-roksal-%s nosi FB focus-visible:border-roksal-%s (val 57/61 + 62 + 63/64/65 kanon)', (barva) => {
    const kršitve = vrsticeVseh()
      .filter(({ l }) => l.includes('focus-visible:ring-2') && l.includes(O2))
      .filter(({ l }) => new RegExp(`(?<!dark:)focus-visible:ring-roksal-${barva}/`).test(l))
      .filter(({ l }) => imaBorder(l))
      .filter(({ l }) => !l.includes(`focus-visible:border-roksal-${barva}/`))
      .map(({ f, n }) => `${f}:${n} ${barva} bordered+O2 brez FB iste barve`)
    expect(kršitve).toEqual([])
  })

  it('GLOBALNI ŠTEVCI zamrznjeni: bordered+O2 FB nosilcev navy 159 / red 16 / amber 20 (disk resnica ob R387 val 65; delna aplikacija = glasna regresija)', () => {
    const pričakovano: Record<string, number> = { navy: 160, red: 16, amber: 20 } // [PIN SHIFT R402 §19: navy +1 Poslan]
    for (const barva of BARVE) {
      const nosilci = vrsticeVseh()
        .filter(({ l }) => l.includes('focus-visible:ring-2') && l.includes(O2))
        .filter(({ l }) => new RegExp(`(?<!dark:)focus-visible:ring-roksal-${barva}/`).test(l))
        .filter(({ l }) => imaBorder(l) && l.includes(`focus-visible:border-roksal-${barva}/`))
      expect(nosilci.length, `${barva} bordered+O2 FB nosilcev`).toBe(pričakovano[barva])
    }
  })

  it('OBRNJENA REGRESIJA: 0 FB border žetonov brez barvnega ringa iste barve na ISTI vrstici (sirota FB = glasna napaka)', () => {
    const sirote = vrsticeVseh()
      .filter(({ l }) => !l.includes('focus-visible:ring-2'))
      .filter(({ l }) => BARVE.some((b) => l.includes(`focus-visible:border-roksal-${b}/`)))
      .map(({ f, n }) => `${f}:${n} FB border brez ring-2 vrstice`)
    expect(sirote).toEqual([])
    for (const barva of BARVE) {
      const brezRinga = vrsticeVseh()
        .filter(({ l }) => l.includes(`focus-visible:border-roksal-${barva}/`))
        .filter(({ l }) => !new RegExp(`focus-visible:ring-roksal-${barva}/`).test(l))
        .map(({ f, n }) => `${f}:${n} FB border ${barva} brez ringa iste barve`)
      expect(brezRinga).toEqual([])
    }
  })

  it('N/A ISKRENO IZVEN OBSEGA: znane brez-border vrstici (photo L2414, dashboard L1749, measurements L3329) NISSET FB in NISSET lažno prištete (triaža disk resnica)', () => {
    const NA = [
      { f: 'roksal/photo-tab.tsx', ln: 2414, ring: 'focus-visible:ring-roksal-amber/60' },
      { f: 'roksal/dashboard-tab.tsx', ln: 1749, ring: 'focus-visible:ring-roksal-amber/40' },
      { f: 'roksal/measurements-tab.tsx', ln: 3329, ring: 'focus-visible:ring-roksal-amber/40' },
    ]
    for (const { f, ln, ring } of NA) {
      const v = readFileSync(join(koren, '..', f.replace('roksal/', 'roksal/')), 'utf-8').split('\n')[ln - 1]
      expect(v.includes(ring), `${f}:${ln} ring`).toBe(true)
      expect(v.includes('focus-visible:border-roksal-'), `${f}:${ln} N/A — brez FB (disk resnica)`).toBe(false)
      expect(imaBorder(v), `${f}:${ln} N/A — brez borderja (disk resnica)`).toBe(false)
    }
  })
})
