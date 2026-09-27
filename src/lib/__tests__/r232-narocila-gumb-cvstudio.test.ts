// R232 — F1 (P1-c 'izvozi' družina): Material → Naročila CSV gumb VEDNO viden
// (družina vodja-CSV R228: izvozni gumb ne skriva praznega stanja — dokazljivo
// v prodi tudi pri 0 naročil; r232 prod-probe lekcija: r231 pričakovanje (a) je
// predpostavljalo vidnost, resnica je bila gumb v veji orders>0). Klik ostane
// fail-closed: 0 naročil → NIČ se ne izvozi (ni prazne datoteke — iskren toast
// namesto tihega gumba), nalaganje → onemogočen (ne izvozi NEpopolnega
// seznama sredi fetcha). Kontrakt R140 NESPREMENJEN (VSA naročila).
//
// + [Mandatory] stil (P1-f): cv-studio stone → žetoni (r231 ocena: lahko
//   žetoni brez izgube pomena — 12 mest; r230 izjeme-test posodobljen:
//   cv-studio NI več izjema, javni portali ostanejo). Aktivni bbox način na
//   roksal-navy (ISTA družina kot aktivni gumbi operativnega jedra).
//
// + [Mandatory] infra (P1-d): e2e-lib.sh dobi eb_csv_capture/eb_csv_reset
//   (createObjectURL patch se ponavlja od r226 — zdaj zaprt v knjižnici).
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
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

describe('R232 — Naročila CSV gumb VEDNO viden (izvozni gumb ne skriva praznega stanja)', () => {
  it('gumb je IZVEN veje orders>0: aria-label se pojavi PREJ kot prazno stanje (vrstni red vira)', () => {
    const aria = material.indexOf('aria-label="Izvozi naročila kot CSV"')
    const prazno = material.indexOf('Ni naročil. Pretvori BOM draft v naročilo.')
    expect(aria, 'gumb mora biti nad ternarijem (viden tudi pri 0 naročil)').toBeGreaterThan(-1)
    expect(prazno).toBeGreaterThan(-1)
    expect(aria).toBeLessThan(prazno)
  })

  it('točno EN gumb (premaknjen, ne podvojen — a11y in ENA resnica ostajata)', () => {
    const zadetki = material.match(/aria-label="Izvozi naročila kot CSV"/g) ?? []
    expect(zadetki.length).toBe(1)
    expect(material).toContain('title="Izvozi vsa naročila (neodvisno od statusnega filtra) kot CSV za Excel"')
  })

  it('nalaganje → onemogočen (ne izvozi NEpopolnega seznama sredi fetcha)', () => {
    const blok = oknoMed(material, 'onClick={handleOrdersCsv}', '</Button>')
    expect(blok).toContain('disabled={loading}')
  })

  it('fail-closed klik: loading → return; 0 naročil → iskren toast, NIČ se ne izvozi', () => {
    const fn = oknoMed(material, 'const handleOrdersCsv = () => {', 'const count = downloadOrdersCsv')
    expect(fn).toContain('if (loading) return')
    expect(fn).toContain('if (orders.length === 0)')
    expect(fn).toContain("'Ni naročil za izvoz'")
    // downloadOrdersCsv je dosegljiv LE za prazno vejo (po zgodnjem returnu)
    expect(fn.indexOf('downloadOrdersCsv')).toBe(-1)
  })

  it('kontrakt R140/R231 nespremenjen: izvoz VSA naročila z IZRECNO danasZamude', () => {
    expect(material).toContain('downloadOrdersCsv(orders, danasZamude)')
    expect(material).not.toContain('downloadOrdersCsv(vidnaNarocila')
    expect(material).toContain('jeZamujenaDobava(o, danas) ? \'DA\' : \'NE\'')
  })
})

describe('R232 — [Mandatory] stil (P1-f): cv-studio stone → žetoni (r231 ocena potrjena)', () => {
  it('cv-studio: 0 stone (vsa UI površina na žetonih — en razred obe temi)', () => {
    expect(cv).not.toMatch(/stone-[0-9]/)
  })

  it('STATE_BADGE nevtrna stanja na žetonih (PREDLOG text-roksal-ink, NEZNANO text-muted-foreground)', () => {
    expect(cv).toContain("PROPOSED: { label: 'PREDLOG', cls: 'border-border bg-muted text-roksal-ink' }")
    expect(cv).toContain("UNKNOWN: { label: 'NEZNANO', cls: 'border-border bg-muted text-muted-foreground' }")
    // semantični sorojenec POTRDITEV ostane amber (barvna kodiranost stanja)
    expect(cv).toContain("NEEDS_CONFIRMATION: { label: 'POTRDITEV', cls: 'border-amber-300 bg-amber-100 text-amber-800' }")
  })

  it('CapsBadge nevtralna veja na žetonih (variant preimenovan stone → neutral)', () => {
    expect(cv).toContain("const variant = ok === true ? 'emerald' : ok === false ? 'neutral' : 'amber'")
    expect(cv).toContain(": 'border-border bg-muted text-muted-foreground'")
  })

  it('aktivni bbox način na roksal-navy (ISTA družina kot aktivni gumbi jedra, NI novih hex)', () => {
    expect(cv).toContain("${clickMode === 'bbox' ? 'bg-roksal-navy text-white hover:bg-roksal-navy/90' : ''}")
  })

  it('žetonska badge družina (ročno/Analiza/popravki) + legenda besedilo na žetonih', () => {
    const badgeZeton = 'className="border-border bg-muted text-[9px] text-muted-foreground"'
    expect((cv.match(new RegExp(badgeZeton.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(cv).toContain('className="ml-auto border-border bg-muted text-[9px] text-muted-foreground"')
    expect(cv).toContain('<span className="text-muted-foreground">sivo</span>')
    expect(cv).toContain('className="min-h-[36px] border-border text-[11px] text-muted-foreground hover:bg-muted"')
  })

  it('r230/r231 izjeme-testi SINHRONIZIRANI: cv-studio NI več na seznamu izjem', () => {
    const r230 = beri('src/lib/__tests__/r230-domov-zamujene-zetoni.test.ts')
    const r231 = beri('src/lib/__tests__/r231-narocila-csv-pretekel.test.ts')
    // v izjemnem seznamu (for-loop) NE sme več biti cv-studio
    expect(r230).not.toContain("'src/components/roksal/cv-studio.tsx',\n    ]) {")
    expect(r231).not.toContain("'src/components/roksal/cv-studio.tsx',\n    ]) {")
    // portali ostanejo na obeh seznamih
    for (const t of [r230, r231]) {
      expect(t).toContain("'src/app/setup/setup-client.tsx'")
      expect(t).toContain("'src/app/aktivacija/[token]/activation-client.tsx'")
    }
  })
})

describe('R232 — [Mandatory] infra (P1-d): eb_csv_capture v skupni E2E knjižnici', () => {
  const pot = join(process.cwd(), 'scripts/e2e-lib.sh')

  it('eb_csv_capture + eb_csv_reset obstajata (createObjectURL patch od r226 zaprt v knjižnici)', () => {
    expect(existsSync(pot), 'scripts/e2e-lib.sh manjka').toBe(true)
    const src = beri('scripts/e2e-lib.sh')
    expect(src).toContain('eb_csv_capture()')
    expect(src).toContain('eb_csv_reset()')
    expect(src).toContain('URL.createObjectURL')
  })

  it('IIFE lekcija (r225/r227) ostaja ZAPRTA — novi helperji so klicani predikati', () => {
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
