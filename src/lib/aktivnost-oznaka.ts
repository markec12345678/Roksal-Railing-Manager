// R200 — 'Zadnja aktivnost' oznaka z uro — EN VIR RESNICE za vidno besedilo.
//
// Zgodovina: Ekipa (R160/R178) je prikazovala 'Zadnja aktivnost' SAMO kot
// datum (toLocaleDateString('sl-SI')) — admin ni videl, ali je bil uporabnik
// aktiven DANES ob 08:03 ali lani ob poldnevi. R199 P1 kandidat (e).
//
// Pravila:
//  • null/undefined/neveljaven vnos → null (klicatelj prikaže 'nikoli') —
//    brez izmišljenih podatkov (fail-closed vzorec R152).
//  • istega koledarskega dne (lokalno) → 'danes ob HH:MM:SS'
//  • prejšnji dan → 'včeraj ob HH:MM:SS'
//  • prej → 'DD. MM. YYYY ob HH:MM:SS' (oblika datuma NEHA
//    toLocaleDateString('sl-SI') — ista družina kot prejšnja prikazna oblika)
//  • prihodnost (ne bi smela obstajati; ne-fabriciramo razlage) → absolutna
//    oblika (datum + ura), ni posebne relativne oznake.
//  • URa je vedno casOznaka (EN VIR s pečati 'Osveženo ob', R170).
//  • `zdaj` je vbrizgalen (privzeto new Date()) → deterministični testi čez
//    polnoč ne faillirajo (lekcija: relativni časi + 'now' v testih = flaky).
//
// Čista funkcija, client-safe (uvozi samo casOznaka iz osvezitev-fokus, ki
// ga uporabljajo klienti od R170); brez server-only odvisnosti.
import { casOznaka } from '@/lib/osvezitev-fokus'

const EN_DAN_MS = 24 * 60 * 60 * 1000

export function aktivnostOznaka(
  d: Date | string | null | undefined,
  zdaj: Date = new Date()
): string | null {
  if (!d) return null
  const t = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(t.getTime())) return null

  // Koledarski dnevi (lokalno polnoč) — ne 24-h okno: 00:30 zjutraj je
  // 'včeraj ob 23:59' pravilno 'včeraj', čeprav je razlika le 31 min.
  const polnoc = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const razlikaDni = Math.round((polnoc(zdaj) - polnoc(t)) / EN_DAN_MS)

  const cas = casOznaka(t)
  if (razlikaDni === 0) return `danes ob ${cas}`
  if (razlikaDni === 1) return `včeraj ob ${cas}`
  return `${t.toLocaleDateString('sl-SI')} ob ${cas}`
}
