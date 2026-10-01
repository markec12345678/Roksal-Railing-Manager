// R354 — MANDATORY STIL val 37: a11y parity "dialog akcija" bratov, kjer
// vidno besedilo NE razlaga CILJA:
//  (1) meritve reopen 'Odpri z razlogom' — ne pove KATERA meritev / kam gre
//      razlog → aria 'Potrdi ponovno odpiranje meritve z razlogom' + title
//      (razlog → revizijska sled) + ring parity: prej bos
//      focus-visible:ring-roksal-amber (BREZ ring-2 širine) → kanon navy/40
//      + ring-offset (LEKCIJA R346 kanon — enoten družinski žeton);
//  (2) meritve foto viewer 'Odpri v slikah' — ne pove KATERA fotografija →
//      aria 'Odpri to fotografijo meritve v zavihku Slike' + title + NOV ring;
//  (3) onboarding vodnik 'Naprej'/'Zaključi' — 'Zaključi' ne pove KAJ →
//      pogojna aria/title (2 stanji) + NOV ring.
// 0 novih hex (aria/title/ring token razredi).
// Obrnjene regresije: val 36/35/34 needleji ostanejo ŽIVO (nič oslabitve).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MERITVE = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const VODNIK = readFileSync(join(process.cwd(), 'src/components/roksal/onboarding-tour.tsx'), 'utf8')
const GALLERY = readFileSync(join(process.cwd(), 'src/components/roksal/reference-gallery.tsx'), 'utf8')
const SKICA = readFileSync(join(process.cwd(), 'src/components/roksal/sketch-canvas.tsx'), 'utf8')
const CRM = readFileSync(join(process.cwd(), 'src/components/roksal/crm-tab.tsx'), 'utf8')
const LOGISTIKA = readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')
const MATERIAL = readFileSync(join(process.cwd(), 'src/components/roksal/material-intelligence-tab.tsx'), 'utf8')

const RING = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

const A_REOPEN = 'aria-label="Potrdi ponovno odpiranje meritve z razlogom"'
const A_FOTO = 'aria-label="Odpri to fotografijo meritve v zavihku Slike"'
// vodnik: pogojni izraz — anchor = enojni narekovajni literali v viru
const A_VODNIK = "'Naprej na naslednji korak vodnika'"

/** Strukturni dokaz: aria-label, title in ring v ISTEM Button bloku.
 *  Anchor = VIRSKA resnica (statični aria z dvojimi narekovaji; vodnik z
 *  enojnimi znotraj pogojnega izraza). Okno: 260 pred + 480 za anchor. */
function bratBlok(vir: string, anchor: string): string {
  const i = vir.indexOf(anchor)
  expect(i, anchor).toBeGreaterThanOrEqual(0)
  return vir.slice(Math.max(0, i - 260), i + 480)
}

describe('r354 stil val 37 — dialog akcija a11y parity (3 bratje)', () => {
  it('(1) reopen: aria + title razlagata CILJ (razlog gre v revizijsko sled) + ring parity navy/40 (prej bos amber)', () => {
    expect(MERITVE).toContain(A_REOPEN)
    expect(MERITVE).toContain('title="Ponovno odpri to meritev za urejanje — zapisana razlog gre v revizijsko sled"')
    const blok = bratBlok(MERITVE, A_REOPEN)
    expect(blok).toContain(RING)
    expect(blok).toContain('focus-visible:ring-offset-2')
    // stari bos amber ring iz tega gumba IZGINIL (parity — enoten žeton)
    expect(blok).not.toContain('focus-visible:ring-roksal-amber')
  })

  it('(2) foto viewer: aria + title + NOV izrecen ring (prej brez ringa)', () => {
    expect(MERITVE).toContain(A_FOTO)
    expect(MERITVE).toContain('title="Prenesi pogled na zavihek Slike s to fotografijo meritve odprto"')
    const blok = bratBlok(MERITVE, A_FOTO)
    expect(blok).toContain(RING)
    expect(blok).toContain('focus-visible:ring-offset-2')
  })

  it('(3) vodnik: pogojna aria + title za OBĚ stanji (Naprej / Zaključi) + NOV ring', () => {
    expect(VODNIK).toContain("aria-label={korak === KORAKI.length - 1 ? 'Zaključi vodeno predstavitev vmesnika' : 'Naprej na naslednji korak vodnika'}")
    expect(VODNIK).toContain("title={korak === KORAKI.length - 1 ? 'Zapri vodnik — lahko ga znova odpreš prek pomoči' : 'Pokaži naslednji korak vodnika'}")
    const blok = bratBlok(VODNIK, A_VODNIK)
    expect(blok).toContain(RING)
    expect(blok).toContain('focus-visible:ring-offset-2')
  })

  it('LEKCIJA R346 kanon: VSI 3 bratje — aria + title + ring v ISTEM Button bloku', () => {
    for (const [vir, anchor] of [
      [MERITVE, A_REOPEN],
      [MERITVE, A_FOTO],
      [VODNIK, A_VODNIK],
    ] as const) {
      const blok = bratBlok(vir, anchor)
      expect(blok, anchor).toContain(RING)
      expect(blok, anchor).toMatch(/title=/)
    }
  })

  it('0 novih hex: token razredi brez hex literalov v vseh 3 blokih', () => {
    for (const [vir, anchor] of [
      [MERITVE, A_REOPEN],
      [MERITVE, A_FOTO],
      [VODNIK, A_VODNIK],
    ] as const) {
      expect(bratBlok(vir, anchor), anchor).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  it('obrnjena regresija val 36: Shrani/Dodaj/Uvozi bratje ostanejo ŽIVO', () => {
    expect(GALLERY).toContain('aria-label="Dodaj realizacijo v galerijo realizacij"')
    expect(SKICA).toContain('aria-label="Shrani skico v register skic projekta"')
    expect(CRM).toContain('aria-label="Shrani spremembe CRM zapisa stranke"')
    expect(MERITVE).toContain('aria-label="Uvozi mere iz AR posnetka v meritev"')
  })

  it('obrnjena regresija val 35: dialog Shrani bratje (razpored/ekipa/oprema/dobavitelj) ostanejo ŽIVO', () => {
    expect(LOGISTIKA).toContain('aria-label="Shrani nov razpored"')
    expect(LOGISTIKA).toContain('aria-label="Shrani novo ekipo"')
    expect(LOGISTIKA).toContain('aria-label="Shrani novo opremo"')
    expect(MATERIAL).toContain('aria-label="Shrani novega dobavitelja"')
  })

  it('obrnjena regresija val 34: filter čipi parity ostane ŽIVO', () => {
    expect(MERITVE).toContain('aria-pressed={isActive}')
    expect(MERITVE).toContain('Filtriraj po statusu: ')
  })
})
