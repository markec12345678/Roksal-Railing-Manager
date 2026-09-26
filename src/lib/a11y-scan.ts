// R158 — statični a11y skener: ikonski gumbi brez dostopnega imena.
// ---------------------------------------------------------------------------
// TS port orodja scripts/r157-a11y-audit.py (R157/R158), da je regresijski
// stražar poganjan kot del vitest suite-a (r157/r158 testna datoteka).
// Pokriva OBADVA <Button> (shadcn) in surovi <button> elemente; od R160 tudi
// surove <a> povezave (ikonske povezave brez imena = isti razred napake —
// R158 kandidat (c): ročni pregled je pokazal čisto stanje, stražar ga drži).
//
// Algoritem:
//  1. najdi odpiralni tag (brace/quote-aware — arrow funkcije vsebujejo '>'),
//  2. če tag nima aria-label/aria-labelledby, preveri otroka:
//     - surova besedilna vozlišča (zunaj tagov; znotraj izrazov samo v
//       fragmentih <> … </>),
//     - nizi v izrazih ({cond ? 'Shrani' : 'Pošlji'}),
//     - identifikatorji/property/bracket dostop ({action.label},
//       {tipMeritveLabels[tip]}), ki izrišejo vrednost.
//     Če nič ne najde → gumb je IKONSKI in MORA imeti aria-label.

function findOpeningTagEnd(src: string, start: number): number {
  let i = start
  let depth = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '{') depth += 1
    else if (c === '}') depth -= 1
    else if ((c === '"' || c === "'") && depth === 0) {
      const q = c
      i += 1
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') i += 1
        i += 1
      }
    } else if (c === '>' && depth === 0) return i
    i += 1
  }
  return -1
}

function hasVisibleText(child: string): boolean {
  let i = 0
  let depthBrace = 0
  let inFragment = false
  let text = ''
  const n = child.length
  while (i < n) {
    const c = child[i]
    if (c === '{') {
      depthBrace += 1
      i += 1
      continue
    }
    if (c === '}') {
      depthBrace -= 1
      inFragment = false
      i += 1
      continue
    }
    if (c === '<') {
      if (depthBrace > 0 && child[i + 1] === '>') {
        inFragment = true
        i += 2
        continue
      }
      if (depthBrace > 0 && child[i + 1] === '/' && child[i + 2] === '>') {
        inFragment = false
        i += 3
        continue
      }
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
    if ((c === '"' || c === "'" || c === '`') && depthBrace > 0) {
      const q = c
      i += 1
      const buf: string[] = []
      while (i < n && child[i] !== q) {
        if (child[i] === '\\') {
          i += 1
          if (i < n) {
            buf.push(child[i])
            i += 1
          }
          continue
        }
        buf.push(child[i])
        i += 1
      }
      text += buf.join('')
      i += 1
      continue
    }
    if (depthBrace === 0 || inFragment) text += c
    i += 1
  }
  // R160: tudi CIFRE so vidno besedilo (tel. številka "040 123 456" je
  // veljavno dostopno ime) — prej je skener zahteval črke in lažno javil
  // povezave z izključno številčnim besedilom.
  if (/[A-Za-z0-9žščćđŽŠČĆĐ]/.test(text)) return true
  const stripped = child.replace(/<[^<>]*>/g, '')
  for (const m of stripped.matchAll(
    /\{\s*([A-Za-z_$][\w.$]*\[[^\]]*\]|[A-Za-z_$][\w.$]*)\s*\}/g,
  )) {
    if (!/^(true|false|null|undefined)$/.test(m[1])) return true
  }
  return false
}

export interface IconButtonOffender {
  file: string
  line: number
  tag: string
}

interface ScanKind {
  open: string
  close: string
}

const SCAN_KINDS: readonly ScanKind[] = [
  { open: '<Button', close: '</Button>' },
  { open: '<button', close: '</button>' },
  { open: '<a', close: '</a>' },
]

/** Skensira TSX vir in vrne ikonske gumbe/povezave (<Button>/<button>/<a>) brez
 * dostopnega imena (aria-label/aria-labelledby ALI vidno besedilo). */
export function iconOnlyButtonsWithoutLabel(
  src: string,
  file = 'inline.tsx',
): IconButtonOffender[] {
  const offenders: IconButtonOffender[] = []
  for (const kind of SCAN_KINDS) {
    let idx = 0
    for (;;) {
      const start = src.indexOf(kind.open, idx)
      if (start === -1) break
      const after = start + kind.open.length
      if (after < src.length && /[A-Za-z0-9_]/.test(src[after])) {
        idx = start + 1
        continue
      }
      if (start > 0 && src[start - 1] === '/') {
        idx = start + 1
        continue
      }
      const tagEnd = findOpeningTagEnd(src, start)
      if (tagEnd === -1) {
        idx = start + 1
        continue
      }
      const tag = src.slice(start, tagEnd + 1)
      if (!tag.includes('aria-label') && !tag.includes('aria-labelledby')) {
        const selfClosing = /\/>\s*$/.test(tag)
        const close = selfClosing ? -1 : src.indexOf(kind.close, tagEnd)
        const child = close !== -1 ? src.slice(tagEnd + 1, close) : ''
        if (!hasVisibleText(child)) {
          offenders.push({
            file,
            line: src.slice(0, start).split('\n').length,
            tag: kind.open,
          })
        }
      }
      idx = tagEnd
    }
  }
  return offenders.sort((a, b) => a.line - b.line)
}
