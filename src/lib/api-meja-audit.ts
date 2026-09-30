// ---------------------------------------------------------------------------
// R308 (issue #1 — acceptance 'Add failure cases and malformed-input tests' +
// 'No fake/mock success') — API I/O MEJA («stena ura»): determinističen
// skener ROUTE-HANDLERjev (src/app/api/**/route.ts) na 5 mejnih preverbah.
//
// Načela (vzorec avtomatizacija-audit R294):
//  • 100 % determinizem: čiste funkcije; isti viri = iste kršitve bajtno.
//  • Fail-closed: ne-polje / pokvarjen vir → TypeError z imenom graditelja
//    (string kanon R302 — needleji na produ, NIKOLI identifikatorji).
//  • EN VIR: lexer komentarjev UVOŽEN iz avtomatizacija-audit (NIČ drugega
//    leksra — dva lexerja = dve resnici).
//  • Resnica v KODI, ne v komentarjih: prazen catch blok je kršitev tudi,
//    če ima komentar — komentar je v buildu izgubljen, iskrena resnica
//    mora biti izraz (return / dodelitev), ne opomba (R308 odkritje: 2
//    realni primeri refactorirana na izrecen iskren padec).
//  • Skener NE posega v jedra: bere le vir route datotek (testi podajo
//    { pot, vsebina } iz fs — REALNIM vir vzorec r294).
// ---------------------------------------------------------------------------

import { odstraniKomentarje } from './avtomatizacija-audit'

/** Ena kršitev mejne preverbe na eni datoteki. */
export interface MejaKršitev {
  /** Pot route datoteke (kot prišla iz fs). */
  readonly pot: string
  /** Id preverbe (MEJA_PREVERBE). */
  readonly preverba: string
  /** 1-indeksirana vrstica v ORIGINALNI vsebini (približek čez odstranjene komentarje). */
  readonly vrstica: number
  /** Iskrena razlaga (ASCII kanon — brez diakritike pri identifikatorjih). */
  readonly razlaga: string
}

/** Definicija ene mejne preverbe (diskriminirana po id). */
export interface MejaPreverba {
  readonly id: string
  readonly opis: string
  /** Vrne kršitve (vrstica 1-indeksirana) za ENO datoteko. */
  readonly preveri: (vsebina: string) => readonly { vrstica: number; razlaga: string }[]
}

/** Vsi `await req.json()` / `await request.json()` morajo biti varovani:
 *  `.catch(...)` na klicu ALI znotraj odprtega `try { ... } catch`. */
const JSON_GUARD_ID = 'json-guard'

/** Prazen catch blok = tiha degradacija (prepovedan — resnica v kodi). */
const PRAZNI_CATCH_ID = 'prazni-catch'

/** `as any` na I/O meji = izgubljena validacija vhoda. */
const BREZ_AS_ANY_ID = 'brez-as-any'

/** 4xx/5xx odgovori morajo nositi `{ error: ... }` ovojnico (kanon 365 uporab). */
const OVOJNICE_ID = 'ovojnice-error'

/** Razvojni ostanki ne smejo prići do meje. */
const TODO_ID = 'todo-ostanki'

