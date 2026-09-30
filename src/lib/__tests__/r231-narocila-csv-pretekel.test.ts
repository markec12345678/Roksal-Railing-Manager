// R231 — 'izvozi' družina (P1-e): Material → Naročila CSV izvoz dobi stolpec
// 'Pretekel rok' (DA/NE) — ENAJSTI signalec konvergence zamujene dimenzije
// (vodja R228, zvonček R229, Naročila oznaka R229, Domov R230, CSV/PDF R228,
// naročila-CSV R231). ENA resnica: ISTI lib jeZamujenaDobava kot zaslon
// (badge R229) — zaslon IN izvoz STA ISTA resnica (WYSIWYG, družina R226
// 'Brez dobavitelja' v Zalogi CSV). Kontrakt R140 NESPREMENJEN: izvoz je
// VEDNO VSA naročila (neodvisno od statusnega filtra).
//
// + [Mandatory] stil (P1-f): map-measure + measurements neutralne veje →
//   žetoni (en razred obe temi, 0 novih hex); SEMANTIC materialni doti
//   (reference-gallery barve + measurements material/ground palete) ostanejo
//   NAMERNE izjeme (barvna kodiranja materialov, ne stone dvojčki).
//
// + [Mandatory] infra (P1-g): skupna E2E knjižnica scripts/e2e-lib.sh
//   (prijava → dispatch → zapri vodič — ponavljanje od r218 zaprto).
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { jeZamujenaDobava } from '@/lib/zamujena-dobava'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const material = beri('src/components/roksal/material-intelligence-tab.tsx')
const mapMeasure = beri('src/components/roksal/map-measure.tsx')
const measurements = beri('src/components/roksal/measurements-tab.tsx')
// R319 (dekomp. faza 1): materialStebraColors paleta se je preselila v
// measurements/shared.ts (izluščena skupaj s SteberTable) — pin SHIFT
// po kanonu R180/R201/…/R314; `metal:` tla paleta je OSTALA v measurements-tab.
const measurementsShared = beri('src/components/roksal/measurements/shared.ts')
const refGallery = beri('src/components/roksal/reference-gallery.tsx')

// okno med dvema markerjema (r207 vzorec — za funkcijo downloadOrdersCsv)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const DANAS = new Date('2026-09-28T00:00:00')
const VCERAJ = '2026-09-27T00:00:00.000Z'

describe('R231 — Naročila CSV stolpec Pretekel rok (ENA resnica z zaslonom)', () => {
  it('downloadOrdersCsv dobi IZRECEN danas (determinizem — brez skrite ure, lib pogodba)', () => {
    const fn = oknoMed(material, 'function downloadOrdersCsv', '// R207 — stil statusnega filtra')
    expect(fn).toContain('(orders: MaterialOrder[], danas: Date)')
    // klicatelj poda polnoč useMemo (ISTI dan kot badge R229)
    expect(material).toContain('downloadOrdersCsv(orders, danasZamude)')
    expect(material).toContain('d.setHours(0, 0, 0, 0)')
  })

  it('CSV glava + vrstica: stolpec ZADNJI (analogija R226 Brez dobavitelja), VEDNO prisoten', () => {
    const fn = oknoMed(material, 'function downloadOrdersCsv', '// R207 — stil statusnega filtra')
    expect(fn).toContain("'Naročilo skupaj', 'Opombe', 'Pretekel rok']")
    // ENA resnica: ISTI lib klic kot badge na zaslonu (R229 vrstica 801)
    expect(fn).toContain("jeZamujenaDobava(o, danas) ? 'DA' : 'NE'")
    expect(material).toContain('{jeZamujenaDobava(order, danasZamude) && <BadgeZamujenaDobava />}')
  })

  it('kontrakt R140 nespremenjen: izvoz je VSA naročila (ne vidnaNarocila)', () => {
    const okno = oknoMed(material, '// R140 — izvoz naročil v CSV (pisarniški pregled).', '  return (')
    expect(okno).toContain('downloadOrdersCsv(orders, danasZamude)')
    expect(okno).not.toContain('downloadOrdersCsv(vidnaNarocila')
  })

  it('CSV celica ENA resnica z libom (živo prek jeZamujenaDobava — ne ločen izračun)', () => {
    // lib strogost (regresija R228): odprto + pretekel datum = DA (badge oz. CSV celica)
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: VCERAJ }, DANAS)).toBe(true)
    // zaprta stanja / manjkajoča obljuba NIKOLI DA — v zaslonu IN v CSV
    expect(jeZamujenaDobava({ status: 'DOBLJENO', datumDobave: VCERAJ }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: null }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'PREKlicANO', datumDobave: VCERAJ }, DANAS)).toBe(false)
  })

  it('CSV gumb: aria-label + title (a11y družina izvozov — vsi ostali izvozi ju imajo)', () => {
    expect(material).toContain('aria-label="Izvozi naročila kot CSV"')
    expect(material).toContain('title="Izvozi vsa naročila (neodvisno od statusnega filtra) kot CSV za Excel"')
  })
})

