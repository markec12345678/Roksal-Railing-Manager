// R359 — MANDATORY STIL val 42: a11y resnica status-orkestracije družine —
// LEKCIJA R346 kanon (aria akcija+cilj; title dopolni kontekst/posledico;
// ring navy/40 + offset-2 — PARITETA; 0 novih hex). Družina = PATCH/status
// orkestracija (patchMeasurementStatus + bulk arhiviranje + verzije reopen —
// fetch-first sken R359). 5 gumbov × 1 datoteka (measurements-tab.tsx), VSE
// SPREMEMBE DODATNE (nikoli ne menjamo pinanih nizov — register r350.tsv je
// zamrznjen era-kontrakt: need_static 'Izbriši izbrane meritve' + 'Trajno
// izbriši vse izbrane meritve'; OPOMBA za lastnika: title 'Trajno izbriši'
// je zgodovinska netočnost — handler arhivira, dialog je iskren):
//   1. verzije toggle (Zgodovina verzij) → ring PARITETA: stale navy/40 BREZ
//      offset-2 → offset-2 dopolnjen (precedens val 40/41);
//   2. 'Popravi' (nova verzija) → ring PARITETA: isti vzorec;
//   3. bulk trigger 'Izbriši izbrane' → ring PARITETA: isti vzorec (aria +
//      title ostajata ZAMRZNJENA — register r350);
//   4. bulk dialog 'Prekliči' → NOVI title (iskrena posledica: nič se ne
//      arhivira, izbira ostane) + NOV ring navy/40 + offset-2;
//   5. bulk dialog 'Arhiviraj (N)' → NOVI aria (akcija+cilj) + NOVI title
//      (iskrena posledica: zaporedno, idempotentno) + ring PARITETA: stale
//      ring-red-500 brez ring-2/offset → ring-2 red-500 + offset-2
//      (destruktivni žig ohranjen — pariteta brez barvnih sprememb).
// Testi:
// (A) verzije toggle blok: ring navy/40 + offset-2; aria + title ostajata;
// (B) Popravi blok: ring navy/40 + offset-2; aria + title ostajata;
// (C) bulk trigger blok: ring navy/40 + offset-2 + ZAMRZNJENA aria/title;
// (D) bulk dialog Prekliči: NOVI title + ring kanon v istem bloku;
// (E) bulk dialog Arhiviraj: NOVI aria + NOVI title + ring-2 red-500 +
//     offset-2 (destruktivni žig ohranjen);
// (F) 0 novih hex (tab — stil = žetonski razredi);
// (G) obrnjena regresija: val 41 ×3 titleji + val 40 Scaniraj aria + val 39
//     WPC aria ostanejo ŽIVI — parity nikoli ne ulomi prejšnjih valov;
// (H) 3 NOVI nizi = enolični era-diskriminatorji (vsak točno ×1) + ring
//     kanon prisoten.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const tab = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')

const RING_KANON = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'

describe('r359 STIL val 42 — a11y resnica status-orkestracije družine', () => {
  it('(A) verzije toggle blok: ring PARITETA navy/40 + offset-2; aria (akcija+cilj) + title ostajata', () => {
    const z = tab.indexOf('onClick={() => toggleZgodovina(m)}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 500)
    expect(okno).toContain('focus-visible:ring-roksal-navy/40')
    expect(okno).toContain('focus-visible:ring-offset-2')
    expect(okno).toContain('title="Zgodovina verzij"')
    expect(okno).toContain('aria-label={`Pokaži zgodovino verzij meritve ${m.oznaka || m.lokacija || `#${m.id.slice(-4)}`}`}')
  })

  it('(B) Popravi blok: ring PARITETA navy/40 + offset-2; aria + title ostajata', () => {
    const z = tab.indexOf('onClick={() => handleStartCorrection(m)}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 400)
    expect(okno).toContain('focus-visible:ring-roksal-navy/40')
    expect(okno).toContain('focus-visible:ring-offset-2')
    expect(okno).toContain('title="Popravi meritev (ustvari novo verzijo)"')
  })

  it('(C) bulk trigger blok: ring PARITETA + ZAMRZNJENA aria/title (register r350 — era-kontrakt, ne menjamo)', () => {
    const z = tab.indexOf('onClick={() => setBulkDeleteOpen(true)}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 800)
    expect(okno).toContain('focus-visible:ring-roksal-navy/40')
    expect(okno).toContain('focus-visible:ring-offset-2')
    // zamrznjeni nizi (need_static r350.tsv) — ostajajo bajtno identični:
    expect(okno).toContain('aria-label="Izbriši izbrane meritve"')
    expect(okno).toContain('title="Trajno izbriši vse izbrane meritve"')
  })

  it('(D) bulk dialog Prekliči: NOVI title (iskrena posledica: nič se ne arhivira) + ring kanon — isti blok', () => {
    const z = tab.indexOf('onClick={() => setBulkDeleteOpen(false)}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 400)
    expect(okno).toContain('title="Zapri pogovorno okno — nič se ne arhivira, izbira meritev ostane"')
    expect(okno).toContain(RING_KANON)
  })

  it('(E) bulk dialog Arhiviraj: NOVI aria + NOVI title (idempotentno) + ring-2 red-500 offset-2 (destruktivni žig ohranjen)', () => {
    const z = tab.indexOf('onClick={handleBulkDelete}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 500)
    expect(okno).toContain('aria-label="Potrdi arhiviranje izbranih meritev v bazo"')
    expect(okno).toContain('title="Zaporedno arhiviraj izbrane meritve — že arhivirane se štejejo kot opravljene (idempotentno)"')
    expect(okno).toContain('focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2')
  })

  it('(F) 0 novih hex (stil = žetonski razredi)', () => {
    expect(tab.match(/#[0-9a-fA-F]{6}\b/g)).toBeNull()
  })

  it('(G) obrnjena regresija: val 41 ×3 titleji + val 40 Scaniraj aria + val 39 WPC aria ostanejo ŽIVI', () => {
    // val 41 (R358): syncAll + per-draft + discard titleji.
    expect(tab).toContain('title="Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu"')
    expect(tab).toContain('title="Pošlji shranjeno telo osnutka v bazo (neuspeh ostane lokalni osnutek)"')
    expect(tab).toContain('title="Odstrani lokalni osnutek — ni bil nikoli poslan v bazo"')
    // val 40 (R357): Scaniraj iskren stub aria.
    expect(tab).toContain('aria-label="LiDAR skeniranje meritev — kmalu na voljo"')
    // val 39 (R356): WPC palice aria prefix.
    expect(tab).toContain('aria-label={`Dodaj izračunane WPC palice kot meritve v segment ${seg.name}`}')
  })

  it('(H) 3 NOVI nizi = enolični era-diskriminatorji (vsak točno ×1) + ring kanon prisoten', () => {
    expect(tab).toContain(RING_KANON)
    expect(tab.match(/Zapri pogovorno okno — nič se ne arhivira, izbira meritev ostane/g)?.length).toBe(1)
    expect(tab.match(/Zaporedno arhiviraj izbrane meritve — že arhivirane se štejejo kot opravljene \(idempotentno\)/g)?.length).toBe(1)
    expect(tab.match(/Potrdi arhiviranje izbranih meritev v bazo/g)?.length).toBe(1)
  })
})
