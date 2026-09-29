/**
 * R290 — A11Y DVOJNI ZAKLEP, 2. KLJUČAVNICA: ICON-ONLY <Button> BREZ DOSTOPNEGA IMENA.
 *
 * Zgodovina: R157 je najdenih 20 ikonskih gumbov brez aria-labela popravilo
 * (skripta scripts/r157-a11y-audit.py) — takrat ostalo kot ROČNO orodje.
 * Ta modul je ISTA odločitev preseljena v TS lib (EN VIR RESNICE):
 *  - strazar test (r290-a11y-strazar.test.ts) ZAKLENE celotno drevo na nič,
 *  - R157 python skripta ostane arhivski vzorec (nič več potreben tek).
 *
 * Izboljšava proti r157 python verziji: self-closing `<Button … />` dobi
 * EKSPlicitNO prazen child (python je vzel tekst do NASLEDNJEGA </Button> —
 * lažno območje). Repo danes ima self-closing gumbe (npr. ui/calendar.tsx),
 * zato je popravek obvezen za zvesto skeniranje.
 *
 * Načela (repo kanon):
 * - FAIL-CLOSED: ne-nizovni vir = TypeError.
 * - DETERMINIZEM: enak vhod → enak izpis (vrstni red pozicij v viru).
 * - IZJEME-AUDIT: brez tihih izjem — edina dovoljena izjema je EXPLICITNI
 *   seznam v strazar testu (npr. react-day-picker DayButton, kjer aria-label
 *   vstavi KNJIŽNICA ob teku — statika je lažno negativna; R157 kanon).
 * - "Ikonski" = opening tag BREZ aria-label/aria-labelledby IN child BREZ
 *   vidnega besedila (r157 odločitev: title NI nadomestilo za ime gumba).
 */

import { najdiTagKonec } from './a11y-ikon-scan'

/** En ikonski gumb brez dostopnega imena. */
export interface GumbBrezImena {
  /** 1-based vrstica `<Button` / `<button`. */
  vrstica: number
  /** Kateri tag: 'Button' (shadcn) ali 'button' (gol HTML). */
  tag: 'Button' | 'button'
  /** Povzetek child vsebine (≤140 znakov, presledki poenoteni). */
  childPovzetek: string
}

/** Slovenske črke + osnovna latinica = vidni tekst kanon (r157 vrstica 104). */
const VidenTekstRe = /[A-Za-zŽŠČĆĐžščćđ]/

/**
 * Ali child vsebina vsebuje VIDNO besedilo (r157 vzorec, ena prehoja):
 *  - surov tekst izven tagov in zavitih oklepajev (`Naprej <I/>`),
 *  - tekst znotraj JSX fragmenta v izrazu (`<> Ustavi </>`),
 *  - navedeni nizi znotraj izrazov (`{saving ? 'Shrani' : 'Pošlji'}`),
 *  - lastnostni dostop, ki renderira tekst (`{action.label}`, `{mat}`).
 * Tag-notranji nizi (className="…", title="…") so VEDNO preskočeni.
 */
