// R233 — F1 (P1-c 'izvozi' družina): Material → Dobavitelji CSV izvoz
// (edini vir v Materialu brez izvoza po R231; ENA resnica: ISTI podatki kot
// kartice — status 'Aktiven/Neaktiven' = ISTA resnica kot pika + title R144,
// _count števec = ISTA resnica kot vrstica 'N cen · M naročil'). Gumb VEDNO
// viden + fail-closed klik (R232 vzorec: 0 dobaviteljev → iskren toast, nič
// se ne izvozi; nalaganje → onemogočen). Manjkajoči _count/kontakt = PRAZNE
// celice — NIKOLI izmišljen 0 (fail-closed, R227 vzorec).
//
// + [Mandatory] stil (P1-f): izjeme-test dopolnjen do POPOLNOSTI —
//   (a) cv-studio canvas hexi = SEMANTIČNA podatkovna vizualizacija
//       (markerji/polilinije/segmenti — ločljivost zaznav, r231 vzorec
//       reference-gallery; UI površine ISTEGA fileja so že r232 žetoni),
//   (b) javni portal m/[token] (merilna povezava) + aktivacija page = pišejo
//       lastno estetiko (r230 jih je dokumentiral v prozi — r233 jih pina
//       v testu, izjeme-map zaokrožena).
//
// + [Mandatory] infra (P1-d): e2e-lib.sh dobi eb_klik_gumb (klik po
//   aria-label; ponavlja se od r226; Radix triggerje NE pokriva — r199/r200).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const material = beri('src/components/roksal/material-intelligence-tab.tsx')
const cv = beri('src/components/roksal/cv-studio.tsx')

// okno med dvema markerjema (r207 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

describe('R233 — Dobavitelji CSV izvoz (izvozi družina — edini vir brez izvoza)', () => {
  it('downloadSuppliersCsv: ENA resnica — status ISTI kot pika/title (Aktiven/Neaktiven)', () => {
    const fn = oknoMed(material, 'function downloadSuppliersCsv', '// R207 — stil statusnega filtra')
    // R260 premik pina: seg pride IZRECEN (segmentacija — pogodba kot danas)
    expect(fn).toContain('(suppliers: Supplier[], seg: DobaviteljiSegmentacija)')
    expect(fn).toContain("s.aktivna ? 'Aktiven' : 'Neaktiven'")
  })

  it('fail-closed celice: manjkajoči _count = PRAZNA celica (nikoli izmišljen 0 — R227 vzorec)', () => {
    const fn = oknoMed(material, 'function downloadSuppliersCsv', '// R207 — stil statusnega filtra')
    // števci kot String (celo števila = "1", ne "1,00" — R136 vejica je za cene)
    expect(fn).toContain("s._count ? String(s._count.materialPrices) : ''")
    expect(fn).toContain("s._count ? String(s._count.orders) : ''")
    expect(fn).toContain('String(s.dobavniRok)')
    expect(fn).toContain("s.kontakt ?? ''")
  })

  it('CSV glava (SI, točke ISTE kot kartica): Naziv … Št. naročil + ime Dobavitelji-stamp.csv', () => {
    const fn = oknoMed(material, 'function downloadSuppliersCsv', '// R207 — stil statusnega filtra')
    // R260 premik pina: 9 → 11 stolpcev (append-only, R232 'Pretekel rok'
    // vzorec — + 'Najhitrejši rok' + 'Največji popust'; stolpci 1–9 kontrakt
    // R233 dobesedno NESPREMENJENI, preverjeni spodaj po posameznih delih).
    expect(fn).toContain("['Naziv', 'Status', 'Kontakt', 'Telefon', 'Email', 'Dobavni rok (dni)', 'Popust (%)', 'Št. cen', 'Št. naročil', 'Najhitrejši rok', 'Največji popust']")
    // kontrakt R233 — prvih 9 stolpcev ISTI vrstni red (zgodovinska resnica)
    expect(fn).toContain("'Naziv', 'Status', 'Kontakt', 'Telefon', 'Email', 'Dobavni rok (dni)', 'Popust (%)', 'Št. cen', 'Št. naročil'")
    expect(fn).toContain('`Dobavitelji-${todayStamp()}.csv`')
  })

  it('gumb VEDNO viden (nad praznim stanjem) + a11y družina (aria-label + title)', () => {
    const aria = material.indexOf('aria-label="Izvozi dobavitelje kot CSV"')
    const prazno = material.indexOf('Ni dobaviteljev. Dodaj prvega.')
    expect(aria).toBeGreaterThan(-1)
    expect(prazno).toBeGreaterThan(-1)
    expect(aria).toBeLessThan(prazno)
    expect(material).toContain('title="Izvozi vse dobavitelje kot CSV za Excel"')
    // točno EN tak gumb (premaknjen, ne podvojen)
    expect((material.match(/aria-label="Izvozi dobavitelje kot CSV"/g) ?? []).length).toBe(1)
  })

  it('fail-closed klik: loading → return; 0 dobaviteljev → iskren toast, NIČ se ne izvozi', () => {
    const fn = oknoMed(material, 'const handleSuppliersCsv = () => {', 'const count = downloadSuppliersCsv')
    expect(fn).toContain('if (loading) return')
    expect(fn).toContain('if (suppliers.length === 0)')
    expect(fn).toContain("'Ni dobaviteljev za izvoz'")
    expect(fn.indexOf('downloadSuppliersCsv')).toBe(-1)
    const blok = oknoMed(material, 'onClick={handleSuppliersCsv}', '</Button>')
    expect(blok).toContain('disabled={loading}')
  })
})

