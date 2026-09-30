// ---------------------------------------------------------------------------
// R312 — 42. člen issue #1 (Deliverable 6): MERITVE ZMOGLJIVOSTI — iskrene
// meritve pomembnih determinističnih operacij (VIZ/avtomatizacija jedra).
// ---------------------------------------------------------------------------
// Issue #1 (engineering requirements): «Measure execution time for important
// VIZ/automation operations» + Deliverable 6 «performance measurements».
//
// ISKRENOST (kontrakt — nikoli izmišljenih števil):
//  • Merjeno je REALNO izvajanje pravih funkcij jedra na fiksnih,
//    predstavitvenih vhodih (isti vhodi za vse iteracije in vse naprave).
//  • Čas je strojno odvisna resnica: pregled nosi izrecno 'na tej napravi'
//    kontekst (sklep + enota), NIKOLI pretendira na univerzalnost.
//  • STRUKTURA pregleda je 100 % deterministična: isti seznam operacij,
//    isti števec iteracij, ISTA zaporedja (deterministični vhodi →
//    deterministični izhodi — kanon issue #1), preverba vsakega izhoda.
//    Uro je MOGOČE vbrizgati (DI) — testi dokazujejo bajtno enakost.
//  • Vsak izhod vsake iteracije se PREVERI (preveri-izhod kontrakt) —
//    merjenje pokvare funkcije bi bilo lažna resnica → TypeError.
//  • Fail-closed: ne-polje operacij / manjkajoči kontrakt / < 3 iteracij /
//    negativen delta (ura je tekla nazaj) / pokvaren izhod → TypeError z
//    imenom graditelja (kanon R299/R302/R306/R311).
//  • Nič odvisnosti od omrežja/db/AI — čiste funkcije jedra; jedro NIČ
//    (samo branje + merjenje, ZERO-MUTACIJA po konstrukciji).
// ---------------------------------------------------------------------------

import { calculateRailingSpacing, calculateWindLoad } from '@/lib/calculator'
import type { RailingCalcInput, RailingCalcResult, WindLoadCalcInput, WindLoadCalcResult } from '@/lib/calculator'
import { tedenskiKonflikti } from '@/lib/tedenski-konflikti'
import type { TedenskiKonfliktPregled } from '@/lib/tedenski-konflikti'
import { konfliktiDokaz } from '@/lib/konflikti-dokaz'
import { konfliktiCsv } from '@/lib/konflikti-csv'
import { buildKonfliktiPdfDoc } from '@/lib/konflikti-pdf'
import { buildRacuniProjektiPdfDoc } from '@/lib/racuni-projekti-pdf'
import type { RacuniProjektiRacun, RacuniProjektiProjekt } from '@/lib/racuni-projekti-pdf'
import { buildTerminiCsv } from '@/lib/termini-csv'
import { vsotaPredvidenihUr } from '@/lib/termini-prikaz'
import type { TerminPrikazVnos } from '@/lib/termini-prikaz'
import type { VozniRedTermin } from '@/lib/logistika-vozni-red-pdf'
import { aiRabaPregled } from '@/lib/ai-raba-pregled'

/** Ura: (prej, zdaj) → min/mediana/max iz delt. DI za teste (kanon:
 *  determinizem skozi vbrizgano uro, realna ura = performance.now). */
export type ZmogljivostUra = () => number

/** Enota merjenja — samo ms (kurzorna resnica; µs bi pretvarjanje skrilo). */
export type ZmogljivostEnota = 'ms'

