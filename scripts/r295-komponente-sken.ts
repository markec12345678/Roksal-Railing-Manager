// R295 — komponentni sloj sken (issue #1 nadaljevanje: skener razširjen na
// src/components — prikazni sloj je bil v R294 izven obsega). Enkratni CLI
// dokaz: koliko hitov, kateri vzorci, katere datoteke → odloča o popravkih
// vs. izjemah (kanon r294: najprej resnica, potem politika).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pregledajAvtomatizacijo, pregledajKomponente } from '../src/lib/avtomatizacija-audit'

const ROOT = join(process.cwd(), 'src', 'components')

function zberiKomponente(dir: string, rel: string): { pot: string; vsebina: string }[] {
  const out: { pot: string; vsebina: string }[] = []
  for (const f of readdirSync(dir)) {
    const cel = join(dir, f)
    if (statSync(cel).isDirectory()) out.push(...zberiKomponente(cel, `${rel}/${f}`))
    else if (f.endsWith('.tsx') || f.endsWith('.ts'))
      out.push({ pot: `src/components${rel}/${f}`, vsebina: readFileSync(cel, 'utf8') })
  }
  return out
}

const viri = zberiKomponente(ROOT, '')
const krsitve = pregledajKomponente(viri)
const poVzorcu = new Map<string, number>()
const poDatoteki = new Map<string, number>()
for (const k of krsitve) {
  poVzorcu.set(k.vzorec, (poVzorcu.get(k.vzorec) ?? 0) + 1)
  poDatoteki.set(k.pot, (poDatoteki.get(k.pot) ?? 0) + 1)
}
console.log('komponent (datoteke):', viri.length)
const filtr = process.env.R295_VZOREC
const prikaz = filtr ? krsitve.filter((k) => k.vzorec === filtr) : krsitve
if (filtr) {
  for (const k of prikaz) console.log(`${k.vzorec} · ${k.pot}:${k.vrstica} · ${k.okoli.slice(0, 140)}`)
  console.log('filtrirano:', prikaz.length)
  process.exit(0)
}
console.log('hitov:', krsitve.length, Object.fromEntries(poVzorcu))
console.log('--- po datoteki ---')
for (const [p, n] of [...poDatoteki.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`${n}\t${p}`)
console.log('--- prvi 60 hitov ---')
for (const k of krsitve.slice(0, 60))
  console.log(`${k.vzorec} · ${k.pot}:${k.vrstica} · ${k.okoli.slice(0, 100)}`)
