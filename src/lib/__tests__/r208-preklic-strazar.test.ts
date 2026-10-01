// R208 — PREKLIC NAROČILA (stražar).
// ---------------------------------------------------------------------------
// Server (ORDER_TRANSITIONS) podpira PREKlicANO iz OSNUTEK/POSLANO/POTRJENO
// (DOBLJENO je ireverzibilen prejem; PREKlicANO je KONČNO stanje — brez
// izhodnih prehodov). UI ga NIKOLI ni izpostavil: edini pot do preklica je
// bil PATCH iz roke. R208 (družina R198/R207 — potrditveni dialog):
//  (1) kartica odpre dialog — PATCH gre ŠELE prek 'Potrdi preklic';
//  (2) iskren dialog: končno stanje (ni razveljavljivo) + aplikacija NE
//      obvesti dobavitelja (družina R204/R206 — brez obljub o pošiljanju);
//  (3) brez stranskih učinkov: zaloga NI spremenjena (toast to trdi);
//  (4) dvoklik zaščita (cancelSending) + fail-verbose (dialog ostane odprt).
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

describe('R208 stražar: gumb Prekliči odpre dialog (NE takoj PATCH)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('direkten PATCH PREKlicANO iz kartice je GONE (samo dialog pot)', () => {
    expect(src).not.toContain("handleOrderStatus(order.id, 'PREKlicANO')")
  })

  it('gumb povezan na dialog + title razlaga (končno stanje, dobavitelja obvestiš sam)', () => {
    const okno = oknoMed(
      src,
      '{/* R208 — preklic (končno stanje, brez stranskih učinkov):',
      '</CardContent>',
    )
    expect(okno).toContain('setCancelDialogOrderId(order.id)')
    expect(okno).toContain('Prekliči')
    expect(okno).toContain(
      'Preklic naročila — KONČNO stanje, ni razveljavljivo (dobavitelja obvestiš sam)',
    )
  })

  it('gumb za VSE tri preklicljive statuse (OSNUTEK/POSLANO/POTRJENO), NE za DOBLJENO/PREKlicANO', () => {
    const okno = oknoMed(
      src,
      '{/* R208 — preklic (končno stanje, brez stranskih učinkov):',
      '</CardContent>',
    )
    expect(okno).toContain(
      "(order.status === 'OSNUTEK' || order.status === 'POSLANO' || order.status === 'POTRJENO')",
    )
  })
})

describe('R208 stražar: potrditveni dialog preklica (družina R198/R207)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('dialog: naslov + opis z dobaviteljem + rdeči opozorilni okvir', () => {
    const okno = oknoMed(
      src,
      '{/* R208 — potrditveni dialog preklica (družina R198/R207): PREKlicANO je',
      'Potrdi preklic',
    )
    expect(okno).toContain('Preklic naročila')
    expect(okno).toContain(
      'bo označeno kot PREKlicANO.',
    )
    expect(okno).toContain('bg-red-50 px-3 py-2 dark:bg-red-950/40')
  })

  it('iskren opozorili: končno stanje + aplikacija ne obvesti dobavitelja', () => {
    const okno = oknoMed(
      src,
      '{/* R208 — potrditveni dialog preklica (družina R198/R207): PREKlicANO je',
      'Potrdi preklic',
    )
    expect(okno).toContain(
      'Preklic je končno stanje — nazaj v OSNUTEK, POSLANO ali POTRJENO ni mogoče.',
    )
    expect(okno).toContain(
      'Aplikacija ne obvesti dobavitelja — preklic sporoči sam (telefon/e-pošta).',
    )
  })

  it('povzetek naročila v dialogu (artikli · €) + brez stranskih učinkov vrstica', () => {
    const okno = oknoMed(
      src,
      '{cancelDialogOrder && (',
      '<DialogFooter className="gap-2">',
    )
    expect(okno).toContain('cancelDialogOrder.items.length')
    expect(okno).toContain('cancelDialogOrder.skupajCena.toFixed(0)')
    expect(okno).toContain('brez stranskih učinkov (zaloga ostane nespremenjena).')
  })

  it('Prekliči (dialog) NE pošlje nič — samo setCancelDialogOrderId(null)', () => {
    const dialog = oknoMed(src, 'open={cancelDialogOrderId !== null}', 'Potrdi preklic')
    const leva = oknoMed(dialog, '<DialogFooter className="gap-2">', 'variant="destructive"')
    expect(leva).toContain('setCancelDialogOrderId(null)')
    expect(leva).toContain('disabled={cancelSending}')
    expect(leva).not.toContain('handleOrderStatus')
  })

  it('Potrdi preklic: PATCH PREKlicANO prek dialoga + dvoklik zaščita (cancelSending)', () => {
    const okno = oknoMed(
      src,
      'variant="destructive"',
      '</DialogContent>\n      </Dialog>\n    </div>\n  )\n}',
    )
    expect(okno).toContain("void handleOrderStatus(cancelDialogOrder.id, 'PREKlicANO')")
    expect(okno).toContain('disabled={cancelSending || !cancelDialogOrder}')
  })

  it('onOpenChange vrata: med pošiljanjem dialog NE zapre (fail-verbose ostaja odprt)', () => {
    const okno = oknoMed(
      src,
      'open={cancelDialogOrderId !== null}',
      '<DialogContent className="sm:max-w-sm">',
    )
    expect(okno).toContain('if (!cancelSending && !o) setCancelDialogOrderId(null)')
  })

  it('handleOrderStatus: guard + sprostitev cancelSending (finally) + zaprtje dialoga ob uspehu', () => {
    const handler = oknoMed(
      src,
      'const handleOrderStatus = async (orderId: string, status: string) => {',
      '// R206 — naročilnica iz naročila',
    )
    expect(handler).toContain("if (status === 'PREKlicANO') setCancelSending(true)")
    expect(handler).toContain("if (status === 'PREKlicANO') setCancelDialogOrderId(null)")
    expect(handler).toContain("if (status === 'PREKlicANO') setCancelSending(false)")
  })

  it('iskren toast: naslov + opis BREZ stranskih učinkov (zaloga/dobavitelj)', () => {
    const handler = oknoMed(
      src,
      'const handleOrderStatus = async (orderId: string, status: string) => {',
      '// R206 — naročilnica iz naročila',
    )
    expect(handler).toContain("PREKlicANO: 'Označeno kot preklicano (status PREKlicANO)'")
    expect(handler).toContain(
      "'Brez stranskih učinkov — zaloga ni spremenjena, dobavitelj ni obveščen (sporoči sam).'",
    )
  })
})