describe('R231 — [Mandatory] stil (P1-f): map-measure + measurements neutralne veje → žetoni', () => {
  it('map-measure: 0 stone (površine/besedila na žetonih — en razred obe temi)', () => {
    expect(mapMeasure).not.toMatch(/stone-[0-9]/)
    expect(mapMeasure).toContain('border border-border sm:h-[340px]')
    expect(mapMeasure).toContain('rounded-lg bg-muted p-3')
    expect(mapMeasure).toContain('font-medium tabular-nums text-roksal-ink')
  })

  it('measurements: neutralna veja verdicta + n/a pill na žetonih (sorojenci emerald/amber/red ostanejo semantični)', () => {
    expect(measurements).not.toMatch(/stone-[0-9]/)
    expect(measurements).toContain("verdict = { label: 'Ni uradnih meritev za primerjavo', cls: 'bg-muted text-muted-foreground border-border', icon: Info }")
    expect(measurements).toContain("? 'bg-muted text-muted-foreground'")
    // semantični sorojenci ostanejo (verdict emerald — barvna kodiranost)
    expect(measurements).toContain('bg-emerald-50 dark:bg-emerald-950/40')
  })

  it('0 novih hex v MOJIH spremembah (material CSV/gumb — žetoni, ne barvni literali)', () => {
    // map-measure in measurements vsebujeta PRESTOJEče hex-e (polilinije/
    // markerji zemljevida + AR vizualizacija — semantična podatkovna
    // vizualizacija, izven obsega r231; r231 spremembe so 1:1 zamenjave
    // stone → žetoni in ne dotaknejo nobene hex vrstice). Ključna trditev:
    // material-intelligence (moja glavna sprememba) ostane BREZ hex.
    const hexiMaterial = material.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    expect(hexiMaterial).toEqual([])
  })

  it('namerne izjeme ostanejo DOKUMENTIRANE: SEMANTIC materialne barve (ne stone dvojčki)', () => {
    // reference-gallery barColor: per-material barve (WPC amber, Inox/Alu
    // slate, Steklo cyan) — barvna KODIRANJA podatkov (legenda), pretvorba
    // v nevtralne žetone bi uničila ločljivost (r231 odločitev: izjema).
    expect(refGallery).toContain("case 'Inox': return 'bg-slate-400'")
    expect(refGallery).toContain("case 'Alu': return 'bg-slate-500'")
    // measurements material/ground palete — badge družina per material/tla
    expect(measurements).toContain("metal: 'bg-slate-100 dark:bg-slate-500/15")
    // R319: ALU vrstica se je preselila v measurements/shared.ts (pin shift)
    expect(measurementsShared).toContain("ALU: 'bg-slate-100 dark:bg-slate-500/15")
  })

  it('javni portali ostanejo izjeme (regresija r230 dokumentacije); cv-studio R232 konvertiran', () => {
    for (const rel of [
      'src/app/setup/setup-client.tsx',
      'src/app/aktivacija/[token]/activation-client.tsx',
    ]) {
      expect(beri(rel)).toMatch(/stone-[0-9]/) // še vedno na stone — namerne izjeme (r230)
    }
    // cv-studio NI več izjema — R232 žetoni (r232 test pina podrobnosti)
    expect(beri('src/components/roksal/cv-studio.tsx')).not.toMatch(/stone-[0-9]/)
  })
})

describe('R231 — [Mandatory] infra (P1-g): skupna E2E knjižnica', () => {
  const lib = 'scripts/e2e-lib.sh'
  const pot = join(process.cwd(), lib)

  it('e2e-lib.sh obstaja in zapre ponavljanje prijava → dispatch → vodič', () => {
    expect(existsSync(pot), `${lib} manjka`).toBe(true)
    const src = beri(lib)
    expect(src).toContain('eb_odpri_in_prijavi()')
    expect(src).toContain('eb_dispatch()')
    expect(src).toContain('eb_zapri_vodic()')
    expect(src).toContain('eb_pocakaj_na()')
  })

  it('IIFE lekcija (r225/r227) ZAPRTA v knjižnici — vsi predikati so klicani', () => {
    const src = beri(lib)
    // vsaka vrstica z LITERAL eval predikatom vsebuje IIFE zaključek `})()"`
    // (eb_pocakaj_na je parameterizirana indirekcija — klicatelj poda IIFE;
    // vrstični pregled, ker regex `[^\"]+` se utne na escape `\"` znotraj)
    const vrstice = src
      .split('\n')
      .filter((l) => l.includes('agent-browser eval') && !l.includes('$pred'))
    expect(vrstice.length).toBeGreaterThan(0)
    for (const l of vrstice) {
      expect(l, `predikat ni IIFE: ${l}`).toContain('})()"')
    }
  })
})
