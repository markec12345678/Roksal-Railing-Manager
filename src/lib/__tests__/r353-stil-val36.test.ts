// R353 — MANDATORY STIL val 36: a11y parity "Shrani/Dodaj/Uvozi" dialog bratov
// (reference-gallery Dodaj + sketch-canvas Shrani skico + CRM Shrani urejanje +
// meritve Uvozi mere iz AR posnetka).
// LEKCIJA R346 kanon: vidno besedilo ("Shrani"/"Dodaj"/"Uvozi mere") NE razlaga
// CILJA → aria-label (akcija + cilj) + title + izrecen focus ring navy/40
// V ISTEM commitu; 0 novih hex (navy/40 = obstoječi token).
// ---------------------------------------------------------------------------
//  • 3 bratje dobijo NOV ring (gallery, skica, AR uvoz — prej brez), 1 ga je
//    ŽE nosil (CRM urejanje — prej ring iz starejše val ere; aria-label+title NOVA);
//  • obrnjene regresije: val 35/34/33 needleji ostanejo ŽIVO (nič oslabitve).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const GALLERY = readFileSync(join(process.cwd(), 'src/components/roksal/reference-gallery.tsx'), 'utf8')
const SKICA = readFileSync(join(process.cwd(), 'src/components/roksal/sketch-canvas.tsx'), 'utf8')
const CRM = readFileSync(join(process.cwd(), 'src/components/roksal/crm-tab.tsx'), 'utf8')
const MERITVE = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const LOGISTIKA = readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')
const MATERIAL = readFileSync(join(process.cwd(), 'src/components/roksal/material-intelligence-tab.tsx'), 'utf8')

const RING = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

/** Strukturni dokaz: aria-label, title in ring v ISTEM Button bloku. */
function bratBlok(vir: string, aria: string): string {
  const i = vir.indexOf(`aria-label="${aria}"`)
  expect(i, aria).toBeGreaterThanOrEqual(0)
  return vir.slice(Math.max(0, i - 160), i + 420)
}

describe('r353 stil val 36 — dialog Shrani/Dodaj/Uvozi a11y parity (4 bratje)', () => {
  it('gallery: Dodaj realizacijo — aria-label + title + NOV izrecen ring (prej brez ringa)', () => {
    expect(GALLERY).toContain('aria-label="Dodaj realizacijo v galerijo realizacij"')
    expect(GALLERY).toContain('title="Dodaj novo realizacijo s slikama pred/po v galerijo realizacij"')
    const blok = bratBlok(GALLERY, 'Dodaj realizacijo v galerijo realizacij')
    expect(blok).toContain(RING)
    expect(blok).toContain('focus-visible:ring-offset-2')
  })

  it('skica: Shrani skico — aria-label + title + NOV izrecen ring (prej brez ringa)', () => {
    expect(SKICA).toContain('aria-label="Shrani skico v register skic projekta"')
    expect(SKICA).toContain('title="Shrani novo skico v register skic projekta"')
    const blok = bratBlok(SKICA, 'Shrani skico v register skic projekta')
    expect(blok).toContain(RING)
    expect(blok).toContain('focus-visible:ring-offset-2')
  })

  it('CRM: Shrani spremembe stranke — aria-label + title (ring ŽE od starejše ere, ostane)', () => {
    expect(CRM).toContain('aria-label="Shrani spremembe CRM zapisa stranke"')
    expect(CRM).toContain('title="Shrani urejene podatke stranke v CRM register"')
    const blok = bratBlok(CRM, 'Shrani spremembe CRM zapisa stranke')
    expect(blok).toContain(RING)
    expect(blok).toContain('aria-busy={saving}')
  })

  it('AR uvoz: Uvozi mere iz AR posnetka — aria-label + title + NOV izrecen ring (prej brez ringa)', () => {
    expect(MERITVE).toContain('aria-label="Uvozi mere iz AR posnetka v meritev"')
    expect(MERITVE).toContain('title="Prenesi izbrane mere iz AR posnetka v aktivno meritev"')
    const blok = bratBlok(MERITVE, 'Uvozi mere iz AR posnetka v meritev')
    expect(blok).toContain(RING)
    expect(blok).toContain('focus-visible:ring-offset-2')
  })

  it('LEKCIJA R346 kanon: VSI 4 bratje — aria-label + title + ring v ISTEM Button bloku', () => {
    for (const [vir, aria] of [
      [GALLERY, 'Dodaj realizacijo v galerijo realizacij'],
      [SKICA, 'Shrani skico v register skic projekta'],
      [CRM, 'Shrani spremembe CRM zapisa stranke'],
      [MERITVE, 'Uvozi mere iz AR posnetka v meritev'],
    ] as const) {
      const blok = bratBlok(vir, aria)
      expect(blok, aria).toContain(RING)
      expect(blok, aria).toMatch(/title="[^"]+"/)
    }
  })

  it('0 novih hex: token razredi brez hex literalov v vseh 4 blokih', () => {
    for (const [vir, aria] of [
      [GALLERY, 'Dodaj realizacijo v galerijo realizacij'],
      [SKICA, 'Shrani skico v register skic projekta'],
      [CRM, 'Shrani spremembe CRM zapisa stranke'],
      [MERITVE, 'Uvozi mere iz AR posnetka v meritev'],
    ] as const) {
      expect(bratBlok(vir, aria), aria).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  it('obrnjena regresija val 35: dialog Shrani bratje (razpored/ekipa/oprema/dobavitelj) ostanejo ŽIVO', () => {
    expect(LOGISTIKA).toContain('aria-label="Shrani nov razpored"')
    expect(LOGISTIKA).toContain('aria-label="Shrani novo ekipo"')
    expect(LOGISTIKA).toContain('aria-label="Shrani novo opremo"')
    expect(MATERIAL).toContain('aria-label="Shrani novega dobavitelja"')
    const blok = bratBlok(MATERIAL, 'Shrani novega dobavitelja')
    expect(blok).toContain(RING)
  })

  it('obrnjena regresija val 34: filter čipi parity ostane ŽIVO', () => {
    expect(MERITVE).toContain('aria-pressed={isActive}')
    expect(MERITVE).toContain('Filtriraj po statusu: ')
  })
})
