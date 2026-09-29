/**
 * R290 — P1-d IKONSKI ARIA-HIDDEN MEGA-DIFF (odprt R242, 629 mest) — DETEKTOR (EN VIR RESNICE)
 *
 * Namen: najti VSE lucide-react ikonske JSX instance, kjer NAMERNA dekorativnost
 * NI izrecno zapisana (manjka `aria-hidden`). Bralniki zaslona sicer lahko
 * napovejo prazen grafični element ali pa dvomljivo 'grafika' sporočilo.
 *
 * Načela (repo kanon):
 * - EN VIR: ta modul je edina resnica za detekcijo — codemod (scripts/r290-*)
 *   IN strazar test (src/lib/__tests__/r290-*) oba CLIČETA TUKAJ. NIČ duplikacije.
 * - FAIL-CLOSED: ne-nizovni vir = TypeError (nikoli tiho prazen seznam).
 * - DETERMINIZEM: enak vhod → enak izpis (vrstni red po poziciji v viru).
 * - IZJEME-AUDIT: instance z role="img" (vsebinska grafika — R150 libela,
 *   R231 kompas vzorec) in instance s spreadom {...p} (vrstni red atributov
 *   ni statično dokazljiv) NE so kandidati za codemod — detektor jih izrecno
 *   označi (roleImg / imaSpread), klicalec odloča.
 * - KANON R242/R157: 'aria-hidden' NI odstranjevan (izjeme-audit), samo
 *   DODAJANJE manjkajočih. Sken je brace/quote-aware (r157 vzorec).
 */

/** Ena ikonska JSX instance v viru. */
export interface AriaIkonZadetek {
  /** Lokalno ime ikone (kot v JSX, npr. 'Calendar'). */
  ime: string
  /** 1-based vrstica, kjer se začne `<Ime`. */
  vrstica: number
  /** Ali opening tag že vsebuje aria-hidden (statika ali {izraz}). */
  imaAriaHidden: boolean
  /** Ali opening tag vsebuje role="img" (vsebinska grafika — izjema). */
  roleImg: boolean
  /** Ali opening tag vsebuje {...spread} (statika nedokazljiva — izjema). */
  imaSpread: boolean
  /** Ali je opening tag self-closing (`/>`). */
  selfClosing: boolean
}

/** Poln opis instance — uporablja codemod za varno vstavljanje. */
export interface AriaIkonPozicija extends AriaIkonZadetek {
  /** Indeks znaka `<` instance. */
  start: number
  /** Indeks `>` ki zaključi opening tag (vključen). */
  konecTag: number
}

/** Preveri, ali je znak del JSX identifikatorja. */
function jeIdentZnak(c: string): boolean {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '_' || c === '$'
}

/**
 * Izvleči lokalna imena vseh lucide-react ikon iz import blokov.
 * Podpira: enovrstične in večvrstične importe, `X as Y` (lokalno = Y).
 * Vrne SEZNAM v vrstnem red pojavljanja (determinizem); duplikati ostanejo
 * (Set uporabnik sam po potrebi).
 */
export function lucideImenaIzVira(src: string): string[] {
  if (typeof src !== 'string') {
    throw new TypeError('lucideImenaIzVira: vir mora biti niz (fail-closed)')
  }
  const imena: string[] = []
  // import { A, B as C } from 'lucide-react'  — tudi čez več vrstic.
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    for (const del of m[1].split(',')) {
      const ime = del.trim()
      if (!ime) continue
      // 'X as Y' — lokalno vidno ime je Y.
      const as = /^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(ime)
      const lokalno = as ? as[2] : ime.split(/\s+/)[0]
      // komentarji znotraj import bloka (// ... /* ... */) ne smejo postati
      // imena — lucide ikone so vedno ASCII identifikatorji; ostalo ('//',
      // 'koti', '(x)' …) se zavrže (nič lažnih kandidatov, nič pokvarjenih
      // RegExpov pri izvedbi alternacije).
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(lokalno)) continue
      imena.push(lokalno)
    }
  }
  return imena
}

/**
 * Brace/quote-aware iskanje konca opening tag-a (r157 vzorec).
 * `start` = indeks PRVEGA znaka ZA `<Ime`. Vrne indeks `>` (ali -1).
 * `{ }` globina in navedki ('…"…"…') zvesto prečkana — `>` znotraj
 * izraza/navedka NE zaključi tag-a.
 * IZVEZENO: skupni pomožnik za a11y-gumbi-scan (EN VIR sken obeh detektorjev).
 */
export function najdiTagKonec(src: string, start: number): number {
  const n = src.length
  let i = start
  let globina = 0
  while (i < n) {
    const c = src[i]
    if (c === '{') {
      globina += 1
    } else if (c === '}') {
      globina -= 1
    } else if ((c === '"' || c === "'" || c === '`') && globina === 0) {
      const q = c
      i += 1
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') i += 1
        i += 1
      }
    } else if (c === '>' && globina === 0) {
      return i
    }
    i += 1
  }
  return -1
}

/**
 * Skeniraj vir za lucide ikonske instance in njihovo aria-hidden stanje.
 * Komentarji (// in /* *\/) so preskočeni (ne-prodni tekst, nikoli kandidat).
 * Rezultat je determinističen (vrstni red pozicij v viru).
 */
