// R309 — EN VIR I/O meja telesa zahteve (src/lib/api-telo)
// ─────────────────────────────────────────────────────────────────
// Migracijski val: 26 throw-style json() handlerjev → izrecen 400
// guard (vzorec calculator R308, dvignjen v EN VIR). Testi: meja
// enote (uspeh/400 ×8 vhodnih oblik), determinizem, ovojnica kanon,
// STRAŽAR realnega drevesa (26 handlerjev uvozi helper + NIČ surovega
// await request.json(); calculator popolnoma preseljen; sync IZVZET).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { API_TELO_NAPAKA, preberiJsonTelo } from '@/lib/api-telo'

function zahteva(telo: string): Request {
  return new Request('http://lokalni.test/api/proba', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: telo,
  })
}

describe('r309 api-telo — meja enote', () => {
  it('uspeh: veljaven JSON objekt → ok:true z istim telom (passthrough)', async () => {
    const izid = await preberiJsonTelo(zahteva('{"a":1,"b":"x","gnezdo":{"c":true}}'))
    expect(izid.ok).toBe(true)
    if (!izid.ok) return
    expect(izid.telo).toEqual({ a: 1, b: 'x', gnezdo: { c: true } })
  })

  it('uspeh: polje je tudi objekt (typeof [] === "object") — calculator semantika; zod zavrže kasneje', async () => {
    const izid = await preberiJsonTelo(zahteva('[1,2,3]'))
    expect(izid.ok).toBe(true)
    if (!izid.ok) return
    expect(izid.telo).toEqual([1, 2, 3])
  })

  it('400: pokvarjen JSON → ok:false z ovojnico { error }', async () => {
    const izid = await preberiJsonTelo(zahteva('{"a":1,,}'))
    expect(izid.ok).toBe(false)
    if (izid.ok) return
    expect(izid.odgovor.status).toBe(400)
    const teleso = (await izid.odgovor.json()) as { error: string }
    expect(teleso.error).toBe(API_TELO_NAPAKA)
  })

  it('400: prazno telo', async () => {
    const izid = await preberiJsonTelo(zahteva(''))
    expect(izid.ok).toBe(false)
    if (izid.ok) return
    expect(izid.odgovor.status).toBe(400)
  })

  it('400: null literal NI objekt', async () => {
    const izid = await preberiJsonTelo(zahteva('null'))
    expect(izid.ok).toBe(false)
    if (izid.ok) return
    expect(izid.odgovor.status).toBe(400)
  })

  it('400: niz literal NI objekt', async () => {
    const izid = await preberiJsonTelo(zahteva('"samo niz"'))
    expect(izid.ok).toBe(false)
    if (izid.ok) return
    expect(izid.odgovor.status).toBe(400)
  })

  it('400: število literal NI objekt', async () => {
    const izid = await preberiJsonTelo(zahteva('42'))
    expect(izid.ok).toBe(false)
    if (izid.ok) return
    expect(izid.odgovor.status).toBe(400)
  })

  it('400: boolean literal NI objekt', async () => {
    const izid = await preberiJsonTelo(zahteva('true'))
    expect(izid.ok).toBe(false)
    if (izid.ok) return
    expect(izid.odgovor.status).toBe(400)
  })

  it('determinizem: isti pokvarjen vhod ×2 = isti status in isto sporočilo (EN VIR)', async () => {
    const a = await preberiJsonTelo(zahteva('{pokvarjen'))
    const b = await preberiJsonTelo(zahteva('{pokvarjen'))
    expect(a.ok).toBe(false)
    expect(b.ok).toBe(false)
    if (a.ok || b.ok) return
    expect(a.odgovor.status).toBe(b.odgovor.status)
    const ta = (await a.odgovor.json()) as { error: string }
    const tb = (await b.odgovor.json()) as { error: string }
    expect(ta.error).toBe(tb.error)
  })

  it('ovojnica kanon: 400 odgovor nosi NATANKO { error } ključ', async () => {
    const izid = await preberiJsonTelo(zahteva('x'))
    expect(izid.ok).toBe(false)
    if (izid.ok) return
    const teleso = (await izid.odgovor.json()) as Record<string, unknown>
    expect(Object.keys(teleso)).toEqual(['error'])
  })
})

// ── STRAŽAR realnega drevesa ────────────────────────────────────────
const API = join(process.cwd(), 'src', 'app', 'api')
const MIGRIRANI = [
  'ar-snapshots', 'bom-draft', 'bom-refine', 'crews', 'customers', 'deal-lock',
  'documents', 'gallery', 'inventory', 'invoices', 'material-orders',
  'material-prices', 'measurement/confirm', 'measurements', 'notifications/read',
  'photos', 'portal', 'profili', 'projects', 'punch', 'schedules', 'sketches',
  'slopes', 'suppliers', 'surveys', 'vision/placement',
]
const SUROV_JSON = /await\s+(?:request|req)\.json\(\)/

