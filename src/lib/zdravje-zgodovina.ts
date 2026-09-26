// R188 — čisto jedro zgodovine odzivnih časov (SISTEM — ZDRAVJE kartica,
// 21. površina živostne družine iz R187).
// ---------------------------------------------------------------------------
// Kartica vsako USPEŠNO preverbo /api/public/health izmeri (performance.now
// delta — realna meritev brskalnika, ne ugibanje). Ta modul je VSA odločitev
// in VSA podoba zgodovine: ring obseg, sklanjatev obsega, povzetek za
// bralnik zaslona, višina palice. Komponenta (sistem-zdravje-card.tsx) je
// samo žičenje — vzorec čistih jeder (posodobitev-jedro, meritve-csv,
// telemetrija-csv, audit-csv).
//
// Načela:
//  • Fail-closed: ne-finitna / negativna meritev = TypeError — NIKOLI
//    izmišljena palica ali izmišljen povzetek.
//  • Zgodovina je SAMO iz realnih meritev uspešnih preverb; napaka ali
//    omrežni izpad NE dodata palice (nikoli lažne telemetrije).
//  • Seja-scoped po zasnovi (brez sheme, brez trajnega hranjenja) —
//    oznaka vedno pove 'te seje', da ni pretiranja o dosegu podatkov.

/** Največ meritev v zgodovini (ring — najstarejša pade ven). */
export const ZGODOVINA_MAX = 12

/** Višina najvišje palice v px (ostale sorazmerne, min 3 px za vidljivost). */
export const PALICA_MAX_PX = 28
export const PALICA_MIN_PX = 3

/**
 * Dodaj meritev v zgodovino (čisto): vrni NOVO tabelo z ring obsegom
 * ZGODOVINA_MAX. Fail-closed TypeError na neveljavni meritvi.
 */
export function dodajMeritev(prej: readonly number[], meritev: number): number[] {
  if (!Number.isFinite(meritev) || meritev < 0) {
    throw new TypeError('dodajMeritev: meritev mora biti ne-negativno končno število (ms).')
  }
  return [...prej, meritev].slice(-ZGODOVINA_MAX)
}

/**
 * Vidna oznaka obsega zgodovine s pravilno sklanjatvijo (vzorec R162
 * revizijaLabel: 1/21 vpis, 2/22 vpisa, 3/4 vpisi, 5+ vpisov):
 *   1 → 'Zadnja preverba te seje'
 *   2 → 'Zadnji 2 preverbi te seje'          (dvojina)
 *   3,4 → 'Zadnje 3 preverbe te seje'
 *   5+ → 'Zadnjih 5 preverb te seje'
 * 0 → kratko pošteno 'Ni preverb še.' (klicatelj pas ne izriše, a jedro je
 *     popolno tudi samo zase).
 */
export function obsegZgodovine(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError('obsegZgodovine: n mora biti ne-negativno celo število.')
  }
  if (n === 0) return 'Ni preverb še.'
  if (n === 1) return 'Zadnja preverba te seje'
  if (n === 2) return 'Zadnji 2 preverbi te seje'
  if (n === 3 || n === 4) return `Zadnje ${n} preverbe te seje`
  return `Zadnjih ${n} preverb te seje`
}

/**
 * Povzetek zgodovine za aria-label (role="img" na traku palic) —
 * determinističen, brez PII, samo realne meritve.
 */
export function odziviPovzetek(zgodovina: readonly number[]): string {
  if (!zgodovina.every((ms) => Number.isFinite(ms) && ms >= 0)) {
    throw new TypeError('odziviPovzetek: zgodovina vsebuje neveljavno meritev (ms).')
  }
  const n = zgodovina.length
  if (n === 0) return 'Ni še odzivnih časov — kartica se še preverja.'
  if (n === 1) return `Odzivni čas zadnje uspešne preverbe te seje: ${zgodovina[0]} ms.`
  const min = Math.min(...zgodovina)
  const max = Math.max(...zgodovina)
  // Vstavek po pomišljaju = imenovalniška oblika (obsegZgodovine) — pravilno
  // brez genitivnih sklanjatev za vse n.
  const obseg = obsegZgodovine(n)
  return `Odzivni časi — ${obseg.charAt(0).toLowerCase()}${obseg.slice(1)}: od ${min} do ${max} ms.`
}

/**
 * Višina palice v px (čisto): sorazmerna z maksimumom zgodovine, spodaj
 * omejena na PALICA_MIN_PX, zgoraj na PALICA_MAX_PX. Fail-closed TypeError
 * na neveljavnem vhodu (maxMs <= 0 ali ne-finitno).
 */
export function visinaPalice(ms: number, maxMs: number): number {
  if (!Number.isFinite(ms) || ms < 0 || !Number.isFinite(maxMs) || maxMs <= 0) {
    throw new TypeError('visinaPalice: meritev in maksimum morata biti veljavna (ms > 0 za maksimum).')
  }
  return Math.max(PALICA_MIN_PX, Math.round((ms / maxMs) * PALICA_MAX_PX))
}

// ── Seja shrama (modul-level) ────────────────────────────────────────────────
// E2E nauček R188: vodja dashboard je SAM po sebi refetch-on-focus površina in
// med nalaganjem SKRIJE celotno vsebino (`if (loading)`) → kartica se ob vsaki
// fokus-osvežitvi dashboarda REMONTIRA → komponentni useState zgodovine bi se
// stalno izbrisal (trak brez vrednosti). Shrama na nivoju modula preživi
// remonte znotraj istega DOKUMENTA (seja = od nalaganja strani do osvežitve/
// zaprtja — točno to obljublja oznaka 'te seje'); nič ne gre na strežnik ali
// disk (nič sheme, nič PII, samo realne meritve te seje).

let sejaZgodovina: readonly number[] = []

/** Preberi zgodovino te seje (referenca je imutabilna — kopiraj za render). */
export function sejaZgodovinaPreber(): readonly number[] {
  return sejaZgodovina
}

/**
 * Dodaj realno meritev v zgodovino te seje (modul-level — preživi remonte
 * kartice). Fail-closed: delegira validacijo na dodajMeritev (TypeError).
 */
export function sejaZgodovinaDodaj(ms: number): readonly number[] {
  sejaZgodovina = dodajMeritev(sejaZgodovina, ms)
  return sejaZgodovina
}