export function skenirajIkonAriaHidden(src: string): AriaIkonPozicija[] {
  if (typeof src !== 'string') {
    throw new TypeError('skenirajIkonAriaHidden: vir mora biti niz (fail-closed)')
  }
  const imena = new Set(lucideImenaIzVira(src))
  if (imena.size === 0) return []

  const zadetki: AriaIkonPozicija[] = []
  const n = src.length
  let i = 0
  let vrstica = 1

  while (i < n) {
    const c = src[i]

    if (c === '\n') {
      vrstica += 1
      i += 1
      continue
    }

    // Vrstni komentar — do konca vrstice (brez je).
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i += 1
      continue
    }
    // Bločni komentar — /* ... */ (št. vrstic zvesto).
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') vrstica += 1
        i += 1
      }
      i += 2
      continue
    }

    // Kandidat: `<Ime` kjer je Ime znano lucide ime.
    // IZJEMA (TSX kanon): `<` TIK ZA identifikatorjem je TS generika, ne JSX —
    // `useState<Layers>` / `Array<Layers>`. JSX `<Ime` ima pred seboj VEDNO
    // ločilo ali presledek: `( `, `{ `, `> `, `, `, `=> `, `&& `, `return ` —
    // `<` brez presledka za identom je v .tsx razčlenjen kot generika, zato
    // je izpust VARNEN (nikoli zgreši pravi JSX, nikoli ne lovi tipov).
    if (c === '<' && jeIdentZnak(src[i + 1] ?? '') && !jeIdentZnak(src[i - 1] ?? '')) {
      let j = i + 1
      while (j < n && jeIdentZnak(src[j])) j += 1
      const ime = src.slice(i + 1, j)
      if (imena.has(ime)) {
        const konecTag = najdiTagKonec(src, j)
        if (konecTag !== -1) {
          const tag = src.slice(j, konecTag + 1)
          // Vrstica instance = vrstica `<`; vrstica po tagu = konecTag + 1.
          let noveVrstice = 0
          for (let k = i; k <= konecTag; k++) {
            if (src[k] === '\n') noveVrstice += 1
          }
          zadetki.push({
            ime,
            vrstica,
            imaAriaHidden: /\baria-hidden\b/.test(tag),
            roleImg: /role\s*=\s*(["'])img\1/.test(tag) || /role\s*=\s*\{/.test(tag),
            imaSpread: /\{\s*\.\.\./.test(tag),
            selfClosing: /\/\s*>\s*$/.test(tag),
            start: i,
            konecTag,
          })
          vrstica += noveVrstice
          i = konecTag + 1
          continue
        }
      }
    }

    i += 1
  }

  return zadetki
}

/**
 * Kandidati za codemod: ikonske instance BREZ izrecne aria-hidden,
 * ki niso vsebinske (role="img"/dynamic role) in nimajo spreada.
 * To je EDIRNA definicija 'manjkajočega aria-hidden' — codemod IN strazar
 * test uporabljata ISTO funkcijo (EN VIR RESNICE).
 */
export function kandidatiZaAriaHidden(src: string): AriaIkonPozicija[] {
  return skenirajIkonAriaHidden(src).filter(
    (z) => !z.imaAriaHidden && !z.roleImg && !z.imaSpread,
  )
}

/**
 * Vstavi `aria-hidden` v opening tag PRED `>` oz. `/>` (r290 codemod kanon).
 * Ohrani obstoječo obliko:
 *   `<I />`  → `<I aria-hidden />`      `<I/>`  → `<I aria-hidden />`
 *   `<I >`   → `<I aria-hidden >`       `<I>`   → `<I aria-hidden>`
 * Fail-closed: selfClosing brez `/` tik pred `>` = TypeError (nikoli tiho
 * vstavljanje na napačnem mestu). Deterministično — enak vhod, enak izpis.
 */
export function vstaviAriaHidden(vir: string, konecTag: number, selfClosing: boolean): string {
  if (typeof vir !== 'string') {
    throw new TypeError('vstaviAriaHidden: vir mora biti niz (fail-closed)')
  }
  if (!Number.isInteger(konecTag) || konecTag < 0 || konecTag >= vir.length || vir[konecTag] !== '>') {
    throw new TypeError('vstaviAriaHidden: konecTag ni veljaven indeks `>` (fail-closed)')
  }
  if (selfClosing) {
    const p = konecTag - 1
    if (vir[p] !== '/') {
      throw new TypeError('vstaviAriaHidden: selfClosing brez `/` tik pred `>` (fail-closed)')
    }
    const predslov = vir[p - 1] === ' ' || vir[p - 1] === '\n' || vir[p - 1] === '\t' || vir[p - 1] === '\r'
    return vir.slice(0, p) + (predslov ? 'aria-hidden ' : ' aria-hidden ') + vir.slice(p)
  }
  let p = konecTag - 1
  while (p >= 0 && (vir[p] === ' ' || vir[p] === '\n' || vir[p] === '\t' || vir[p] === '\r')) p -= 1
  return vir.slice(0, p + 1) + ' aria-hidden' + vir.slice(p + 1)
}