export interface ZmogljivostMeritev {
  /** Stabilni id operacije (npr. 'calculator.razmik') — ključ zaslona. */
  readonly id: string
  /** Iskren opis merjene operacije (kaj je realno izvedeno). */
  readonly opis: string
  /** Pot modula jedra (katalog kanon R294 — vir resnice je vidna). */
  readonly modul: string
  /** Število izvedenih iteracij (vsak izhod preverjen). */
  readonly iteracij: number
  readonly enota: ZmogljivostEnota
  /** Najkrajši izmerjeni delta (ms) — spodnja meja stroja. */
  readonly najmanj: number
  /** Mediana delt (ms) — predstavljivost brez skrivanja repka. */
  readonly mediana: number
  /** Najdaljši izmerjeni delta (ms) — iskrena zgornja meja. */
  readonly najvec: number
  /** true = vsi izhodi vseh iteracij preverjeni (nikoli false v izhodu —
   *  pokvaren izhod je TypeError, ne meritve). */
  readonly preverjeno: true
}

export interface ZmogljivostPregled {
  /** Meritve v ISTEM redu kot operacije (determinizem — nič re-sorta). */
  readonly meritve: readonly ZmogljivostMeritev[]
  readonly skupajIteracij: number
  /** WYSIWYG sklep — zaslon + testi + prihodnji izvozi berejo ISTI niz. */
  readonly sklep: string
}

/** Interna specifikacija ene operacije (kontrakt brez izjem — vsaka
 *  operacija NOSI fiksni vhod + preverbo izhoda). */
interface ZmogljivostOpSpec {
  readonly id: string
  readonly opis: string
  readonly modul: string
  readonly iteracij: number
  /** Izvede ENO iteracijo na fiksne vhode (čista — nič stanja). */
  readonly izvedi: () => unknown
  /** Preverba izhoda (deterministična resnica funkcije). */
  readonly preveri: (izhod: unknown) => boolean
}

// --- Fiksni predstavitveni vhodi (ISTI za vse iteracije in naprave) ---
// Kanon iskrenosti: vhodi so sintetični, ampak STRUKTURNO realni (isti
// tipe/oblike kot produkcija) — merijo strojno ceno JEDRA, ne povedo nič
// o podatkih strank. Nič osebnih podatkov, nič izmišljenih števil na
// zaslonu (meritve so realno izmerjene; vhodi so konstante knjižnice).

const NOW_FIKSNI = new Date('2026-09-21T10:00:00Z')

/** 48 terminov v 7-dnevnem oknu, 4 ekipe × 12 — oblika iz testov R300/R301
 *  (poli-odprta prekrivanja, realen status razpon). */
function termin(p: Partial<VozniRedTermin> & { datumZacetka: string }): VozniRedTermin {
  return {
    datumKonca: null,
    status: 'NAVRTENO',
    predvideneUre: null,
    projekt: null,
    stranka: null,
    ekipa: null,
    lokacija: null,
    ...p,
  }
}

const TERMINI_FIKSNI: readonly VozniRedTermin[] = (() => {
  const ekipe = ['E1', 'E2', 'E3', 'E4']
  const statusi = ['NAVRTENO', 'V_TEKU', 'PRELOZENO'] as const
  const izhod: VozniRedTermin[] = []
  for (let k = 0; k < ekipe.length; k++) {
    const dan = 21 + k
    const ekipa = ekipe[k]!
    // Dokazano prekrivanje (poli-odprto [8,12) ∩ [10,14) ≠ ∅) — pregled
    // MORA imeti pare (konstruktor knjižnice fail-closed na praznino).
    izhod.push(
      termin({
        datumZacetka: `2026-09-${dan}T08:00:00Z`,
        datumKonca: `2026-09-${dan}T12:00:00Z`,
        status: 'NAVRTENO',
        projekt: `P-${100 + k}`,
        ekipa,
      }),
      termin({
        datumZacetka: `2026-09-${dan}T10:00:00Z`,
        datumKonca: `2026-09-${dan}T14:00:00Z`,
        status: 'V_TEKU',
        projekt: `P-${110 + k}`,
        ekipa,
      }),
    )
    // 10 zapolnitev (volumen za realen benchmark): razporejeni dnevi,
    // 2 h okna — naključna združitev tvori dodatne pare (težje = boljše).
    for (let j = 0; j < 10; j++) {
      const danF = 21 + ((k + j + 1) % 7)
      izhod.push(
        termin({
          datumZacetka: `2026-09-${danF}T16:00:00Z`,
          datumKonca: `2026-09-${danF}T18:00:00Z`,
          status: statusi[(k + j) % statusi.length]!,
          projekt: `P-${200 + k * 10 + j}`,
          ekipa,
        }),
      )
    }
  }
  return izhod
})()

