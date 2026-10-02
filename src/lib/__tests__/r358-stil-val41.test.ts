// R358 — MANDATORY STIL val 41: a11y parity FAZA 11 (repost) družine —
// LEKCIJA R346 kanon (aria akcija+cilj; title dopolni kontekst/posledico;
// ring navy/40 + offset-2 — PARITETA; 0 novih hex; ISTI commit kot FAZA 11).
// 5 gumbov × 1 datoteka (measurements-tab.tsx):
//   1. 'Sinhroniziraj vse' (syncAllDrafts) → NOVI title (posledica: zaporedno
//      v determinističnem vrstnem redu) — aria ŽE nosi akcija+cilj+števec;
//   2. per-draft 'Sinhroniziraj' → NOVI title (kaj se pošlje + kaj se zgodi
//      ob neuspehu — repost telo VERBATIM, neuspeh ostane osnutek);
//   3. discard 'X' → NOVI title (iskrena posledica: ni bil nikoli poslan v
//      bazo — aria nosi akcija+cilj, title kontekst);
//   4. 'Podvoji' gumb → ring PARITETA: stale navy/40 BREZ offset-2 →
//      offset-2 dopolnjen (precedens val 40 InlineInclinometer reopen);
//   5. 'Kopiraj' (bulk v segment) → ring PARITETA: stale navy/40 BREZ
//      offset-2 → offset-2 dopolnjen.
// Testi:
// (A) syncAll blok strukturno: aria + NOVI title + ring offset-2 v ISTEM
//     bloku (vrstni red attrs: aria-label → title → className);
// (B) per-draft Sinhroniziraj blok strukturno: aria + NOVI title + ring;
// (C) discard blok strukturno: aria + NOVI title + ring red/40 + offset-2;
// (D) Podvoji gumb: className nosi navy/40 IN offset-2 (ring PARITETA);
// (E) Kopiraj gumb: className nosi navy/40 IN offset-2 (ring PARITETA);
// (F) 0 novih hex (tab + modul vnos-meritve — stil = žetonski razredi);
// (G) obrnjena regresija: starejše ere (val 40 ×3 + val 39 WPC + val 38
//     KATALOG) ostanejo ŽIVE — parity nikoli ne ulomi prejšnjih valov;
// (H) ring kanon konzistenca: polni niz 'ring-2 ... navy/40 ... offset-2'
//     prisoten; 3 NOVI titleji = enolični nizi (era-diskriminatorji — vsak
//     se pojavi točno ×1).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const tab = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const modul = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/vnos-meritve.ts'), 'utf8')

const RING_KANON = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'

describe('r358 STIL val 41 — a11y parity FAZA 11 (repost) družine', () => {
  it('(A) syncAll blok strukturno: aria (števec) + NOVI title (determinističen vrstni red) + ring offset-2 — isti blok', () => {
    const z = tab.indexOf('aria-label={`Sinhroniziraj vse osnutke (${drafts.length}) v bazo`}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 600)
    expect(okno).toContain('title="Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu"')
    expect(okno).toContain(RING_KANON)
  })

  it('(B) per-draft Sinhroniziraj blok: aria + NOVI title (telo VERBATIM, neuspeh ostane osnutek) + ring — isti blok', () => {
    const z = tab.indexOf('aria-label={`Sinhroniziraj osnutek ${d.label || \'brez oznake\'} v bazo`}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 600)
    expect(okno).toContain('title="Pošlji shranjeno telo osnutka v bazo (neuspeh ostane lokalni osnutek)"')
    expect(okno).toContain(RING_KANON)
  })

  it('(C) discard blok: aria (nič nikoli v bazi) + NOVI title (iskrena posledica) + ring red/40 offset-2 — isti blok', () => {
    const z = tab.indexOf('aria-label={`Odstrani osnutek ${d.label || \'brez oznake\'} (ni bil nikoli v bazi)`}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 400)
    expect(okno).toContain('title="Odstrani lokalni osnutek — ni bil nikoli poslan v bazo"')
    expect(okno).toContain('focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2')
  })

  it('(D) Podvoji gumb: ring PARITETA — navy/40 IN offset-2 v istem className (precedens val 40 InlineInclinometer reopen)', () => {
    const z = tab.indexOf('onClick={() => handleDuplicateMeasurement(m)}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 400)
    expect(okno).toContain('focus-visible:ring-roksal-navy/40')
    expect(okno).toContain('focus-visible:ring-offset-2')
    // aria + title ostajata (nikoli ne ulomimo obstoječe a11y — samo ring).
    expect(okno).toContain('title="Podvoji meritev"')
    expect(okno).toContain('aria-label={`Podvoji meritev ${m.oznaka || m.id.slice(-4)}`}')
  })

  it('(E) Kopiraj gumb (bulk v segment): ring PARITETA — navy/40 IN offset-2 v istem className', () => {
    const z = tab.indexOf('onClick={handleBulkCopyToSegment}')
    expect(z).toBeGreaterThan(-1)
    const okno = tab.slice(z, z + 800)
    expect(okno).toContain('focus-visible:ring-roksal-navy/40')
    expect(okno).toContain('focus-visible:ring-offset-2')
    expect(okno).toContain('aria-label="Kopiraj izbrane meritve v ciljni segment"')
    expect(okno).toContain('title="Kopiraj izbrane meritve v izbrani ciljni segment"')
  })

  it('(F) 0 novih hex (stil = žetonski razredi — tab + modul)', () => {
    expect(tab.match(/#[0-9a-fA-F]{6}\b/g)).toBeNull()
    expect(modul.match(/#[0-9a-fA-F]{6}\b/g)).toBeNull()
  })

  it('(G) obrnjena regresija: starejše ere (val 40 ×3 + val 39 WPC + val 38 KATALOG) ostanejo ŽIVE — parity ne ulomi prejšnjih valov', () => {
    // val 40 (R357): Scaniraj aria + submit verzija title (tab) + kotomer
    // title (inline-kotomer.tsx — lastna datoteka, chunk-lepel obtiči).
    expect(tab).toContain('aria-label="LiDAR skeniranje meritev — kmalu na voljo"')
    expect(tab).toContain('Shrani novo verzijo — predhodna meritev ostane v zgodovini (korekcijska veriga)')
    const kotomer = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/inline-kotomer.tsx'), 'utf8')
    expect(kotomer).toContain('title="Shrani izmerjeni kot v meritev izbrane lokacije"')
    // val 39 (R356): WPC palice aria prefix (template literal, tab).
    expect(tab).toContain('aria-label={`Dodaj izračunane WPC palice kot meritve v segment ${seg.name}`}')
    // val 38 (R355): KATALOG toast naslov VERBATIM (vodja-dashboard.tsx).
    const vodja = readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')
    expect(vodja).toContain('Avtomatizacijski katalog izvožen ✓')
  })

  it('(H) ring kanon konzistenca + 3 NOVI titleji = enolični era-diskriminatorji (vsak točno ×1)', () => {
    expect(tab).toContain(RING_KANON)
    expect(tab.match(/Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu/g)?.length).toBe(1)
    expect(tab.match(/Pošlji shranjeno telo osnutka v bazo \(neuspeh ostane lokalni osnutek\)/g)?.length).toBe(1)
    expect(tab.match(/Odstrani lokalni osnutek — ni bil nikoli poslan v bazo/g)?.length).toBe(1)
  })
})
