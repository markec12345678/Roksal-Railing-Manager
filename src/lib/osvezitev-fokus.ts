// R170 — osvežitev podatkov ob vrnitvi v zavihek/okno + pečat 'Osveženo ob'.
// ---------------------------------------------------------------------------
// Problem (P1-b iz R169): okno, ki je odprto, medtem ko druga seja (pisarna)
// spremeni status termina, ostane ZASTAREL do remonta komponente. UI sicer
// kliče loadData() po statusnih gumbih, a tuje spremembe niso vidne.
//
// Rešitev: čista knjižnica z ODLOČITVENO logiko (kdaj se vračajoč uporabnik
// osveži) + tanka React ovojnica (src/hooks/use-refetch-on-focus.ts). Vzorec
// termini-prikaz / status-options: čisto izračunsko jedro je client-safe in
// 100 % testabilno; komponenta je samo žičenje.
//
// Načela:
//  • Determinizem: odločitev je čista funkcija nad izrecnimi vhodi (now,
//    zadnjaOsvezitev) — brez skrite Date.now() odvisnosti v jedru.
//  • Fail-closed: skrit dokument NIKOLI ne sproži fetcha; neveljaven vhod →
//    TypeError (nikoli tihega ugibanja).
//  • Rate-limit z ENIM pravilom: oba dogodka (visibilitychange + focus) greta
//    skozi ISTO funkcijo — drugi dogodek v istem oknu je brezoploden, brez
//    ročnega dedupa v komponenti.
//  • PEČAT 'Osveženo ob HH:MM:SS' — EN VIR RESNICE za besedilo (casOznaka +
//    osvezitevLabel); pečat se pokaže TOČNO TAKRAT, ko so na zaslonu podatki
//    uspešnega branja (napaka/nalaganje → brez pečata — nikoli lažnega
//    "svežine" nad napako ali praznim stanjem).

/** Najkrajši razmik med DVEMA osvežitvama ob fokusu (ms). Konstanta je
 *  javna, da je testabilna in da UI tooltip lahko pove pravilo. 30 s:
 *  hitro preklapljanje zavihkov ne tolče APIja, vrnitev po daljši odsotnosti
 *  pa vedno osveži. */
export const FOKUS_MIN_INTERVAL_MS = 30_000

export interface FokusVnos {
  /** Trenutek dogodka (Date.now() v klicatelju; izrecen parameter = testabilno). */
  now: number
  /** Čas zadnjega sproženega osveževanja ob fokusu (ms) ali null (še ni bilo). */
  zadnjaOsvezitev: number | null
  /** Najkrajši razmik med osvežitvami (ms); privzeto FOKUS_MIN_INTERVAL_MS. */
  minIntervalMs?: number
  /** Ali je dokument VIDEN (document.visibilityState === 'visible'). */
  dokumentViden: boolean
}

/** Odločitev, ali vrnitev v ospredje sproži osvežitev. Pravila:
 *  • neveljaven vhod → TypeError (fail-closed, brez tihega ugibanja);
 *  • skrit dokument → false NIKOLI ne fetcha v ozadju (baterija/omrežje);
 *  • prvi dogodek (zadnjaOsvezitev null) → true — prva vrnitev vedno osveži,
 *    ker podatki od montiranja lahko že zastarajo;
 *  • sicer → true samo, če je od zadnje osvežitve minilo vsaj minIntervalMs
 *    (>= — na točno meji osveži, deterministično). */
export function biOsvjezitiObFokusu(vnos: FokusVnos): boolean {
  if (!vnos || typeof vnos !== 'object') {
    throw new TypeError('biOsvjezitiObFokusu: pričakovan vnos (FokusVnos)')
  }
  const { now, zadnjaOsvezitev, dokumentViden } = vnos
  const minIntervalMs = vnos.minIntervalMs ?? FOKUS_MIN_INTERVAL_MS
  if (!Number.isFinite(now) || now < 0) {
    throw new TypeError(
      `biOsvjezitiObFokusu: pričakovan ne-negativen končen now (ms), ne ${String(now)}`
    )
  }
  if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) {
    throw new TypeError(
      `biOsvjezitiObFokusu: pričakovan ne-negativen minIntervalMs, ne ${String(minIntervalMs)}`
    )
  }
  if (typeof dokumentViden !== 'boolean') {
    throw new TypeError('biOsvjezitiObFokusu: pričakovan dokumentViden: boolean')
  }
  if (zadnjaOsvezitev !== null && (!Number.isFinite(zadnjaOsvezitev) || zadnjaOsvezitev < 0)) {
    throw new TypeError(
      `biOsvjezitiObFokusu: pričakovan ne-negativen končen zadnjaOsvezitev (ms) ali null, ne ${String(zadnjaOsvezitev)}`
    )
  }
  if (!dokumentViden) return false
  if (zadnjaOsvezitev === null) return true
  return now - zadnjaOsvezitev >= minIntervalMs
}

/** '14:05:09' — ISTI Intl klic kot terminCasLabel (sl-SI, 24-urno), z
 *  sekundami: pečat mora razločiti dve osvežitvi v isti minuti. Ura je
 *  določena z vnosom, ne z now — brez skritih ur.
 *
 *  R180 — opcijski `casovniPas` za STREŽNIŠKI izris (portal /[token]):
 *  brez pasu Intl uporablja časovni pas GOSTITELJA — na strežniku (Vercel
 *  funkcije v UTC) bi pečat lažno pokazal UTC uro namesto slovenske. Z
 *  eksplicitnim pasom ('Europe/Ljubljana') je pečat determinističen ne glede
 *  na regijo izrisa. Client-side klici (vseh 9 notranjih površin) ne podajo
 *  pasu — enako vedenje kot prej (uporabnikova ura). Neveljaven pas → Intl
 *  vrže RangeError (fail-closed: nikoli tihega napačnega izrisa). */
export function casOznaka(
  d: Date,
  moznosti?: { casovniPas?: string },
): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new TypeError(`casOznaka: pričakovan veljaven datum: Date, ne ${String(d)}`)
  }
  if (moznosti !== undefined) {
    if (!moznosti || typeof moznosti !== 'object') {
      throw new TypeError('casOznaka: pričakovane moznosti (objekt) ali undefined')
    }
    const { casovniPas } = moznosti
    if (casovniPas !== undefined && (typeof casovniPas !== 'string' || casovniPas === '')) {
      throw new TypeError(
        `casOznaka: pričakovan casovniPas: ne-prazen string ali undefined, ne ${String(casovniPas)}`
      )
    }
  }
  return d.toLocaleTimeString('sl-SI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...(moznosti?.casovniPas ? { timeZone: moznosti.casovniPas } : {}),
  })
}

/** 'Osveženo ob 14:05:09' — EN VIR RESNICE za pečat v obeh površinah
 *  (Termini kartica + Logistika → Koledar). Vidno besedilo komponent je
 *  točno ta niz (čas span z tabular-nums); test uveljavlja enakost. */
export function osvezitevLabel(d: Date): string {
  return `Osveženo ob ${casOznaka(d)}`
}
