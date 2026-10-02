// R207 — STATUSNI FILTER NAROČIL (stražar).
// ---------------------------------------------------------------------------
// Naročila so od R140 prikazana kot gol seznam — ko jih je več, pisarna išče
// OSNUTKE/POSLANA/POTRJENA/DOBLJENA ročno. R207 doda pill filter (družina
// R136/R204/R206) z števci iz REALNIH naročil (izpeljanka, EN vir resnice —
// R201 vzorec) + ISKREN filter-prazen stanj (R202 družina: prazno ZARADI
// filtra ≠ res prazno). CSV kontrakt R140 ostane VSA naročila (determinizem,
// brez prikrite vezave na filter).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')

const beri = (rel: string): string => readFileSync(join(ROOT, rel), 'utf-8')

/** Okno vrstic med dvema sidroma (vključno) — točna lokalizacija funkcije. */
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  expect(a).toBeGreaterThanOrEqual(0)
  const b = src.indexOf(do_, a)
  expect(b).toBeGreaterThan(a)
  return src.slice(a, b)
}

describe('R207 stražar: izpeljanke filtra (EN vir resnice)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('statusStevci: števci iz REALNIH naročil, samo obstoječi statusi', () => {
    const okno = oknoMed(
      src,
      '// R207 — izpeljanke statusnega filtra (EN vir resnice, izpeljanka R201 vzorec):',
      'const receiveDialogOrder =',
    )
    expect(okno).toContain("(['OSNUTEK', 'POSLANO', 'POTRJENO', 'DOBLJENO', 'PREKlicANO'] as const)")
    expect(okno).toContain('orders.filter((o) => o.status === s).length')
    expect(okno).toContain('.filter(({ n }) => n > 0)')
  })

  it('vidnaNarocila: VSI = vse, sicer filtrirano (izpeljanka, ne kopija)', () => {
    const okno = oknoMed(
      src,
      '// R207 — izpeljanke statusnega filtra (EN vir resnice, izpeljanka R201 vzorec):',
      'const receiveDialogOrder =',
    )
    expect(okno).toContain("statusFilter === 'VSI' ? orders : orders.filter((o) => o.status === statusFilter)")
  })

  it('stanje filtra + dialog stanja deklarirana (statusFilter/receiveDialogOrderId/receiveSending)', () => {
    const okno = oknoMed(
      src,
      '// R207 — statusni filter (pill družina) + potrditveni dialog prejema',
      'const { toast } = useToast()',
    )
    expect(okno).toContain("useState<'VSI' | 'OSNUTEK' | 'POSLANO' | 'POTRJENO' | 'DOBLJENO' | 'PREKlicANO'>('VSI')")
    expect(okno).toContain('useState<string | null>(null)')
    expect(okno).toContain('useState(false)')
  })
})

describe('R207 stražar: pill filter (družina R136/R204/R206)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('chipCls: pill stil z focus ringom, aktiven navy, neaktiven muted; 0 novih hex', () => {
    const okno = oknoMed(
      src,
      '// R207 — stil statusnega filtra (pill družina R136/R204/R206; 0 novih hex,',
      'export function MaterialIntelligenceTab',
    )
    expect(okno).toContain('rounded-full')
    // stale pin shiftan val 49 (R366, precedens R334/R355–R365): chipCls
    // ring-offset-1→2 normalizacija (LEKCIJA R346 kanon — val 43–48 družinski
    // standard; precedens val 44 opomnik PDF / val 47 status cikel chip).
    expect(okno).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')
    expect(okno).toContain('border-roksal-navy bg-roksal-navy text-white')
    expect(okno).toContain('border-border bg-background text-muted-foreground')
    expect(okno).toContain('tabular-nums')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('chips: role=group + aria-pressed + števci iz realnih naročil', () => {
    const okno = oknoMed(
      src,
      '{/* R207 — statusni filter (pill družina R136/R204/R206): števci iz',
      "{vidnaNarocila.length === 0 && statusFilter !== 'VSI' ? (",
    )
    expect(okno).toContain('role="group"')
    expect(okno).toContain('aria-label="Filter naročil po statusu"')
    expect(okno).toContain('aria-pressed={statusFilter === \'VSI\'}')
    expect(okno).toContain('aria-pressed={statusFilter === status}')
    expect(okno).toContain('Vsi ({orders.length})')
    expect(okno).toContain('{status} ({n})')
    // chips samo ko obstajajo statusi (brez praznih skupin)
    expect(okno).toContain('statusStevci.length > 0 && (')
  })

  it('iskren filter-prazen (R202 družina): razlog + izhod, ne laž o bazi', () => {
    const okno = oknoMed(
      src,
      "{vidnaNarocila.length === 0 && statusFilter !== 'VSI' ? (",
      ') : vidnaNarocila.map((order) => {',
    )
    expect(okno).toContain('Ni naročil s statusom {statusFilter}.')
    expect(okno).toContain('Izberi drug status ali prikaži Vse.')
  })
})

describe('R207 stražar: CSV kontrakt R140 nespremenjen', () => {
  it('handleOrdersCsv ostaja VSA naročila (ne vidnaNarocila) — determinizem', () => {
    const src = beri('src/components/roksal/material-intelligence-tab.tsx')
    const okno = oknoMed(
      src,
      '// R140 — izvoz naročil v CSV (pisarniški pregled).',
      '  return (',
    )
    // R231 sinhronizacija: downloadOrdersCsv dobi IZRECEN danas (polnoč —
    // ENA resnica za zaslon IN izvoz); kontrakt VSA naročila NESPREMENJEN.
    expect(okno).toContain('downloadOrdersCsv(orders, danasZamude)')
    expect(okno).not.toContain('downloadOrdersCsv(vidnaNarocila')
  })

  it('res-prazno stanje ostane (ločeno od filter-praznega)', () => {
    const src = beri('src/components/roksal/material-intelligence-tab.tsx')
    expect(src).toContain('Ni naročil. Pretvori BOM draft v naročilo.')
    // R182 prebitnica ostane: vir padel → brez lažnega praznega stanja
    expect(src).toMatch(/orders\.length === 0 \? \(\s*\n\s*\/\/ R182[^\n]*\n\s*viriNapaka \? null : \(/)
  })
})
