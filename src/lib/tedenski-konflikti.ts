// ---------------------------------------------------------------------------
// R300 (P1, issue #1 §7 — scheduling conflict detection, branje) — TEDENSKI
// KONFLIKTNI PREGLED iz logistike (logistics-tab). Zapišna stran že obstaja
// (R142/R145: POST/PATCH /api/schedules vrne 409 z razlogom prek
// schedule-conflicts.ts — findResourceConflicts/findEquipmentConflicts);
// ta lib je MANJKAJOČA BRALNA stran: determinističen pregled 7-dnevnega
// okna tedenske družine (danes + 6, UTC — ISTO okno kot PDF R256 / CSV
// R292 / ICS R298 / ICS po ekipah R299), ki DOKAŽE invarianto ("vsi vidni
// termini v oknu brez dvojnih rezervacij ekipe") ALI iskreno pokaže
// kršitve (stari vpisi pred pravilom, uvoženi podatki, preimenovane ekipe).
//
// SERVER-DOMNA RAZMEJITEV (pomembno — glej glavo vzorca quote-repro 'ločena
// kopija, da jedri ostanejo neodvisna'): schedule-conflicts.ts uvaža
// @/lib/db (Prisma — SAMO strežnik), zato ga čist klientski lib NE SME
// uvažati. Primitiva poli-odprtega prekrivanja in tabela aktivnih statusov
// sta tu DOKUMENTIRANO zrcaljeni (ISTI semantika, isti niz) — STRAŽAR test
// (r300) bere OBE datoteki in uveljavlja sinhronizacijo dobesednega niza:
// sprememba pravila na strežniški strani brez zavestne posodobitve zrcala
// NE gre skozi. Ostale primitivne izpeljave so UVOŽENE (EN VIR):
//  • okno = tedenskiOknoDnevi (UVOŽENO iz tedenski-vozni-red-pdf — ISTA UTC
//    aritmetika kot bratje R256/R292/R298/R299);
//  • pregled vnosa = preveriVozniRedTermin (UVOŽEN — ISTI fail-closed
//    pregled kot celotna tedenska družina, indeks krivca VEDNO v sporočilu);
//  • tip vrstice = VozniRedTermin (UVOŽEN — ISTI DTO kot zaslon/izvozi).
//
// Pravila prekrivanja (ISTO kot R142 API 409, dokumentirano v glavi
// schedule-conflicts.ts):
//  • POLI-ODPRTO [zacetek, konec): konec 12:00 + začetek 12:00 = dovoljen
//    nazaj-na-nazaj (ekipa lahko takoj na novo lokacijo) — NIKOLI lažni
//    konflikt;
//  • STATUSI, ki držijo vir zasedenega: NAVRTENO / V_TEKU / PRELOZENO;
//    PREKlicANO (odpovedano) IN ZAKLJUCENO (zgodovina) NE zasedejo;
//  • brez datumKonca (R168 null) = NI dokazanega prekrivanja — natančno
//    kot strežniški stavek (datumKonca gt okno izpusti NULL vrstice —
//    NIKOLI izmišljen konec, NIKOLI izmišljen konflikt);
//  • brez ekipe (null — '—' na zaslonu) = NI vira, ki bi ga lahko dvojno
//    rezervirali (ISTO pravilo kot API: 'brez obeh virov je rezultat
//    prazen') — iskrena divergenca od API-ja DOKUMENTIRANA: API preverja
//    tudi monterja (ID), branje nad DTO pa vidi samo ekipa-naziv — to je
//    resnica RAZGLEDA (isti vir kot izvozi), ne kopija DB preverbe.
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje / pokvaren vnos (uvožen pregled — indeks krivca)
//    / pokvaren now → TypeError (nikoli tiho spregledano).
//  • Determinizem: `now` KOT parameter (F4); skupine ASC po ekipa (UTF-16 <
//    kanon R245/R250 — NIKOLI localeCompare); pari po sortiranem času
//    (f(množica) — premešan odgovor = ISTI pregled).
//  • PRAZNO okno / 0 konfliktov: VELJAVNO (pregled vrne null — iskrena
//    čistost; komponenta pokaže zelen žig '0'). DOMAIN pravilo tedenske
//    družine — okno VEDNO obstaja.
// ---------------------------------------------------------------------------

import {
  tedenskiOknoDnevi,
} from './tedenski-vozni-red-pdf'
import {
  preveriVozniRedTermin,
  type VozniRedTermin,
} from './logistika-vozni-red-pdf'

/** Zrcalo SCHEDULE_ACTIVE_STATUSES (schedule-conflicts.ts R142 — STRAŽAR
 *  test uveljavlja dobesedno sinhronizacijo; glej glavo). */
export const KONFLIKT_AKTIVNI_STATUSI = ['NAVRTENO', 'V_TEKU', 'PRELOZENO'] as const

/** Zrcalo statusHoldsResource (R142) — ISTA tabela. */
export function konfliktStatusDrzi(status: string): boolean {
  return (KONFLIKT_AKTIVNI_STATUSI as readonly string[]).includes(status)
}

