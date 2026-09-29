// R290 — P1-d: OZKI PODNABOR — Lucide ikone brez aria-hidden ZNOTRAJ
// imenovanih interaktivnih elementov. Jedro P1-d detekcije živi v
// a11y-ikon-scan.ts (EN VIR: lucideImenaIzVira + najdiTagKonec +
// kandidatiZaAriaHidden + vstaviAriaHidden — polni pregled, codemod CLI
// scripts/r290-codemod-aria-hidden.ts, strazar test r290-aria-hidden-scan).
// Ta modul dopolnjuje s KOZIM PODBOROM (semantično VEDNO napačne ikone):
// ikona v <Button>/<button>/<a>/<Link>, ki že nosi dostopno ime (aria-label /
// aria-labelledby ALI vidno besedilo otrok) — tam je aria-hidden obvezen,
// ker je ikona bralcu odveč (ime je na elementu).
//
// Načela (repo kanon): fail-closed TypeError na ne-nizu; determinizem
// (vrstni red po poziciji v viru); brez tihih izjem.

import { najdiTagKonec } from './a11y-ikon-scan'
import { imaVidenTekst } from './a11y-gumbi-scan'

const CONTAINER_KINDS: readonly string[] = ['Button', 'button', 'a', 'Link']

export interface AriaHiddenOffender {
  file: string
  line: number
  icon: string
}

/** Ozki podnabor: Lucide ikone brez aria-hidden znotraj imenovanih
 * interaktivnih elementov (<Button>/<button>/<a>/<Link> z aria-label /
 * aria-labelledby ALI vidnim besedilom otroka). */
export function lucideIconsNeedingAriaHidden(
  src: string,
  names: readonly string[],
  file = 'inline.tsx',
): AriaHiddenOffender[] {
  if (typeof src !== 'string') {
    throw new TypeError('lucideIconsNeedingAriaHidden: vir mora biti niz (fail-closed)')
  }
  const offenders: AriaHiddenOffender[] = []
  if (names.length === 0) return offenders
  const iconRe = new RegExp(`<(${names.join('|')})(?![A-Za-z0-9_$])`, 'g')
  for (const kind of CONTAINER_KINDS) {
    const openRe = new RegExp(`<${kind}(?![A-Za-z0-9_])`, 'g')
    const closeRe = new RegExp(`</${kind}\\s*>`, 'g')
    let idx = 0
    for (;;) {
      openRe.lastIndex = idx
      const m = openRe.exec(src)
      if (!m) break
      const start = m.index
      idx = start + 1
      if (start > 0 && src[start - 1] === '/') continue
      const tagEnd = najdiTagKonec(src, start + kind.length)
      if (tagEnd === -1) continue
      const tag = src.slice(start, tagEnd + 1)
      if (/\/\s*$/.test(tag)) continue // samozapirajoč — brez otrok
      const openReLocal = new RegExp(`<${kind}(?![A-Za-z0-9_])`, 'g')
      let depth = 1
      let closeStart = -1
      let pos = tagEnd + 1
      while (depth > 0) {
        openReLocal.lastIndex = pos
        const no = openReLocal.exec(src)
        closeRe.lastIndex = pos
        const nc = closeRe.exec(src)
        if (!nc) break
        if (no && no.index < nc.index) {
          depth += 1
          pos = no.index + 1
        } else {
          depth -= 1
          if (depth === 0) closeStart = nc.index
          pos = nc.index + 1
        }
      }
      if (closeStart === -1) continue
      const named = tag.includes('aria-label')
      const child = src.slice(tagEnd + 1, closeStart)
      if (!named && !imaVidenTekst(child)) continue
      iconRe.lastIndex = 0
      for (const im of child.matchAll(iconRe)) {
        const itagEnd = najdiTagKonec(child, im.index + 1 + im[1].length)
        if (itagEnd === -1) continue
        const itag = child.slice(im.index, itagEnd + 1)
        if (itag.includes('aria-hidden')) continue
        offenders.push({
          file,
          line: src.slice(0, tagEnd + 1 + im.index).split('\n').length,
          icon: im[1],
        })
      }
      idx = closeStart
    }
  }
  return offenders.sort((a, b) => a.line - b.line)
}
