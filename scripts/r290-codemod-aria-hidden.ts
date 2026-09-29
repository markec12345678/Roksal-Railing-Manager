/**
 * R290 — P1-d codemod: vstavi manjkajoči `aria-hidden` na dekorativne
 * lucide ikonske instance (Mega-diff od R242, 629 mest takrat).
 *
 * EN VIR: detekcija = src/lib/a11y-ikon-scan.ts (ISTA logika kot strazar test).
 * Raba:
 *   bun scripts/r290-codemod-aria-hidden.ts --dry-run   # samo poročilo
 *   bun scripts/r290-codemod-aria-hidden.ts             # vstavi (paloži)
 *
 * Izjeme (NIKOLI se ne tiče — izjeme-audit R242 kanon):
 *  - role="img" / role={izraz}  → vsebinska grafika (R150 libela, R231 kompas)
 *  - {...spread}                → vrstni red atributov ni statično dokazljiv
 *  - že ima aria-hidden         → ničesar
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  kandidatiZaAriaHidden,
  skenirajIkonAriaHidden,
  vstaviAriaHidden,
} from '../src/lib/a11y-ikon-scan'

const KOREN = process.cwd()
const MAPA = ['src/components', 'src/app']
const dryRun = process.argv.includes('--dry-run')

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) tsxFiles(p, acc)
    else if (/\.(tsx|ts)$/.test(e.name)) acc.push(p)
  }
  return acc
}

/** Vstavljanje: vstaviAriaHidden ŽIVI V LIB-u (EN VIR — strazar test isti koda). */

const vsi = { instance: 0, imaAriaHidden: 0, roleImg: 0, spread: 0, vstavljeno: 0 }
let datotekeSpremenjene = 0
const porocilo: string[] = []

for (const mapa of MAPA) {
  for (const pot of tsxFiles(join(KOREN, mapa))) {
    const vir = readFileSync(pot, 'utf8')
    const vse = skenirajIkonAriaHidden(vir)
    if (vse.length === 0) continue
    vsi.instance += vse.length
    const rel = pot.slice(KOREN.length + 1)
    const kandidati = kandidatiZaAriaHidden(vir)

    // Vstavljanje od zadaj naprej (indeksi ostanejo veljavni).
    let spremeni = [...kandidati].reverse()
    let novVir = vir
    if (!dryRun) {
      for (const k of spremeni) {
        novVir = vstaviAriaHidden(novVir, k.konecTag, k.selfClosing)
      }
      if (kandidati.length > 0) {
        writeFileSync(pot, novVir, 'utf8')
        datotekeSpremenjene += 1
      }
    }
    vsi.vstavljeno += kandidati.length
    vsi.imaAriaHidden += vse.filter((z) => z.imaAriaHidden).length
    vsi.roleImg += vse.filter((z) => z.roleImg && !z.imaAriaHidden).length
    vsi.spread += vse.filter((z) => z.imaSpread && !z.imaAriaHidden).length

    if (kandidati.length > 0) {
      porocilo.push(
        `${rel}: ${kandidati.length} kandidatov — ` +
          kandidati.slice(0, 8).map((k) => `${k.ime}@${k.vrstica}`).join(', ') +
          (kandidati.length > 8 ? ' …' : ''),
      )
    }
  }
}

console.log(`R290 ARIA-HIDDEN codemod ${dryRun ? '(DRY-RUN)' : '(PALOŽENO)'} — P1-d mega-diff`)
console.log(`  lucide instance skupaj : ${vsi.instance}`)
console.log(`  že aria-hidden         : ${vsi.imaAriaHidden}`)
console.log(`  izjema role=img        : ${vsi.roleImg}`)
console.log(`  izjema spread          : ${vsi.spread}`)
console.log(`  ${dryRun ? 'KANDIDATI' : 'VSTAVLJENO'}             : ${vsi.vstavljeno}`)
if (!dryRun) console.log(`  spremenjenih datotek   : ${datotekeSpremenjene}`)
if (porocilo.length > 0) {
  console.log('--- po datotekah ---')
  for (const vr of porocilo) console.log('  ' + vr)
}