describe('r309 api-telo — STRAŽAR stene ure (realno drevo)', () => {
  it('vseh 26 migriranih handlerjev: uvoz EN VIR guard + NIČ surovega await request.json()', () => {
    for (const ime of MIGRIRANI) {
      const vir = readFileSync(join(API, ime, 'route.ts'), 'utf8')
      expect(vir, `${ime}: uvoz preberiJsonTelo manjka`).toContain("import { preberiJsonTelo } from '@/lib/api-telo'")
      expect(SUROV_JSON.test(vir), `${ime}: surov await request.json() še prisoten`).toBe(false)
    }
  })

  it('calculator (vzorčni R308 potrošnik): popolnoma preseljen na EN VIR — nič lastnega .json() guard', () => {
    const vir = readFileSync(join(API, 'calculator', 'route.ts'), 'utf8')
    expect(vir).toContain("import { preberiJsonTelo } from '@/lib/api-telo'")
    expect(SUROV_JSON.test(vir)).toBe(false)
    expect(vir).not.toContain('.catch(() => null)')
  })

  it('/api/sync je IZRECNO izvzet (kontrakt NIČ) — NI uvoza helperja', () => {
    const vir = readFileSync(join(API, 'sync', 'route.ts'), 'utf8')
    expect(vir).not.toContain('@/lib/api-telo')
  })

  it('migracijski seznam pokriva natanko 26 handlerjev in vsi obstajajo na disku', () => {
    expect(MIGRIRANI).toHaveLength(26)
    for (const ime of MIGRIRANI) {
      const s = statSync(join(API, ime, 'route.ts'))
      expect(s.isFile(), `${ime}: route.ts manjka`).toBe(true)
    }
  })

  it('EN VIR sporočilo: lib izvozi konstanto, ki je edina resnica (brez podvojitve v handlerjih)', () => {
    expect(API_TELO_NAPAKA).toBe('Neveljavno telo zahteve — pričakovan JSON objekt')
    for (const ime of MIGRIRANI) {
      const vir = readFileSync(join(API, ime, 'route.ts'), 'utf8')
      expect(vir, `${ime}: podvojen literal sporočila v handlerju`).not.toContain('Neveljavno telo zahteve')
    }
  })
})

// ── MANDATORY STIL (R309): surove palete invoice-managerja harmonizirane ──
describe('R309 — MANDATORY STIL: invoice-manager žetoni (0 novih hex)', () => {
  const vir = () => readFileSync(join(process.cwd(), 'src', 'components', 'roksal', 'invoice-manager.tsx'), 'utf8')

  it('statusne značke IZDAN/PLACAN/STORNIRAN na roksal žetonih (dot + vsebnik; tekst ink — r162 lekcija)', () => {
    const v = vir()
    expect(v).toContain("className: 'bg-roksal-amber/10 text-roksal-ink border-roksal-amber/40', dot: 'bg-roksal-amber'")
    expect(v).toContain("className: 'bg-roksal-green/10 text-roksal-ink border-roksal-green/40', dot: 'bg-roksal-green'")
    expect(v).toContain("className: 'bg-roksal-red/10 text-roksal-ink border-roksal-red/40', dot: 'bg-roksal-red'")
  })

  it('KPI kartice Plačano/Odprto/Zapadlo na žetonih; CTA + ikona brez surovih par', () => {
    const v = vir()
    expect(v).toContain('border-roksal-green/30 bg-roksal-green/10')
    expect(v).toContain('border-roksal-amber/30 bg-roksal-amber/10')
    expect(v).toContain('border-roksal-red/30 bg-roksal-red/10')
    expect(v).toContain('bg-roksal-amber text-roksal-navy hover:bg-roksal-amber/90 press-scale')
    expect(v).toContain('<Receipt aria-hidden="true" className="h-4 w-4 text-roksal-amber" />')
  })

  it('surovi vzorci IZGINILI (must_miss — natančno polni vsebniki, lekcija R308)', () => {
    const v = vir()
    expect(v).not.toContain("bg-amber-50 dark:bg-amber-950/40 text-amber-700")
    expect(v).not.toContain("bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700")
    expect(v).not.toContain("bg-red-50 dark:bg-red-950/40 text-red-700")
    expect(v).not.toContain('bg-amber-500 text-navy-900')
    expect(v).not.toContain('text-amber-500 dark:text-amber-400')
  })
})
