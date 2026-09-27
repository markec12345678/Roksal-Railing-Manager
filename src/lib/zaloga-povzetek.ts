// ---------------------------------------------------------------------------
// R204 — naročilnica zaloge za odložišče (naročanje pri dobavitelju prek
// e-pošte/SMS/WhatsApp) — vzorec meritve-povzetek (R203) /
// buildTerminShareText (R167): čisto client-safe jedro, fail-closed,
// deterministično (referenčni trenutek pride KOT parameter).
// ---------------------------------------------------------------------------
// Motiv: gumb 'Naroči' na artiklih pod minimumom je do zdaj POKAZAL IZMIŠLJEN
// uspeh — toast 'Naročilo bo poslano dobavitelju.' čeprav NIČ ni bilo poslano
// (integracije z dobaviteljem ni). To je laž v UI (kršitev 'ni izmišljenih
// podatkov'). R204: pravi uporabni izhod namesto izmišljenega — naročilnica
// kot besedilo v odložišču, ki jo monter/pisarna SAM prilepi v e-pošto/SMS/
// WhatsApp. Aplikacija trdi LE to, kar je res: 'kopirana v odložišče', ne
// 'poslano'.
//
// Načela:
//  • Brez izmišljenih podatkov: v naročilnici so SAMO resnična polja (šifra,
//    naziv, enota, zaloga, min. zaloga). CEN NI — cenaEur je pogosto null,
//    UI-jeva ocena vrednosti po tipu je izrecno 'demo' približek; ocenjene
//    cene NE smejo priti v dokument za dobavitelja.
//  • EN VIR RESNICE za priporočeno količino: ISTA formula, ki jo je do zdaj
//    pokazal UI (handleReorder): Math.max(min − zaloga, min). Ni nove logike
//    — naročilnica pove TOČNO to, kar je do zdaj povedal toast, le da je zdaj
//    raznosljiva (prilepimo jo lahko res dobavitelju).
//  • Fail-closed: količine so FIZIČNE vrednosti — pokvaren vnos → TypeError
//    (NIKOLI tihega izmišljenega besedila; polpdatki ne gredo v dokument za
//    dobavitelja). Artikel NAD minimumom → TypeError (dokument trdi 'pod
//    minimumom' — jedro tega NIKOLI ne laže; komponenta posreduje le isLow
//    artikle, jedro je samozaščitno).
//  • Determinizem: `now` pride KOT parameter — jedro ne bere ure; časovni
//    žig = sl-SI Intl z izrecnimi opcijami (isti vzorec R167/R203 — človeška
//    oblika, ne arhiv).

/** Najmanjši potrebni prerez artikla inventarja za naročilnico (podmnožica
 *  InventoryItem iz inventory-tab — client-safe, brez uvozov). */
export interface ZalogaArtikelZaNarocilo {
  id: string
  sifraMateriala: string
  naziv: string
  kolicinaZaloga: number
  enota: string
  minimalnaZaloga: number
}

export interface ZalogaPovzetekOptions {
  /** Referenčni trenutek za žig 'osveženo …' — KOT PARAMETER
   *  (determinizem, vzorec termini-prikaz/meritve-csv/meritve-povzetek). */
  now: Date
  /** Opcijska oznaka aktivnega filtra (npr. 'WPC') — LE če filter dejansko
   *  aktiven; 'Vse'/null → brez omembe (brez izmišljenega konteksta). */
  kategorija?: string | null
}

/** Skupna fail-closed preverba (količine so fizične vrednosti; naročilnica
 *  pokriva LE artikle pod minimumom — sicer bi dokument lažal). */