export function imaVidenTekst(child: string): boolean {
  if (typeof child !== 'string') {
    throw new TypeError('imaVidenTekst: child mora biti niz (fail-closed)')
  }
  const n = child.length
  const kosi: string[] = []
  let i = 0
  let globina = 0
  let vFragmentu = false

  while (i < n) {
    const c = child[i]
    if (c === '{') {
      globina += 1
      i += 1
      continue
    }
    if (c === '}') {
      globina -= 1
      vFragmentu = false
      i += 1
      continue
    }
    if (c === '<') {
      // fragmentna znamenja: <> (odpri) in </> (zapri) — samo v izrazu
      if (i + 1 < n && child[i + 1] === '>' && globina > 0) {
        vFragmentu = true
        i += 2
        continue
      }
      if (i + 2 < n && child[i + 1] === '/' && child[i + 2] === '>' && globina > 0) {
        vFragmentu = false
        i += 3
        continue
      }
      // preskoči cel tag (atributi vključno z navedki)
      i += 1
      while (i < n && child[i] !== '>') {
        if (child[i] === '"' || child[i] === "'") {
          const q = child[i]
          i += 1
          while (i < n && child[i] !== q) i += 1
        }
        i += 1
      }
      i += 1
      continue
    }
    if ((c === '"' || c === "'" || c === '`') && globina > 0) {
      const q = c
      i += 1
      while (i < n && child[i] !== q) {
        if (child[i] === '\\') {
          i += 1
          if (i < n) {
            kosi.push(child[i])
            i += 1
          }
          continue
        }
        kosi.push(child[i])
        i += 1
      }
      i += 1
      continue
    }
    if (globina === 0 || (globina > 0 && vFragmentu)) {
      kosi.push(c)
    }
    i += 1
  }

  if (VidenTekstRe.test(kosi.join(''))) return true

  // lastnostni/oklepajski dostop, ki renderira tekst: {action.label}, {k},
  // {tipMeritveLabels[tip]} — brez tagov (odstranjeni, da ne motijo).
  const brezTagov = child.replace(/<[^<>]*>/g, '')
  const re = /\{\s*([A-Za-z_$][\w.$]*\[[^\]]*\]|[A-Za-z_$][\w.$]*)\s*\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(brezTagov)) !== null) {
    if (!/^(true|false|null|undefined)$/.test(m[1])) return true
  }
  return false
}

/**
 * Skeniraj vir za ikonske <Button>/<button> BREZ dostopnega imena.
 * Kandidat je gumb, kjer opening tag NIMA aria-label/aria-labelledby IN
 * child vsebina NIMA vidnega besedila. Self-closing gumb = vedno kandidat
 * (prazen child — popravek r157).
 */
export function skenirajGumbeBrezImena(src: string): GumbBrezImena[] {
  if (typeof src !== 'string') {
    throw new TypeError('skenirajGumbeBrezImena: vir mora biti niz (fail-closed)')
  }
  const zadetki: GumbBrezImena[] = []
  for (const tag of ['Button', 'button'] as const) {
    const odP = '<' + tag
    const zapP = '</' + tag + '>'
    let idx = 0
    while (true) {
      const start = src.indexOf(odP, idx)
      if (start === -1) break
      const konecBesede = start + odP.length
      // besedna meja: <ButtonX / <buttons ne štejeta
      if (konecBesede < src.length && (/[A-Za-z0-9]/.test(src[konecBesede]) || src[konecBesede] === '_')) {
        idx = start + 1
        continue
      }
      // zapiralni tag </button> / </Button> (pred '<' je '/') — NI odpiralni
      if (start > 0 && src[start - 1] === '/') {
        idx = start + 1
        continue
      }
      const konecTag = najdiTagKonec(src, start + odP.length)
      if (konecTag === -1) {
        idx = start + 1
        continue
      }
      const tagTekst = src.slice(start, konecTag + 1)
      // ime že je — ni kandidat
      if (tagTekst.includes('aria-label') || tagTekst.includes('aria-labelledby')) {
        idx = konecTag + 1
        continue
      }
      const selfClosing = /\/\s*>\s*$/.test(tagTekst)
      let child = ''
      if (!selfClosing) {
        const zap = src.indexOf(zapP, konecTag + 1)
        if (zap !== -1) child = src.slice(konecTag + 1, zap)
      }
      if (imaVidenTekst(child)) {
        idx = konecTag + 1
        continue
      }
      zadetki.push({
        vrstica: src.slice(0, start).split('\n').length,
        tag,
        childPovzetek: child.split(/\s+/).join(' ').trim().slice(0, 140),
      })
      idx = konecTag + 1
    }
  }
  // determinizem: vrstni red po poziciji v viru (Button/button prekrižano)
  return zadetki
}