describe('R208 stražar: PREKlicANO vidnost + stil', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')
  const route = beri('src/app/api/material-orders/route.ts')

  it('statusFilter + statusStevci vključujeta PREKlicANO (preklicano ostane vidno)', () => {
    expect(src).toContain("'DOBLJENO' | 'PREKlicANO'>('VSI')")
    expect(src).toContain("(['OSNUTEK', 'POSLANO', 'POTRJENO', 'DOBLJENO', 'PREKlicANO'] as const)")
  })

  it('značka PREKlicANO: rdeča družina z dark ogledali NA ISTI VRSTICI (r172/r166)', () => {
    const vrstica = src
      .split('\n')
      .find((l) => l.includes("order.status === 'PREKlicANO' ? 'bg-red-50"))
    expect(vrstica).toBeDefined()
    expect(vrstica).toContain('bg-red-50')
    expect(vrstica).toContain('dark:bg-red-950/40')
    expect(vrstica).toContain('text-red-700')
    expect(vrstica).toContain('dark:text-red-300')
    expect(vrstica).toContain('border-red-300')
    expect(vrstica).toContain('dark:border-red-800')
  })

  it('strežniški stroj: PREKlicANO dovoljen iz OSNUTEK/POSLANO/POTRJENO, končno stanje', () => {
    expect(route).toContain("OSNUTEK: ['POSLANO', 'POTRJENO', 'PREKlicANO']")
    expect(route).toContain("POSLANO: ['POTRJENO', 'DOBLJENO', 'PREKlicANO']")
    expect(route).toContain("POTRJENO: ['DOBLJENO', 'PREKlicANO']")
    expect(route).toContain('PREKlicANO: []')
    expect(route).toContain('DOBLJENO: []')
  })

  it('lucide: XCircle uvožen PRED pinano History (R177 pin brez premika)', () => {
    const uvozi = oknoMed(src, "} from '@/components/ui/select'", "} from 'lucide-react'")
    const xc = uvozi.indexOf('XCircle,')
    const hist = uvozi.indexOf('History,')
    expect(xc).toBeGreaterThanOrEqual(0)
    expect(hist).toBeGreaterThan(xc)
    // R235: FileText (PDF pill) za History — rep nadgrajen;
    // R333: FileSpreadsheet (CSV pill 60. člen) za FileText — rep nadgrajen (vzorec R235)
    expect(src).toMatch(/\n  History,\n  FileText,\n  FileSpreadsheet,\n} from 'lucide-react'/)
  })

  it('dekorativne ikone aria-hidden (družina R177)', () => {
    const dialog = oknoMed(
      src,
      '{/* R208 — potrditveni dialog preklica (družina R198/R207): PREKlicANO je',
      '</Dialog>\n    </div>\n  )\n}',
    )
    expect(dialog).toContain('<XCircle className="h-4 w-4 text-roksal-red" aria-hidden="true" />')
    expect(dialog).toContain('<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-red" aria-hidden="true" />')
  })
})