const JSON_KLIC = /await (?:req|request)\.json\(\)/g
const JSON_CATCH = /^await (?:req|request)\.json\(\)\s*\.catch\b/
const TRY_TOKEN = /try \{|} catch|} finally|\bfinally \{/g
const PRAZNI_CATCH = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g
const AS_ANY = /\bas\s+any\b/g
const STATUS_45 = /status: [45]\d\d/g

/** Strožni stack-scan: je json klic na offsetu znotraj odprtega try bloka? */
function znotrajTry(brez: string, offset: number): boolean {
  const before = brez.slice(0, offset)
  const odprti: number[] = []
  let m: RegExpExecArray | null
  const tok = new RegExp(TRY_TOKEN.source, 'g')
  while ((m = tok.exec(before)) !== null) {
    if (m[0] === 'try {') odprti.push(m.index)
    else odprti.pop()
  }
  return odprti.length > 0
}

function vrsticaPri(brez: string, offset: number): number {
  return brez.slice(0, offset).split('\n').length
}

/** Vse 5 mejnih preverb — EN VIR resnica (testi + dokumentacija bereta to). */
export const MEJA_PREVERBE: readonly MejaPreverba[] = [
  {
    id: JSON_GUARD_ID,
    opis: 'vsak json() klic je .catch ali znotraj try — pokvarjen body nikoli 500',
    preveri: (vsebina) => {
      const brez = odstraniKomentarje(vsebina)
      const izgube: { vrstica: number; razlaga: string }[] = []
      let m: RegExpExecArray | null
      const re = new RegExp(JSON_KLIC.source, 'g')
      while ((m = re.exec(brez)) !== null) {
        const replica = brez.slice(m.index, m.index + 90)
        if (JSON_CATCH.test(replica)) continue
        if (znotrajTry(brez, m.index)) continue
        izgube.push({
          vrstica: vrsticaPri(brez, m.index),
          razlaga: 'json() brez .catch in brez try — pokvarjen body bi bil 500 (mora biti fail-closed 400)',
        })
      }
      return izgube
    },
  },
  {
    id: PRAZNI_CATCH_ID,
    opis: 'prazen catch blok = tiha degradacija — iskrena resnica mora biti izraz v kodi',
    preveri: (vsebina) => {
      const brez = odstraniKomentarje(vsebina)
      const izgube: { vrstica: number; razlaga: string }[] = []
      let m: RegExpExecArray | null
      const re = new RegExp(PRAZNI_CATCH.source, 'g')
      while ((m = re.exec(brez)) !== null) {
        izgube.push({
          vrstica: vrsticaPri(brez, m.index),
          razlaga: 'prazen catch blok — dodaj izrecen iskren padec (return/dodelitev), ne komentar',
        })
      }
      return izgube
    },
  },
  {
    id: BREZ_AS_ANY_ID,
    opis: 'brez as any na meji — vhod je nezaupan, vsako polje validirano',
    preveri: (vsebina) => {
      const brez = odstraniKomentarje(vsebina)
      const izgube: { vrstica: number; razlaga: string }[] = []
      let m: RegExpExecArray | null
      const re = new RegExp(AS_ANY.source, 'g')
      while ((m = re.exec(brez)) !== null) {
        izgube.push({
          vrstica: vrsticaPri(brez, m.index),
          razlaga: 'as any na I/O meji — validacija vhoda izgubljena',
        })
      }
      return izgube
    },
  },
  {
    id: OVOJNICE_ID,
    opis: '4xx/5xx nosi { error } ovojnico — kanon (365 uporab, nič message/ok na napakah)',
    preveri: (vsebina) => {
      const brez = odstraniKomentarje(vsebina)
      const imaNapako = /(\{ error|\berror:)/.test(brez)
      if (imaNapako) return []
      let m: RegExpExecArray | null
      const re = new RegExp(STATUS_45.source, 'g')
      while ((m = re.exec(brez)) !== null) {
        return [
          {
            vrstica: vrsticaPri(brez, m.index),
            razlaga: '4xx/5xx odgovor brez { error } ovojnice — odjemalec ne dobi berljive resnice',
          },
        ]
      }
      return []
    },
  },
  {
    id: TODO_ID,
    opis: 'razvojni ostanki (TODO-RXXX) ne smejo prići do I/O meje — scan NAD SUROVIM virom (ostanki živijo v komentarjih, ki jih lexer odstrani)',
    preveri: (vsebina) => {
      // namenjeno NAD SUROVO vsebino: razvojni marker je po konvenciji v
      // komentarju — odstraniKomentarje bi ga pravkar izgubil (lekcija
      // R303 2: vsaka preverba mora skenirati PRAVO plast)
      const izgube: { vrstica: number; razlaga: string }[] = []
      let m: RegExpExecArray | null
      const re = /TODO-R\d\d\d/g
      while ((m = re.exec(vsebina)) !== null) {
        izgube.push({
          vrstica: vsebina.slice(0, m.index).split('\n').length,
          razlaga: 'razvojni ostanek TODO-RXXX v route datoteki',
        })
      }
      return izgube
    },
  },
] as const

/** Pregledaj mrežo route virov na vseh 5 preverbah. ČISTO + deterministično:
 *  isti viri = iste kršitve bajtno (vrstni red: vi po vhodu, preverbe po
 *  MEJA_PREVERBE vrstnem redu). Fail-closed na pokvarjenem vhodu. */
export function pregledajApiMejo(
  viri: readonly { pot: string; vsebina: string }[],
): MejaKršitev[] {
  if (!Array.isArray(viri)) {
    throw new TypeError('pregledajApiMejo: pričakovano polje virov')
  }
  const kršitve: MejaKršitev[] = []
  for (const vir of viri) {
    if (!vir || typeof vir.pot !== 'string' || vir.pot.trim() === '') {
      throw new TypeError('pregledajApiMejo: vir brez poti (pričakovano { pot, vsebina })')
    }
    if (typeof vir.vsebina !== 'string') {
      throw new TypeError(`pregledajApiMejo: vsebina ni niz (${vir.pot})`)
    }
    for (const preverba of MEJA_PREVERBE) {
      for (const najdba of preverba.preveri(vir.vsebina)) {
        kršitve.push({
          pot: vir.pot,
          preverba: preverba.id,
          vrstica: najdba.vrstica,
          razlaga: najdba.razlaga,
        })
      }
    }
  }
  return kršitve
}