describe('R233 — [Mandatory] stil (P1-f): izjeme-map dopolnjena do popolnosti', () => {
  it('cv-studio canvas hexi = DOKUMENTIRANA izjema: semantična podatkovna vizualizacija (r231 vzorec)', () => {
    // 14 unikatnih hex — markerji/polilinije/segmenti zaznav (ločljivost
    // legende); UI površine ISTEGA fileja so že r232 žetoni (0 stone).
    expect(cv).not.toMatch(/stone-[0-9]/)
    const hexi = [...new Set(cv.match(/#[0-9a-fA-F]{6}\b/g) ?? [])]
    expect(hexi.length).toBeGreaterThanOrEqual(10)
    // semantične družine (emerald/teal = ograja/rob/stebri, rdeča = ovira,
    // oranžno = kotniki — ISTA legenda kot besedilna v UI)
    for (const h of ['#10b981', '#14b8a6', '#dc2626', '#ea580c']) {
      expect(cv).toContain(h)
    }
  })

  it('javni portal m/[token] + aktivacija page = dokumentirane izjeme (r230 proza → r233 pin)', () => {
    // merilna povezava (public) ima lastno estetiko — NI del app-lupine
    for (const rel of [
      'src/app/m/[token]/measure-client.tsx',
      'src/app/m/[token]/page.tsx',
      'src/app/m/[token]/measure-lazy.tsx',
      'src/app/aktivacija/[token]/page.tsx',
    ]) {
      expect(beri(rel)).toMatch(/stone-[0-9]/) // še vedno na stone — namerne izjeme
    }
  })

  it('app-lupina ostaja 0 stone (regresija R229–R232 konvergencе)', () => {
    for (const rel of [
      'src/components/roksal/material-intelligence-tab.tsx',
      'src/components/roksal/map-measure.tsx',
      'src/components/roksal/measurements-tab.tsx',
      'src/components/roksal/punch-list.tsx',
      'src/components/roksal/deal-pipeline.tsx',
    ]) {
      expect(beri(rel)).not.toMatch(/stone-[0-9]/)
    }
  })
})

describe('R233 — [Mandatory] infra (P1-d): eb_klik_gumb v skupni E2E knjižnici', () => {
  it('eb_klik_gumb obstaja (klik po aria-label; Radix triggerji izrecno izven obsega)', () => {
    const src = beri('scripts/e2e-lib.sh')
    expect(src).toContain('eb_klik_gumb()')
    expect(src).toContain("button[aria-label=\\\"$aria\\\"]")
  })

  it('IIFE lekcija (r225/r227) ostaja ZAPRTA — vsi literalni predikati so klicani', () => {
    const src = beri('scripts/e2e-lib.sh')
    const vrstice = src
      .split('\n')
      .filter((l) => l.includes('agent-browser eval') && !l.includes('$pred'))
    expect(vrstice.length).toBeGreaterThan(0)
    for (const l of vrstice) {
      expect(l, `predikat ni IIFE: ${l}`).toContain('})()"')
    }
  })
})