function preveriArtikel(a: ZalogaArtikelZaNarocilo): void {
  if (!a || typeof a !== 'object') {
    throw new TypeError('preveriArtikel: pričakovan artikel (ZalogaArtikelZaNarocilo)')
  }
  if (typeof a.id !== 'string' || a.id.trim() === '') {
    throw new TypeError('preveriArtikel: artikel mora imeti ne-prazen id')
  }
  if (typeof a.naziv !== 'string' || a.naziv.trim() === '') {
    throw new TypeError(`preveriArtikel (${a.id}): artikel mora imeti ne-prazen naziv`)
  }
  if (typeof a.sifraMateriala !== 'string' || a.sifraMateriala.trim() === '') {
    throw new TypeError(`preveriArtikel (${a.id}): artikel mora imeti ne-prazno šifro materiala`)
  }
  if (typeof a.enota !== 'string' || a.enota.trim() === '') {
    throw new TypeError(`preveriArtikel (${a.id}): artikel mora imeti ne-prazno enoto`)
  }
  for (const k of ['kolicinaZaloga', 'minimalnaZaloga'] as const) {
    const v = a[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(
        `preveriArtikel (${a.id}): ${k} mora biti ne-negativno končno število, ne ${String(v)}`,
      )
    }
  }
  if (a.kolicinaZaloga > a.minimalnaZaloga) {
    throw new TypeError(
      `preveriArtikel (${a.id}): artikel je NAD minimalno zalogo (${a.kolicinaZaloga} > ${a.minimalnaZaloga}) — naročilnica pokriva le artikle pod minimumom`,
    )
  }
}

/** Priporočena naročila količina — EN VIR RESNICE z obstoječim UI (prej
 *  handleReorder): deficit do minimuma, a vsaj celoten minimum. */
export function narociloKolicina(a: ZalogaArtikelZaNarocilo): number {
  preveriArtikel(a)
  return Math.max(a.minimalnaZaloga - a.kolicinaZaloga, a.minimalnaZaloga)
}

/** Slovenska sklanjatev besede 'artikel' za števec (1 artikel, 2 artikla,
 *  3/4 artikli, 5+ artiklov) — vzorec meritvePovzetekBeseda (R203). */
export function zalogaPovzetekBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(
      `zalogaPovzetekBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`,
    )
  }
  if (n === 1) return 'artikel'
  if (n === 2) return 'artikla'
  if (n === 3 || n === 4) return 'artikli'
  return 'artiklov'
}

/** Časovni žig '27. 09. 2026 ob 14:05' — sl-SI Intl z izrecnimi opcijami
 *  (isti vzorec kot meritvePovzetekCasOznaka R203). Pokvaren now → TypeError. */
export function zalogaPovzetekCasOznaka(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('zalogaPovzetekCasOznaka: pričakovan veljaven now: Date')
  }
  const datum = now.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const ura = now.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  return `${datum} ob ${ura}`
}

/** Besedilna naročilnica VIDNIH artiklov pod minimumom (za dobavitelja).
 *
 *  Struktura:
 *    Naročilnica — Zaloga pod minimumom
 *    {n} {artikel/artikla/artikli/artiklov} · osveženo {datum} ob {ura}[ · filter: {kategorija}]
 *
 *    1. {naziv} ({šifra}): naroči {k} {enota} (zaloga {z} / min. {m})
 *    …
 *
 *  Fail-closed: pokvaren vnos ALI artikel nad minimumom → TypeError.
 *  Prazen seznam je VELJAVEN (iskreno 'Ni artiklov za naročilo.'). */
export function buildZalogaPovzetek(
  artikli: readonly ZalogaArtikelZaNarocilo[],
  options: ZalogaPovzetekOptions,
): string {
  if (!Array.isArray(artikli)) {
    throw new TypeError(
      'buildZalogaPovzetek: pričakovano polje artiklov (ZalogaArtikelZaNarocilo[])',
    )
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildZalogaPovzetek: pričakovane opcije (ZalogaPovzetekOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildZalogaPovzetek: pričakovan veljaven now: Date')
  }
  artikli.forEach((a) => preveriArtikel(a))

  const vrstice: string[] = []
  vrstice.push('Naročilnica — Zaloga pod minimumom')
  const kategorija =
    typeof options.kategorija === 'string' && options.kategorija.trim() !== ''
      ? options.kategorija.trim()
      : null
  vrstice.push(
    `${artikli.length} ${zalogaPovzetekBeseda(artikli.length)} · osveženo ${zalogaPovzetekCasOznaka(now)}${kategorija ? ` · filter: ${kategorija}` : ''}`,
  )
  vrstice.push('')

  if (artikli.length === 0) {
    vrstice.push('Ni artiklov za naročilo.')
    return vrstice.join('\n')
  }

  artikli.forEach((a, i) => {
    vrstice.push(
      `${i + 1}. ${a.naziv.trim()} (${a.sifraMateriala.trim()}): naroči ${narociloKolicina(a)} ${a.enota.trim()} (zaloga ${a.kolicinaZaloga} / min. ${a.minimalnaZaloga})`,
    )
  })

  return vrstice.join('\n')
}
