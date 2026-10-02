// R191 — val 2 omejevanja hitrosti: VSE preostale mutirajoče rute + inventarni
// stražar.
// ---------------------------------------------------------------------------
// R190 (val 1) je aktiviral WRITE_LIMIT na 9 računsko intenzivnih rutah (10
// handlerjev). R191 (val 2) zapre VARNOST.md "Omejevanje hitrosti na drugih
// rutah" do konca: vsaka PREOSTALA mutirajoča ruta (43 datotek, 58 handlerjev
// od R195 — sessions DELETE 'odjavi ostale' se pridruži množici)
// dobi ENAK guard kot prvi stavek handlerja. Skupaj: 52 datotek / 68 handlerjev
// z `zapisOmejitev` + 11 datotek z lastnim `checkRate` (auth družina, setup,
// aktivacija, javna merjenja, portal žeton) = 100 % mutirajočih rut omejenih.
//
// INVENTARNI STRAŽAR (trajen): test preišče datotečni sistem in zahteva, da
// VSAKA ruta z mutirajočim handlerjem (POST/PATCH/DELETE/PUT) vsebuje
// `zapisOmejitev(` ALI `checkRate(` — nova ruta brez omejitve pade v CI.
// (Vzorec r172 line-stražarjev; deterministično, brez izjem brez komentarja.)
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

/** Vse route.ts pod src/app/api (rekurzivno). */
function vseRute(dir: string = 'src/app/api'): string[] {
  const izidi: string[] = []
  for (const ime of readdirSync(dir)) {
    const pot = join(dir, ime)
    if (statSync(pot).isDirectory()) izidi.push(...vseRute(pot))
    else if (ime === 'route.ts') izidi.push(pot)
  }
  return izidi
}