const PREGLED_FIKSNI: TedenskiKonfliktPregled = (() => {
  const pregled = tedenskiKonflikti(TERMINI_FIKSNI, NOW_FIKSNI)
  if (pregled === null) {
    throw new TypeError('zmogljivost-pregled: fiksni vhodi MORAJO proizvesti pregled (konstruktor knjižnice pokvaren)')
  }
  return pregled
})()

const PRIKAZNI_FIKSNI: readonly TerminPrikazVnos[] = TERMINI_FIKSNI.map((t, i) => ({
  id: `e2e-${i}`,
  projectId: `proj-${i}`,
  projektIme: t.projekt,
  strankaIme: t.stranka,
  strankaNaslov: null,
  lokacija: t.lokacija,
  ekipaIme: t.ekipa,
  monterId: null,
  monterIme: null,
  status: t.status,
  datumZacetka: t.datumZacetka,
  predvideneUre: 4 + (i % 3),
  moja: false,
}))

const RAZMIK_FIKSNI: RailingCalcInput = {
  totalLengthMm: 3000,
  slatWidthMm: 100,
  maxGapMm: 99,
  profileType: 'classic',
}

const VETRNA_FIKSNI: WindLoadCalcInput = {
  heightAboveGround: 12,
  terrainCategory: 'II',
  windSpeedMs: 28,
  railingAreaM2: 9,
  railingType: 'slatted',
}

const PDF_MAGIJA = '%PDF-'

/** %PDF- magija iz ArrayBuffer (String.fromCharCode — brez TextDecoder
 *  odvisnosti; determinističen ASCII preveri). */
function jePdf(buf: unknown): boolean {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < 5) return false
  const u8 = new Uint8Array(buf.slice(0, 5))
  return String.fromCharCode(u8[0]!, u8[1]!, u8[2]!, u8[3]!, u8[4]!) === PDF_MAGIJA
}

const RACUNI_FIKSNI: readonly RacuniProjektiRacun[] = (() => {
  const statusi = ['IZDAN', 'PLACAN', 'OSNUTEK'] as const
  const izhod: RacuniProjektiRacun[] = []
  for (let i = 0; i < 12; i++) {
    izhod.push({
      stevilka: `2026-${String(101 + i).padStart(3, '0')}`,
      status: statusi[i % statusi.length]!,
      znesek: 450 + i * 37.5,
      projectId: `proj-${i % 4}`,
      projekt: `Projekt ${i % 4}`,
    })
  }
  return izhod
})()

const PROJEKTI_FIKSNI: readonly RacuniProjektiProjekt[] = [0, 1, 2, 3].map((i) => ({
  id: `proj-${i}`,
  nazivProjekta: `Projekt ${i}`,
  estimatedPrice: i % 2 === 0 ? 2500 + i * 100 : null,
}))

/** Registracija operacij (EN VIR za merjenje in zaslon). Nova operacija =
 *  nova vrstica tukaj + preverba izhoda — test STRAŽAR zahteva oba. */
