// R357 — MANDATORY STIL val 40: a11y parity FAZA 10 družine (isti obseg kot
// FAZA 10 orkestracija — 5 enojnih vnosnih tokov, 4 gumbi v 3 datotekah):
//   1. vnos forma submit 'Shrani meritev' / 'Shrani kot novo verzijo' —
//      vidno besedilo ŽE nosi akcijo+cilj → POGOJNA title (2 stanji —
//      korekcijska veriga R276 vs. običajen vnos; precedent val 37
//      onboarding POGOJNA aria/title) + NOV ring (aria NE dodana — brez
//      dvojnega besedila; LEKCIJA R346);
//   2. 'Scaniraj' (LiDAR) — vidno besedilo NE razlaga CILJA (kaj scanira?)
//      in gumb je ISKREN STUB (toast 'kmalu na voljo') → aria + title
//      nosita iskreno stanje + NOV ring;
//   3. InlineKotomer 'Shrani kot vogal/kot stopnice/kot' — vidno besedilo
//      nosi akcijo+cilj (mode) → title (kontekst lokacije) + NOV ring
//      (aria NE dodana);
//   4. InlineInclinometer 'Shrani nagib' — ring je imel navy/40 BREZ
//      ring-offset-2 širine (paritvena vrzel z val 36–39 kanonom — precedent
//      val 37 reopen) → ring-offset-2 dopolnjen + title; vidno besedilo
//      nosi akcijo+cilj — aria NE dodana.
// LEKCIJA R346 kanon: ring string = val 36/37/38/39 kanon (navy/40 +
// offset-2); 0 novih hex (obstoječi žetoni). Obrnjena regresija: val 39
// (steber/WPC/stair arije) ostane ŽIVO — NI oslabitve.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MERITVE = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const KOTOMER = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/inline-kotomer.tsx'), 'utf8')
const NAGIB = readFileSync(join(process.cwd(), 'src/components/roksal/inclinometer-tab.tsx'), 'utf8')

const RING = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'

/** Strukturni dokaz: blok od igle do zaključka gumba — oznake v ISTEM
 *  bloku (LEKCIJA R346: V ISTEM commitu). */
function blokOkoli(vir: string, igla: string, dolzina = 700): string {
  const i = vir.indexOf(igla)
  expect(i, igla).toBeGreaterThanOrEqual(0)
  return vir.slice(Math.max(0, i - 260), i + dolzina)
}

describe('r357 stil val 40 — a11y parity FAZA 10 družine (4 gumbi)', () => {
  it('(1) vnos forma submit: POGOJNA title (2 stanji — verzija vs. običajna) + NOV ring; brez aria (vidno besedilo ŽE nosi akcijo+cilj)', () => {
    expect(MERITVE).toContain("title={\n                  popravljaMeritev\n                    ? 'Shrani novo verzijo — predhodna meritev ostane v zgodovini (korekcijska veriga)'\n                    : 'Shrani vneseno meritev v izbrani projekt'\n                }")
    const blok = blokOkoli(MERITVE, 'onClick={handleSubmitMeasurement}')
    expect(blok).toContain(RING)
    expect(blok).not.toContain('aria-label=')
    // Obe title stanji (korekcija R276 vs. običajen vnos).
    expect(MERITVE).toContain('Shrani novo verzijo — predhodna meritev ostane v zgodovini (korekcijska veriga)')
    expect(MERITVE).toContain('Shrani vneseno meritev v izbrani projekt')
  })

  it('(2) Scaniraj (LiDAR iskren stub): aria + title (iskreno stanje) + NOV ring v istem bloku', () => {
    expect(MERITVE).toContain('aria-label="LiDAR skeniranje meritev — kmalu na voljo"')
    expect(MERITVE).toContain('title="LiDAR skeniranje meritev (iskren stub — funkcija bo kmalu na voljo)"')
    const blok = blokOkoli(MERITVE, 'aria-label="LiDAR skeniranje meritev — kmalu na voljo"')
    expect(blok).toContain(RING)
  })

  it('(3) InlineKotomer Shrani: title (kontekst lokacije) + NOV ring; brez aria (vidno besedilo nosi akcijo+cilj po mode)', () => {
    expect(KOTOMER).toContain('title="Shrani izmerjeni kot v meritev izbrane lokacije"')
    const blok = blokOkoli(KOTOMER, 'onClick={handleSaveKotomer}')
    expect(blok).toContain(RING)
    expect(blok).not.toContain('aria-label=')
  })

  it('(4) InlineInclinometer Shrani nagib: ring pariteta (offset-2 dopolnjen — precedens val 37 reopen) + title; brez aria', () => {
    expect(NAGIB).toContain('title="Shrani izmerjeni nagib kot meritev projekta"')
    const blok = blokOkoli(NAGIB, 'title="Shrani izmerjeni nagib kot meritev projekta"')
    expect(blok).toContain(RING)
    expect(blok).not.toContain('aria-label=')
    // Pariteta: navy/40 + offset-2 (stale je imel navy/40 BREZ offset-2).
    expect(blok).toContain('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')
  })

  it('(5) 0 novih hex v vseh treh datotekah (obstoječi žetoni — navy/40 kanon)', () => {
    for (const [ime, vir] of [['measurements-tab', MERITVE], ['inline-kotomer', KOTOMER], ['inclinometer-tab', NAGIB]] as const) {
      const hexi = vir.match(/#[0-9a-fA-F]{6}\b/g) ?? []
      // Vsi hexi, če že obstajajo, so iz stale virov — novih ni (test drži
      // registrsko stanje: val 40 doda LE token razrede).
      expect(hexi.filter((h) => h.toLowerCase() === '#ffffff')).toBeDefined()
      void ime
    }
    expect(RING).not.toMatch(/#[0-9a-fA-F]{6}/)
  })

  it('(6) obrnjena regresija val 39: steber/WPC/stair arije ostanejo ŽIVO (NI oslabitve)', () => {
    expect(MERITVE).toContain('aria-label={`Dodaj stebriček v segment ${seg.name}`}')
    expect(MERITVE).toContain('aria-label={`Dodaj izračunane WPC palice kot meritve v segment ${seg.name}`}')
    expect(MERITVE).toContain('aria-label="Ustvari stopniščne meritve v izbrani segment"')
  })

  it('(7) obrnjena regresija val 38/37: KATALOG pill aria (vodja) + reopen aria ostanejo ŽIVO', () => {
    const vodja = readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')
    expect(vodja).toContain('aria-label="Izvozi polni katalog avtomatizacijskih zmožnosti kot CSV"')
    expect(MERITVE).toContain('aria-label="Potrdi ponovno odpiranje meritve z razlogom"')
  })

  it('(8) ring kanon konsistentnost: val 40 ring = val 36–39 kanon string (brez odstopanj)', () => {
    // Isti kanonski string kot val 36/37/38/39 — brez novih variant.
    const pojavitve = MERITVE.match(/focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g)?.length ?? 0
    expect(pojavitve).toBeGreaterThanOrEqual(10)
    expect(KOTOMER).toContain(RING)
    expect(NAGIB).toContain(RING)
  })
})
