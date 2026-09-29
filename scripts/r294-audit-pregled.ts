// R294 — začasni obsežni pregled (true violation surface) — poženem enkrat,
// rezultat odloča o popravkih vs. izjemah; datoteka ostane kot CLI dokaz.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pregledajAvtomatizacijo } from '../src/lib/avtomatizacija-audit'

const ROOT = join(process.cwd(), 'src')

function zberiLib(): { pot: string; vsebina: string }[] {
  const out: { pot: string; vsebina: string }[] = []
  for (const f of readdirSync(join(ROOT, 'lib'))) {
    const cel = join(ROOT, 'lib', f)
    if (statSync(cel).isFile() && f.endsWith('.ts')) {
      out.push({ pot: `src/lib/${f}`, vsebina: readFileSync(cel, 'utf8') })
    }
  }
  return out
}

function zberiRute(dir: string, rel: string): { pot: string; vsebina: string }[] {
  const out: { pot: string; vsebina: string }[] = []
  for (const f of readdirSync(dir)) {
    const cel = join(dir, f)
    if (statSync(cel).isDirectory()) out.push(...zberiRute(cel, `${rel}/${f}`))
    else if (f === 'route.ts') out.push({ pot: `src/app${rel}/${f}`, vsebina: readFileSync(cel, 'utf8') })
  }
  return out
}

const viri = [...zberiLib(), ...zberiRute(join(ROOT, 'app', 'api'), '/api')]
const krsitve = pregledajAvtomatizacijo(viri)
const poVzorcu = new Map<string, number>()
for (const k of krsitve) poVzorcu.set(k.vzorec, (poVzorcu.get(k.vzorec) ?? 0) + 1)
console.log('skupaj virov:', viri.length)
console.log('kršitve:', krsitve.length, Object.fromEntries(poVzorcu))
for (const k of krsitve.slice(0, 40)) {
  console.log(`${k.vzorec} · ${k.pot}:${k.vrstica} · ${k.okoli}`)
}
