// ---------------------------------------------------------------------------
// R311 — 41. člen issue #1 (Deliverable 5 NA ZASLONU): AI raba — iskrena
// resnica po površinah. ČISTA projekcija DVEH obstoječih EN VIR resnic:
//   automation/katalog.ts (AUTOMATIZACIJSKI_KATALOG — vnosi vrste 'ai' z
//   IZREČENIM determinističnim nadomestkom, kontrakt §11) in
//   avtomatizacija-audit.ts (AI_KANDIDATI — ne-implementirani kandidati,
//   vsak z iskreno utemeljitvijo 'zakaj').
// NIČ nove resnice — samo povezava (razrešitev nadomestka po id) + sklep.
// WYSIWYG: opisi/statusi/sklep so verbatim iz EN VIR — zaslon, testi in
// prihodnji izvozi berejo ISTI niz.
//
// Načela:
//  • 100 % determinizem: čista funkcija, nič ure, nič naključja — isti
//    katalog = bajtno enak pregled.
//  • Fail-closed: katalog brez seznama, AI vnos brez nadomestka, nadomestek
//    brez razrešitve, kandidat brez 'zakaj' → TypeError z imenom graditelja
//    (kanon R299/R302/R306 — niz preživi minifikacijo, identifikatorji ne).
//  • AI nikoli vir resnice: pregled DOKAZUJE odsotnost AI-obveznih površin
//    po konstrukciji (vsak 'ai' vnos MORA imeti nadomestek v ISTEM katalogu).
// ---------------------------------------------------------------------------

import { AUTOMATIZACIJSKI_KATALOG } from '@/lib/automation/katalog'
import type { AutomatizacijskaZmoznost } from '@/lib/automation/katalog'
import { AI_KANDIDATI } from '@/lib/avtomatizacija-audit'
import type { AiKandidat } from '@/lib/avtomatizacija-audit'

/** AI površina v živo z RAZREŠENIM nadomestkom (iz ISTEGA kataloga). */
export interface AiZivaPovrsina {
  readonly id: string
  /** Verbatim opis iz kataloga (iskrena resnica funkcije). */
  readonly opis: string
  /** Pot modula v repozitoriju (katalog vsiljuje obstoj — strazar R294). */
  readonly modul: string
  readonly nadomestekId: string
  /** Verbatim opis nadomestne DETERMINISTIČNE zmožnosti. */
  readonly nadomestekOpis: string
  readonly nadomestekModul: string
}

/** Pregled AI rabe (41. člen — zaslon + testi + prihodnji izvozi). */
export interface AiRabaPregled {
  /** AI površine v živo (katalog vrsta 'ai') z razrešenim nadomestkom. */
  readonly zive: readonly AiZivaPovrsina[]
  /** Ne-implementirani kandidati (verbatim iz avtomatizacija-audit). */
  readonly kandidati: readonly AiKandidat[]
  /** Skupni status kandidatov — SAMO kadar so vsi enaki (sicer null). */
  readonly kandidatiStatus: string | null
  readonly stAi: number
  readonly stKandidatov: number
  readonly stNadomestkov: number
  /** EN VIR sklep WYSIWYG (številčno nevtralen — gramatika ne korodira). */
  readonly sklep: string
}

/**
 * Zgrodi pregled AI rabe iz kataloga + kandidatov. Privzeti vhod = EN VIR
 * katalog (parametriziran SAMO za teste fail-closed poti — produkcija
 * vedno kliče brez argumenta).
 */
export function aiRabaPregled(
  katalog: readonly AutomatizacijskaZmoznost[] = AUTOMATIZACIJSKI_KATALOG,
  kandidati: readonly AiKandidat[] = AI_KANDIDATI,
): AiRabaPregled {
  if (!Array.isArray(katalog)) {
    throw new TypeError('aiRabaPregled: pričakovan katalog (seznam zmožnosti)')
  }
  if (!Array.isArray(kandidati)) {
    throw new TypeError('aiRabaPregled: pričakovani kandidati (seznam)')
  }
  const poId = new Map(katalog.map((z) => [z.id, z] as const))
  const zive: AiZivaPovrsina[] = []
  for (const z of katalog) {
    if (z.vrsta !== 'ai') continue
    if (typeof z.nadomestek !== 'string' || z.nadomestek.length === 0) {
      throw new TypeError(
        `aiRabaPregled: AI zmožnost ${z.id} brez izrecnega nadomestka (kontrakt §11 — AI nikoli brez deterministične poti)`,
      )
    }
    const nad = poId.get(z.nadomestek)
    if (!nad) {
      throw new TypeError(
        `aiRabaPregled: nadomestek ${z.nadomestek} (za ${z.id}) ne obstaja v katalogu — fail-closed`,
      )
    }
    zive.push({
      id: z.id,
      opis: z.opis,
      modul: z.modul,
      nadomestekId: nad.id,
      nadomestekOpis: nad.opis,
      nadomestekModul: nad.modul,
    })
  }
  for (const k of kandidati) {
    if (typeof k.zakaj !== 'string' || k.zakaj.trim().length === 0) {
      throw new TypeError(
        `aiRabaPregled: kandidat ${k.funkcija} brez 'zakaj' (iskrena utemeljitev je obvezna — nikoli lažna implementacija)`,
      )
    }
  }
  const prviStatus = kandidati.length > 0 ? kandidati[0]!.status : null
  const vsiEnaki =
    prviStatus !== null && kandidati.every((k) => k.status === prviStatus)
  const stAi = zive.length
  const stKandidatov = kandidati.length
  const sklep =
    `AI površine: ${stAi} (vse neobvezne z izrecnim determinističnim nadomestkom) · ` +
    `kandidati: ${stKandidatov} (ne-implementirani, nič povezano) · ` +
    `AI-obveznih: 0 — jedro deluje brez AI`
  return {
    zive,
    kandidati,
    kandidatiStatus: vsiEnaki ? prviStatus : null,
    stAi,
    stKandidatov,
    stNadomestkov: zive.length,
    sklep,
  }
}