/** Zrcalo overlaps (R142 poli-odprto) — ISTA primerjava `aStart < bEnd &&
 *  bStart < aEnd` (STRAŽAR uveljavlja dobesedno sinhronizacijo; glej glavo). */
export function konfliktPrekrivanje(
  aZacetek: Date,
  aKonec: Date,
  bZacetek: Date,
  bKonec: Date,
): boolean {
  return aZacetek < bKonec && bZacetek < aKonec
}

/** Eden par prekrivajočih si terminov iste ekipe (red vrstic = sortiran
 *  čas ASC — a.ne ZACETEK ≤ b.ne ZACETEK po konstrukciji). */
export interface TedenskiKonfliktPar {
  /** Prvi termin (prejšnji začetek). */
  a: VozniRedTermin
  /** Drugi termin (poznejši ali enak začetek). */
  b: VozniRedTermin
  /** ISO dan, KJER se prekrivanje začne (max začetek, UTC rez — lahko je
   *  prekrivanje čez polnoč: par lahko nosi drug dan kot a.dan). */
  dan: string
}

export interface TedenskiKonfliktSkupina {
  /** Ekipa VERBATIM (istotrjen niz — isti ključ kot filter R299). */
  ekipa: string
  /** Pari v sortiranem redu (čas ASC — f(množica)). */
  pari: TedenskiKonfliktPar[]
}

export interface TedenskiKonfliktPregled {
  /** Skupine po ekipah ASC (UTF-16 <) — prazno polje NIKOLI ne pride ven
   *  (0 konfliktov = null, glej spodaj). */
  skupine: TedenskiKonfliktSkupina[]
  /** Število terminov v oknu, ki so sodelovali v pregledu (aktivni, z
   *  ekipa, z znanim koncem — resnica obsega pregleda). */
  pregledanih: number
  /** Skupno število parov prekrivanja (vsota po skupinah). */
  stPrekrivanj: number
}

/** Sortni ključ para: čas začetka ASC, izenačba po ISO nizu (determinizem
 *  brez localeCompare — kanon R245/R250). */
function sortKljuc(t: VozniRedTermin): number {
  return new Date(t.datumZacetka).getTime()
}

/** TEDENSKI KONFLIKTNI PREGLED — vsi pari aktivnih terminov iste ekipe v
 *  7-dnevnem oknu, ki se poli-odprto prekrivajo. Vrne null, ko je okno
 *  BREZ konfliktov (iskrena čistost — komponenta pokaže zelen žig).
 *  Fail-closed: ne-polje / pokvaren vnos / pokvaren now → TypeError. */
export function tedenskiKonflikti(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): TedenskiKonfliktPregled | null {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiKonflikti: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(vnosi)) {
    throw new TypeError('tedenskiKonflikti: pričakovano polje terminov (VozniRedTermin[])')
  }
  vnosi.forEach((t, i) => preveriVozniRedTermin(t, i))
  const okno = new Set(tedenskiOknoDnevi(now))

  // Kandidati: v oknu, aktiven status, z ekipo, z znanim koncem
  // (null konec = NI dokazanega prekrivanja — glej glavo; termin z
  // obrnjenim/negativnim intervalom NE prekriva — isti izid kot strežniški
  // stavek, nič izmišljenega).
  const poEkipah = new Map<string, VozniRedTermin[]>()
  let pregledanih = 0
  for (const t of vnosi) {
    if (!okno.has(t.datumZacetka.slice(0, 10))) continue
    if (!konfliktStatusDrzi(t.status)) continue
    if (t.ekipa === null) continue
    if (t.datumKonca === null) continue
    pregledanih += 1
    const vr = poEkipah.get(t.ekipa)
    if (vr) vr.push(t)
    else poEkipah.set(t.ekipa, [t])
  }

  const skupine: TedenskiKonfliktSkupina[] = []
  let stPrekrivanj = 0
  const ekipe = Array.from(poEkipah.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  for (const ekipa of ekipe) {
    const vrstice = poEkipah.get(ekipa)!
    vrstice.sort((a, b) => {
      const raz = sortKljuc(a) - sortKljuc(b)
      if (raz !== 0) return raz
      return a.datumZacetka < b.datumZacetka ? -1 : a.datumZacetka > b.datumZacetka ? 1 : 0
    })
    const pari: TedenskiKonfliktPar[] = []
    for (let i = 0; i < vrstice.length; i++) {
      for (let j = i + 1; j < vrstice.length; j++) {
        const a = vrstice[i]!
        const b = vrstice[j]!
        const aZ = new Date(a.datumZacetka)
        const aK = new Date(a.datumKonca!)
        const bZ = new Date(b.datumZacetka)
        const bK = new Date(b.datumKonca!)
        if (!konfliktPrekrivanje(aZ, aK, bZ, bK)) continue
        const zacetekPrekrivanja = aZ.getTime() >= bZ.getTime() ? aZ : bZ
        pari.push({
          a,
          b,
          dan: zacetekPrekrivanja.toISOString().slice(0, 10),
        })
      }
    }
    if (pari.length > 0) {
      skupine.push({ ekipa, pari })
      stPrekrivanj += pari.length
    }
  }
  if (skupine.length === 0) return null
  return { skupine, pregledanih, stPrekrivanj }
}