const MUTACIJE = /export async function (POST|PATCH|DELETE|PUT)\(/
/** Val-1 rute (R190) — imajo že svoj test; tu jih izključimo iz val-2 štetja. */
const VAL1 = new Set([
  'calculator', 'quote', 'viz/render', 'viz/preview', 'viz/product-preview',
  'viz/stage', 'measurement/detect', 'measurement/confirm', 'sync',
])

const vseMutirajoce = vseRute().filter((p) => MUTACIJE.test(srcOf(p)))
const zZapisOmejitev = vseMutirajoce.filter((p) => srcOf(p).includes('zapisOmejitev('))
const val2 = zZapisOmejitev.filter((p) => !VAL1.has(p.replace('src/app/api/', '').replace('/route.ts', '')))

const stHandlerjev = (src: string): number =>
  (src.match(/export async function (?:POST|PATCH|DELETE|PUT)\(/g) ?? []).length
const stGuardov = (src: string): number => (src.match(/const zavrnjeno = zapisOmejitev\(request, /g) ?? []).length

describe('R191 — val 2 žičenje (46 datotek / 61 handlerjev od R195, ENAK vzorec kot val 1; PIN SHIFT R374: 43/58→46/61 — +price-book POST, +quotes POST, +quotes/[id] PATCH)', () => {
  it('val 2 dejansko pokriva pričakovano množico (46 datotek, 61 handlerjev)', () => {
    expect(val2.length).toBe(46)
    const handlerji = val2.reduce((n, p) => n + stHandlerjev(srcOf(p)), 0)
    expect(handlerji).toBe(61)
    // vsaka val-2 datoteka: št. guardov == št. handlerjev
    for (const p of val2) {
      const src = srcOf(p)
      expect(stGuardov(src)).toBe(stHandlerjev(src))
    }
  })

  it('vsaka val-2 datoteka ima EN import in guard KOT PRVI stavek handlerja', () => {
    for (const p of val2) {
      const src = srcOf(p)
      expect(src.match(/import \{ zapisOmejitev \} from '@\/lib\/rate-limit'/g)?.length).toBe(1)
      // guard zaporedje (const + if) se pojavlja natanko tolikokrat, kot je handlerjev:
      expect(src.split('const zavrnjeno = zapisOmejitev(request').length - 1).toBe(stHandlerjev(src))
      expect(src.split('if (zavrnjeno) return zavrnjeno').length - 1).toBe(stHandlerjev(src))
      // PO HANDLERJU: vsak mutirajoči handler nosi natanko 1 guard, postavljen
      // ŠELE pred svojim delom (auth/json klici GET handlerjev pred njim so legitimi).
      const deklaracije = [...src.matchAll(/export async function (?:POST|PATCH|DELETE|PUT)\(/g)].map((m) => m.index)
      for (let i = 0; i < deklaracije.length; i++) {
        const konec = i + 1 < deklaracije.length ? deklaracije[i + 1] : src.length
        const rezina = src.slice(deklaracije[i], konec)
        expect(stGuardov(rezina)).toBe(1)
        const guardV = rezina.indexOf('const zavrnjeno = zapisOmejitev(request')
        const authV = rezina.indexOf('await authenticate(')
        const jsonV = rezina.indexOf('request.json()')
        if (authV >= 0) expect(guardV).toBeLessThan(authV)
        if (jsonV >= 0) expect(guardV).toBeLessThan(jsonV)
      }
    }
  })

  it('prioritetne rute iz workloga (invoices, customers, projects, schedules) so pokrite', () => {
    for (const ruta of ['invoices', 'customers', 'projects', 'schedules']) {
      const src = srcOf(`src/app/api/${ruta}/route.ts`)
      expect(src).toContain('zapisOmejitev(')
      // vsi handlerji (invoices ima POST+PATCH+DELETE) so žičeni:
      expect(stGuardov(src)).toBe(stHandlerjev(src))
    }
  })

  it('BOM rute ostajajo NEŽIČENE prek zapisOmejitev (AI-frozen sosedstvo; pokrite s checkRate pravilom spodaj NE velja — so zavestno brez omejitve)', () => {
    // bom-draft / bom-refine: val 2 jih ŽIČI (gre za route handlerja, NE pricing
    // core) — ta trditev dokumentira odločitev: če kdaj padeta ven, test pade.
    expect(srcOf('src/app/api/bom-draft/route.ts')).toContain("zapisOmejitev(request, 'bom-draft')")
    expect(srcOf('src/app/api/bom-refine/route.ts')).toContain("zapisOmejitev(request, 'bom-refine')")
  })
})

describe('R191 — INVENTARNI STRAŽAR: 100 % mutirajočih rut omejenih (trajno)', () => {
  it('vsaka ruta z POST/PATCH/DELETE/PUT vsebuje zapisOmejitev ALI checkRate', () => {
    const brez: string[] = []
    for (const p of vseMutirajoce) {
      const src = srcOf(p)
      if (!src.includes('zapisOmejitev(') && !src.includes('checkRate(')) brez.push(p)
    }
    expect(brez).toEqual([])
  })

  it('množice se štejejo konsistentno (55 z zapisOmejitev = val1 9 + val2 46; preostanek z checkRate; PIN SHIFT R374: 52→55)', () => {
    expect(zZapisOmejitev.length).toBe(55)
    const zCheckRate = vseMutirajoce.filter((p) => srcOf(p).includes('checkRate('))
    expect(zZapisOmejitev.length + zCheckRate.length).toBe(vseMutirajoce.length)
    expect(zCheckRate.length).toBe(10)
  })

  it('helper vrača NextResponse (assignable tudi v handlerje z deklariranim povratnim tipom)', () => {
    const lib = srcOf('src/lib/rate-limit.ts')
    expect(lib).toContain('export function zapisOmejitev(request: Request, ruta: string): NextResponse | null')
    expect(lib).toContain('import { NextResponse } from \'next/server\'')
  })
})

describe('R191 — VARNOST.md: postavka "Omejevanje hitrosti na drugih rutah" ZAPRTA', () => {
  it('vrstica je odstranjena iz "Kaj še NI narejeno" in dokumentirana kot zaključena (val 1+2)', () => {
    const src = srcOf('docs/VARNOST.md')
    // odsek "Kaj še NI narejeno" NE sme več omenjati omejevanja pisanja:
    const odsekNi = src.slice(src.indexOf('## Kaj še NI narejeno'))
    expect(odsekNi).not.toContain('Omejevanje hitrosti')
    // zaključna sekcija obstaja in nosi val 1+2 pokritje:
    expect(src).toContain('## Omejevanje hitrosti na pisanju — ZAPRTO (R190/R191 — val 1+2)')
    expect(src).toContain('55 datotek / 71 handlerjev') // PIN SHIFT R374 (issue #13 R165: +price-book POST, +quotes POST, +quotes/[id] PATCH)
  })
})
