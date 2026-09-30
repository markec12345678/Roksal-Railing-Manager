// R310 — 3. val unifikacije I/O meje (issue #1 — «stena ura» zaključek)
// ─────────────────────────────────────────────────────────────────
// 22 handlerjev s surovim `.catch(() => null)` je preseljen na EN VIR
// preberiJsonTelo (vzorec R309; R308 calculator izviren). Testi:
// STRAŽAR realnega drevesa (val-3 seznam ×3 trditve), GLOBALNA
// nepropustnost stene (vsak route.ts, ki bere telo, je ALI migriran
// ALI na izrecnem izjemnem seznamu z razlogom), handler-nivo EN VIR
// dokaz na prijavi (razčlenjevalnik strelja PRED zod in PRED bazo),
// determinizem. IZJEME z RAZLOGOM (nikoli tiho):
//   sync               — kontrakt NIČ (R309)
//   auth/logout        — zahtevana toleranca: odjava je best-effort,
//                        pokvarjen telo NE sme preprečiti odjave
//                        (klient pošilja {}, zunanji kličetelj brez
//                        telesa mora ostati veljaven)
//   vision/scene       — bespoke 413 size-guard PRED parse (feature,
//                        preberiJsonTelo bi ga izgubil)
//   measurement/detect — bespoke 413 size-guard PRED parse (feature)
//   public/measure     — bespoke 413 + revizijski dogodki MEASURE_REJECTED
//                        ob zavitju (fail-closed že pravilen)
import { describe, expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { API_TELO_NAPAKA } from '@/lib/api-telo'
import { POST as prijavaPost } from '@/app/api/auth/route'

const API = join(process.cwd(), 'src', 'app', 'api')

// 3. val — 22 handlerjev (abecedno; evidence ima 2 mesti: POST + PATCH)
const VAL3 = [
  'ar/analyze', 'auth', 'auth/email', 'auth/password', 'auth/register',
  'crm', 'equipment', 'equipment/events', 'evidence', 'measure/photo',
  'measurements/[id]', 'qc', 'quote', 'railing-layout', 'setup', 'users',
  'users/activate', 'viz/preview', 'viz/product-preview', 'viz/projects',
  'viz/projects/[id]', 'viz/render',
] as const

const IZJEME: Record<string, string> = {
  sync: 'kontrakt NIČ (R309) — nič se ne spreminja',
  'auth/logout': 'zahtevana toleranca — best-effort odjava (pokvarjen telo ne sme preprečiti odjave)',
  'vision/scene': 'bespoke 413 size-guard PRED parse (feature)',
  'measurement/detect': 'bespoke 413 size-guard PRED parse (feature)',
  'public/measure': 'bespoke 413 + revizija MEASURE_REJECTED (fail-closed že pravilen)',
}

const SUROV_JSON = /await\s+(?:request|req)\.json\(\)/

describe('r310 val 3 — STRAŽAR stene ure (realno drevo)', () => {
  it('vseh 22 val-3 handlerjev: uvoz EN VIR guard + NIČ surovega json() + NIČ .catch(() => null)', () => {
    for (const ime of VAL3) {
      const vir = readFileSync(join(API, ime, 'route.ts'), 'utf8')
      expect(vir, `${ime}: uvoz preberiJsonTelo manjka`).toContain("import { preberiJsonTelo } from '@/lib/api-telo'")
      expect(SUROV_JSON.test(vir), `${ime}: surov await request.json() še prisoten`).toBe(false)
      expect(vir.includes('.catch(() => null)'), `${ime}: .catch(() => null) še prisoten`).toBe(false)
    }
  })

  it('val-3 seznam ima natanko 22 vnosov in vsi obstajajo na disku', () => {
    expect(VAL3).toHaveLength(22)
    for (const ime of VAL3) {
      const s = statSync(join(API, ime, 'route.ts'))
      expect(s.isFile(), `${ime}: route.ts manjka`).toBe(true)
    }
  })

  it('GLOBALNA nepropustnost stene: vsak route.ts, ki bere telo, je ALI migriran ALI izrecna izjema z razlogom', () => {
    // Sken: vsa route.ts pod src/app/api; telo-bralci = vsebujejo
    // request.json() ALI request.text() ALI preberiJsonTelo.
    const najdeni: string[] = []
    const obid = (dir: string) => {
      for (const e of readdirSafe(dir)) {
        const polno = join(dir, e)
        if (isDir(polno)) obid(polno)
        else if (e === 'route.ts') najdeni.push(polno)
      }
    }
    obid(API)
    expect(najdeni.length).toBeGreaterThan(50)
    for (const pot of najdeni) {
      const vir = readFileSync(pot, 'utf8')
      const bereTelo = vir.includes('request.json()') || vir.includes('request.text()') || vir.includes('preberiJsonTelo')
      if (!bereTelo) continue
      const rel = pot.slice(API.length + 1).replace(/\/route\.ts$/, '')
      const migriran = vir.includes("import { preberiJsonTelo } from '@/lib/api-telo'")
      if (migriran) continue
      expect(IZJEME[rel], `nepričakovano telo-branje zunaj stene: ${rel}`).toBeDefined()
    }
  })

  it('izjeme nosijo svoje razloge v kodi stene: sync/logout brez api-telo, scene/detect/measure z 413 guardom', () => {
    const sync = readFileSync(join(API, 'sync', 'route.ts'), 'utf8')
    expect(sync).not.toContain('@/lib/api-telo')
    const logout = readFileSync(join(API, 'auth/logout', 'route.ts'), 'utf8')
    expect(logout).not.toContain('@/lib/api-telo')
    expect(logout).toContain('.catch(() => null)') // toleranca ohranjena, izrecno
    for (const ime of ['vision/scene', 'measurement/detect', 'public/measure']) {
      const vir = readFileSync(join(API, ime, 'route.ts'), 'utf8')
      expect(vir).toContain('413')
      expect(vir).not.toContain('@/lib/api-telo')
    }
  })

  it('R310 STIL must_miss na SOURCE nivoju (lekcija R308 3): punch-list + team-tab brez surove amber palete', () => {
    // Build-nivo NI pripisljiv (ista surova sekvenca še živi v measurements-tab,
    // ki je izrecno izven R310 obsega — naslednji val); pripisljivost = vir.
    const SUROVA_AMBER = /amber-(50|100|200|300|400|500|600|700|800|900|950)\b/
    for (const dat of ['src/components/roksal/punch-list.tsx', 'src/components/roksal/team-tab.tsx']) {
      const vir = readFileSync(join(process.cwd(), dat), 'utf8')
      const vrstice = vir.split('\n').filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
      expect(vrstice, `${dat}: surova amber še prisotna: ${vrstice.join(' | ')}`).toEqual([])
    }
  })
})

describe('r310 val 3 — EN VIR dokaz na živem handlerju (prijava)', () => {
  it('prijava s pokvarjenim JSON → 400 z NATANKO EN VIR ovojnico (razčlenjevalnik PRED zod in bazo)', async () => {
    const zahteva = new Request('http://lokalni.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{pokvarjen',
    })
    const odgovor = await prijavaPost(zahteva)
    expect(odgovor.status).toBe(400)
    const teleso = (await odgovor.json()) as Record<string, unknown>
    expect(teleso).toEqual({ error: API_TELO_NAPAKA })
  })

  it('prijava z null literalem → 400 EN VIR (ne-objektno telo je meja, ne domena)', async () => {
    const zahteva = new Request('http://lokalni.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    })
    const odgovor = await prijavaPost(zahteva)
    expect(odgovor.status).toBe(400)
    const teleso = (await odgovor.json()) as Record<string, unknown>
    expect(teleso.error).toBe(API_TELO_NAPAKA)
  })

  it('determinizem: isti pokvarjen vhod ×2 = isti status in isto sporočilo (EN VIR)', async () => {
    const naredi = () => new Request('http://lokalni.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{pokvarjen',
    })
    const a = await prijavaPost(naredi())
    const b = await prijavaPost(naredi())
    expect(a.status).toBe(b.status)
    const ta = (await a.json()) as { error: string }
    const tb = (await b.json()) as { error: string }
    expect(ta.error).toBe(tb.error)
    expect(ta.error).toBe(API_TELO_NAPAKA)
  })
})

// ── pripomočki (brez odvisnosti od fs/readdirSync tipk) ─────────────
import { readdirSync } from 'node:fs'
function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}
function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}