export const ZMOGLJIVOST_OPS: readonly ZmogljivostOpSpec[] = [
  {
    id: 'calculator.razmik',
    opis: 'Kalkulator razmikov letvic (jedro kalkulatorja)',
    modul: 'src/lib/calculator.ts',
    iteracij: 400,
    izvedi: () => calculateRailingSpacing(RAZMIK_FIKSNI),
    preveri: (i) => {
      const r = i as RailingCalcResult
      return (
        r.slatCount > 0 &&
        typeof r.actualGapMm === 'number' &&
        Number.isFinite(r.actualGapMm) &&
        r.actualGapMm <= 100 &&
        r.isCompliant === true
      )
    },
  },
  {
    id: 'calculator.vetrna',
    opis: 'Vetrna obremenitev (SLO pravila, jedro kalkulatorja)',
    modul: 'src/lib/calculator.ts',
    iteracij: 400,
    izvedi: () => calculateWindLoad(VETRNA_FIKSNI),
    preveri: (i) => {
      const r = i as WindLoadCalcResult
      return (
        r.windPressureKpa > 0 &&
        Number.isFinite(r.totalForceKn) &&
        (r.riskLevel === 'LOW' || r.riskLevel === 'MEDIUM' || r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL')
      )
    },
  },
  {
    id: 'konflikti.pregled',
    opis: 'Tedenski konfliktni pregled (48 terminov × 4 ekipe)',
    modul: 'src/lib/tedenski-konflikti.ts',
    iteracij: 200,
    izvedi: () => tedenskiKonflikti(TERMINI_FIKSNI, NOW_FIKSNI),
    preveri: (i) => {
      const r = i as TedenskiKonfliktPregled | null
      return r !== null && r.pregledanih > 0 && r.skupine.length === 4
    },
  },
  {
    id: 'konflikti.dokaz',
    opis: 'Konfliktni dokaz na zaslonu (preslikava pregleda)',
    modul: 'src/lib/konflikti-dokaz.ts',
    iteracij: 200,
    izvedi: () => konfliktiDokaz(PREGLED_FIKSNI),
    preveri: (i) => Array.isArray(i) && i.length > 0,
  },
  {
    id: 'konflikti.csv',
    opis: 'Konflikti CSV (celoten niz + meta)',
    modul: 'src/lib/konflikti-csv.ts',
    iteracij: 100,
    izvedi: () => konfliktiCsv(TERMINI_FIKSNI, NOW_FIKSNI),
    preveri: (i) => {
      const r = i as { csv: string; vrstic: number }
      return typeof r.csv === 'string' && r.csv.startsWith('\uFEFF') && r.vrstic > 1
    },
  },
  {
    id: 'termini.urAgregat',
    opis: 'Agregat predvidenih ur (48 prikaznih vrstic)',
    modul: 'src/lib/termini-prikaz.ts',
    iteracij: 200,
    izvedi: () => vsotaPredvidenihUr(PRIKAZNI_FIKSNI),
    preveri: (i) => {
      const r = i as { ure: number; stTerminov: number }
      return r.ure > 0 && r.stTerminov === 48
    },
  },
  {
    id: 'termini.csv',
    opis: 'Termini CSV (celoten niz + povzetek)',
    modul: 'src/lib/termini-csv.ts',
    iteracij: 100,
    izvedi: () =>
      buildTerminiCsv(PRIKAZNI_FIKSNI, {
        urAgregat: vsotaPredvidenihUr(PRIKAZNI_FIKSNI),
        osvezitev: NOW_FIKSNI,
        now: NOW_FIKSNI,
        samoMoje: false,
      }),
    preveri: (i) => {
      const r = i as { csv: string; vrstic: number }
      return typeof r.csv === 'string' && r.csv.startsWith('\uFEFF') && r.vrstic === 48
    },
  },
  {
    id: 'ai-raba.pregled',
    opis: 'AI raba pregled (projekcija kataloga)',
    modul: 'src/lib/ai-raba-pregled.ts',
    iteracij: 200,
    izvedi: () => aiRabaPregled(),
    preveri: (i) => {
      const r = i as { stAi: number; zive: unknown[] }
      return r.stAi === 2 && Array.isArray(r.zive) && r.zive.length === 2
    },
  },
  {
    id: 'konflikti.pdf',
    opis: 'Konflikti PDF dokument (fonts + autoTable + bajti)',
    modul: 'src/lib/konflikti-pdf.ts',
    iteracij: 4,
    izvedi: () => buildKonfliktiPdfDoc(TERMINI_FIKSNI, { now: NOW_FIKSNI }).output('arraybuffer'),
    preveri: (i) => jePdf(i),
  },
  {
    id: 'racuni-projekti.pdf',
    opis: 'Računi po projektih PDF (12 računov × 4 projekti)',
    modul: 'src/lib/racuni-projekti-pdf.ts',
    iteracij: 4,
    izvedi: () =>
      buildRacuniProjektiPdfDoc(RACUNI_FIKSNI, PROJEKTI_FIKSNI, { now: NOW_FIKSNI }).output('arraybuffer'),
    preveri: (i) => jePdf(i),
  },
]

/** Mediana delt (klasična: središče sortiranih; sod n = povprečje srednjih
 *  dveh). Deterministična postprodaja — nič napredne statistike. */
function medianaDelt(delt: readonly number[]): number {
  const s = [...delt].sort((a, b) => a - b)
  const n = s.length
  const mid = Math.floor(n / 2)
  return n % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** 🆕 R321 (50. člen issue #1 IZVOZI družina): EN VIR formatiranje milisekund
 *  — ISTI izraz za zaslon (vodja zmogljivost-vrstice), testi IN PDF izvoz:
 *  < 100 ms = dve decimalki ('12.34'), ≥ 100 ms = zaokroženo celo število
 *  ('123'). Ena definicija — zaslon in PDF ne moreta divergirati po
 *  konstrukciji (vzorec AUDIT_CSV_GLAVE R317). Fail-closed: ne-končna
 *  vrednost → TypeError (izmišljena številka ne sme biti izpisana). */
export function formatirajMs(v: number): string {
  if (!Number.isFinite(v)) {
    throw new TypeError('formatirajMs: pričakovana končna vrednost (ms)')
  }
  return v >= 100 ? String(Math.round(v)) : v.toFixed(2)
}

// ---------------------------------------------------------------------------
// 🆕 R323 — 51. člen issue #1 (IZVOZI družina): EN VIR izvozni kontrakt
// meritev zmogljivosti (glave + vir niz + fail-closed validacija) — VSA
// izvozna raba (CSV R322 + PDF R321 brat) bere ISTA konstante in ISTO
// validacijo iz tega liba (vzorec AUDIT_CSV_GLAVE R317: glava EN VIR za
// celo izvozno družino — zaslon, CSV in PDF ne moreta divergirati po
// konstrukciji). Validacija je bila R321 zasebna v PDF bratu — dvignjena
// sem (isti pogodbi, ISTA sporočila verbatim — kje parametriziran z imenom
// graditelja), da CSV brat NE duplicira pravil in NE uvaža jsPDF teže.
// ---------------------------------------------------------------------------

/** Glave izvoza meritev (WYSIWYG — ISTI stolpci kot tabela PDF R321 in
 *  vrstice zaslona R312: Operacija · Opis · Modul · Iteracij · Najmanj ·
 *  Mediana · Najvec; časi prikazno prek formatirajMs EN VIR — enota 'ms'
 *  nosi sklep/KPI, NE glave — ISTA odločitev kot PDF R321). IZVOŽENO —
 *  CSV brat (R322) in PDF brat (R321) uvažata ISTI niz → stolpci NE moreta
 *  divergirati po konstrukciji. */
export const ZMOGLJIVOST_IZVOZ_GLAVE: readonly string[] = [
  'Operacija',
  'Opis',
  'Modul',
  'Iteracij',
  'Najmanj',
  'Mediana',
  'Najvec',
]

/** Iskren vir niz meta vrstice (EN VIR za CSV 'Vir;…' — vzorec AUDIT_VIR_NIZ
 *  R318). Brez časa/hash — determinizem kanon 46.–50. člen (isti HEAD =
 *  bajtno identičen izvoz). */
export const ZMOGLJIVOST_VIR_NIZ =
  'MERITVE_ZMOGLJIVOST — isti HEAD = bajtno identičen izvoz'

/** Fail-closed validacija pregleda ZA IZVOZ (kontrakt brez izjem — vzorec
 *  izmeriZmogljivost R312: pokvaren vhod ne more postati lažna resnica).
 *  EN VIR za vse izvozne brate (CSV R322 + PDF R321 — kje = ime graditelja,
 *  sporočila ostanejo IDENTIČNA kot R321 [regex pini testov ostanejo
 *  zeleni]). Pravila (×7 skupin): ne-objekt pregled / prazne meritve
 *  [brez izvedene meritve ni izmišljenih števil] / sklep / skupajIteracij /
 *  meritev brez kontrakta (id/opis/modul/iteracij ≥ 3/enota 'ms'/ne-končni
 *  ali negativni časi/najmanj > mediana > najvec/preverjeno !== true) /
 *  zip usklajenost (vsota iteracij === skupajIteracij). */
export function preveriZmogljivostPregledZaIzvoz(
  pregled: ZmogljivostPregled,
  kje: string,
): void {
  if (!pregled || typeof pregled !== 'object') {
    throw new TypeError(`${kje}: pričakovan pregled (ZmogljivostPregled)`)
  }
  if (!Array.isArray(pregled.meritve) || pregled.meritve.length === 0) {
    throw new TypeError(`${kje}: pregled brez meritev — brez izvedene meritve ni izmišljenih števil`)
  }
  if (typeof pregled.sklep !== 'string' || pregled.sklep.length === 0) {
    throw new TypeError(`${kje}: pričakovan sklep (WYSIWYG — EN VIR niz)`)
  }
  if (!Number.isInteger(pregled.skupajIteracij) || pregled.skupajIteracij <= 0) {
    throw new TypeError(`${kje}: pričakovan pozitiven skupajIteracij (števec resnice)`)
  }
  for (let i = 0; i < pregled.meritve.length; i++) {
    const m = pregled.meritve[i]!
    const kjeMeritev = `${kje}: meritev ${i}`
    if (!m || typeof m !== 'object') {
      throw new TypeError(`${kjeMeritev}: pričakovan objekt meritve`)
    }
    if (typeof m.id !== 'string' || m.id.length === 0) {
      throw new TypeError(`${kjeMeritev}: pričakovan id (nestabilni ključ zaslona)`)
    }
    if (typeof m.opis !== 'string' || m.opis.length === 0) {
      throw new TypeError(`${kjeMeritev} (${m.id}): pričakovan iskren opis operacije`)
    }
    if (typeof m.modul !== 'string' || m.modul.length === 0) {
      throw new TypeError(`${kjeMeritev} (${m.id}): pričakovana pot modula (katalog kanon R294)`)
    }
    if (!Number.isInteger(m.iteracij) || m.iteracij < 3) {
      throw new TypeError(`${kjeMeritev} (${m.id}): pričakovano ≥ 3 iteracij (mediana brez njih ni resnica)`)
    }
    if (m.enota !== 'ms') {
      throw new TypeError(`${kjeMeritev} (${m.id}): pričakovana enota 'ms' (kurzorna resnica — µs bi pretvarjanje skrilo)`)
    }
    for (const k of ['najmanj', 'mediana', 'najvec'] as const) {
      if (!Number.isFinite(m[k]) || m[k] < 0) {
        throw new TypeError(`${kjeMeritev} (${m.id}): pričakovan končen, negativen ${k} (ms)`)
      }
    }
    if (m.najmanj > m.mediana || m.mediana > m.najvec) {
      throw new TypeError(`${kjeMeritev} (${m.id}): notranja neskladja časov (najmanj ≤ mediana ≤ najvec) — fail-closed`)
    }
    if (m.preverjeno !== true) {
      throw new TypeError(`${kjeMeritev} (${m.id}): meritev NI preverjena — merjenje pokvare funkcije bi bilo lažna resnica`)
    }
  }
  // Zip usklajenost: skupajIteracij MORA biti vsota po meritvah (števec
  // resnice — notranja neskladja = fail-closed, vzorec zip R318/R320/R321).
  const vsotaIteracij = pregled.meritve.reduce((s, m) => s + m.iteracij, 0)
  if (vsotaIteracij !== pregled.skupajIteracij) {
    throw new TypeError(
      `${kje}: notranja neskladja skupajIteracij (vsota po meritvah) — fail-closed`,
    )
  }
}

/** IZMERI ZMOGLJIVOST — izvede vse registrirane operacije, meri delt po
 *  iteraciji, preveri vsak izhod. Uro je mogoče vbrizgati (DI — testi;
 *  produkcija = performance.now). Vrne deterministično strukturo z realno
 *  merjenimi časi.
 *
 *  Fail-closed: ne-polje operacij / op brez kontrakta / < 3 iteracij /
 *  negativen delta / izhod, ki ne preveri → TypeError z imenom graditelja. */
export function izmeriZmogljivost(
  ops: readonly ZmogljivostOpSpec[] = ZMOGLJIVOST_OPS,
  ura: ZmogljivostUra = () => performance.now(),
): ZmogljivostPregled {
  if (!Array.isArray(ops)) {
    throw new TypeError('izmeriZmogljivost: pričakovano polje operacij')
  }
  const meritve: ZmogljivostMeritev[] = []
  let skupajIteracij = 0
  for (const op of ops) {
    if (
      !op ||
      typeof op !== 'object' ||
      typeof op.id !== 'string' ||
      op.id.length === 0 ||
      typeof op.izvedi !== 'function' ||
      typeof op.preveri !== 'function'
    ) {
      throw new TypeError('izmeriZmogljivost: operacija brez kontrakta (id/izvedi/preveri)')
    }
    if (!Number.isInteger(op.iteracij) || op.iteracij < 3) {
      throw new TypeError(`izmeriZmogljivost: operacija '${op.id}' rabi ≥ 3 iteracij (mediana brez njih ni resnica)`)
    }
    const delt: number[] = []
    let preverjeno = true
    for (let i = 0; i < op.iteracij; i++) {
      const zacetek = ura()
      const izhod = op.izvedi()
      const konec = ura()
      const delta = konec - zacetek
      if (!Number.isFinite(delta) || delta < 0) {
        throw new TypeError(`izmeriZmogljivost: operacija '${op.id}' — ura je tekla nazaj ali pokvarjena (delta ${String(delta)})`)
      }
      if (!op.preveri(izhod)) {
        preverjeno = false
        break
      }
      delt.push(delta)
    }
    if (!preverjeno) {
      throw new TypeError(
        `izmeriZmogljivost: operacija '${op.id}' — izhod NE preveri (merjenje pokvare funkcije bi bilo lažna resnica)`,
      )
    }
    meritve.push({
      id: op.id,
      opis: op.opis,
      modul: op.modul,
      iteracij: op.iteracij,
      enota: 'ms',
      najmanj: Math.min(...delt),
      mediana: medianaDelt(delt),
      najvec: Math.max(...delt),
      preverjeno: true,
    })
    skupajIteracij += op.iteracij
  }
  const sklop = `Merjeno na tej napravi: ${meritve.length} operacij · ${skupajIteracij} iteracij · vsi izhodi preverjeni — časi so resnična meritev (strojno odvisna), struktura in izhodi deterministični.`
  return { meritve, skupajIteracij, sklep: sklop }
}
