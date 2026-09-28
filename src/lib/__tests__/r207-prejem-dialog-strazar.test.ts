// R207 — POTRDITVENI DIALOG PREJEMA (stražar).
// ---------------------------------------------------------------------------
// DOBLJENO je EDINI prehod naročila z resnično stransko resnico: receiveOrder
// (src/lib/inventory.ts) res popravi zalogo — atomic guard (updateMany WHERE
// NOT status DOBLJENO) ga dela idempotentnega (alreadyReceived). Prej je gumb
// 'Dobljeno (v zalogo)' PATCHAL TAKOJ (brez pregleda, kaj bo prejeto) in UI ni
// uporabljal alreadyReceived (dvojni klik bi lažno trdil 'material v zalogi'
// — družina R204 brez izmišljenih uspehov). R207:
//  (1) gumb odpre potrditveni dialog (družina R198, password-dialog vzorec) —
//      postavke VIDNE pred dejanjem, Prekliči NE pošlje nič;
//  (2) alreadyReceived=true → iskren toast 'že prejeto — zaloga ni podvojena';
//  (3) fail-verbose (R140): napaka pusti dialog odprt, razlog viden.
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

describe('R207 stražar: gumb DOBLJENO odpre dialog (NE takoj PATCH)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('stari takojšnji PATCH klic je GONE iz kartice', () => {
    expect(src).not.toContain("handleOrderStatus(order.id, 'DOBLJENO')")
  })

  it('gumb povezan na dialog + title razlaga', () => {
    const okno = oknoMed(
      src,
      "{order.status === 'POTRJENO' && (",
      '</CardContent>',
    )
    expect(okno).toContain('setReceiveDialogOrderId(order.id)')
    expect(okno).toContain('Dobljeno (v zalogo)')
    expect(okno).toContain('Prejem v zalogo — potrditev s prikazom postavk')
  })
})

describe('R207 stražar: potrditveni dialog prejema (družina R198)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('dialog: naslov + opis z dobaviteljem + amber idempotenca vrstica', () => {
    const okno = oknoMed(
      src,
      '{/* R207 — potrditveni dialog prejema (družina R198, password-dialog',
      '</Dialog>',
    )
    expect(okno).toContain('Prejem materiala v zalogo')
    expect(okno).toContain('Naročilo pri ${receiveDialogOrder.supplier.naziv} bo označeno kot DOBLJENO.')
    expect(okno).toContain('bg-roksal-amber/10')
    expect(okno).toContain('Zaloga se bo povečala za prikazane količine.')
    expect(okno).toContain('Prejem je idempotenten — če je bilo naročilo že prejeto, se zaloga ne podvoji.')
  })

  it('postavke VIDNE pred potrditvijo (aria + tabular-nums + truncate)', () => {
    const okno = oknoMed(
      src,
      '{/* R207 — potrditveni dialog prejema (družina R198, password-dialog',
      '</Dialog>',
    )
    expect(okno).toContain('aria-label="Postavke za prejem v zalogo"')
    expect(okno).toContain('receiveDialogOrder.items.map')
    expect(okno).toContain('{item.kolicina} {item.enota}')
    expect(okno).toContain('tabular-nums')
  })

  it('Potrdi prejem → handleOrderStatus z naročilovim id; sending stanje zakleni', () => {
    const okno = oknoMed(
      src,
      '{/* R207 — potrditveni dialog prejema (družina R198, password-dialog',
      '</Dialog>',
    )
    expect(okno).toContain("handleOrderStatus(receiveDialogOrder.id, 'DOBLJENO')")
    expect(okno).toContain('disabled={receiveSending || !receiveDialogOrder}')
    expect(okno).toContain('receiveSending ? (')
    expect(okno).toContain('Potrdi prejem')
    // Prekliči NE pošlje nič (samo zapre) + sending zakleni
    expect(okno).toContain('onClick={() => setReceiveDialogOrderId(null)}')
    expect(okno).toContain('disabled={receiveSending}')
    // onOpenChange: med pošiljanjem zapiranje blokirano (R198 družina)
    expect(okno).toContain('if (!receiveSending && !o) setReceiveDialogOrderId(null)')
  })

  it('stil dialoga: focus ringi ×oba gumba, ikone aria-hidden, 0 novih hex', () => {
    const okno = oknoMed(
      src,
      '{/* R207 — potrditveni dialog prejema (družina R198, password-dialog',
      '</Dialog>',
    )
    const ringi = okno.match(/focus-visible:ring-2 focus-visible:ring-roksal-navy\/40/g) ?? []
    expect(ringi.length).toBeGreaterThanOrEqual(2)
    expect(okno).toContain('aria-hidden="true"')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R207 stražar: iskren alreadyReceived + opis DOBLJENO toasta', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('alreadyReceived=true → iskren toast (zaloga NI podvojena)', () => {
    const okno = oknoMed(
      src,
      'const handleOrderStatus = async (orderId: string, status: string) => {',
      '  // R206 — naročilnica iz naročila:',
    )
    expect(okno).toContain("alreadyReceived?: boolean")
    expect(okno).toContain("status === 'DOBLJENO' && data?.alreadyReceived")
    expect(okno).toContain("'Naročilo je bilo že prejeto'")
    expect(okno).toContain('Zaloga ni bila podvojena (idempotenten prejem).')
  })

  it('uspešen prvi prejem: naslov R206 ostaja + nov opis zaloge', () => {
    const okno = oknoMed(
      src,
      'const handleOrderStatus = async (orderId: string, status: string) => {',
      '  // R206 — naročilnica iz naročila:',
    )
    expect(okno).toContain("DOBLJENO: 'Dobljeno — material v zalogi'")
    expect(okno).toContain("'Zaloga je posodobljena.'")
    // uspeh zapre dialog; fail-verbose pusti odprt (razlog viden)
    expect(okno).toContain("if (status === 'DOBLJENO') setReceiveDialogOrderId(null)")
    expect(okno).toContain("data?.error ?? `HTTP ${res.status}`")
    // receiving stanje sproščeno v finally (tudi ob napaki)
    expect(okno).toContain("if (status === 'DOBLJENO') setReceiveSending(false)")
  })
})

describe('R207 stražar: lucide pin + struktura', () => {
  it('R177 lucide pin ostaja (ClipboardList pred History) — R208: XCircle tudi pred History', () => {
    const src = beri('src/components/roksal/material-intelligence-tab.tsx')
    expect(src).toContain("  XCircle,\n  History,\n  FileText,\n} from 'lucide-react'") // R235: FileText (PDF pill) za History — pin nadgrajen na nov rep
    expect(src.indexOf('ClipboardList')).toBeLessThan(src.indexOf('  History,\n  FileText,'))
  })

  it('dialog uporablja OBSTOJEČE ikone (Package/Loader2/CheckCircle2/AlertTriangle) — brez novih uvozov', () => {
    const src = beri('src/components/roksal/material-intelligence-tab.tsx')
    const uvozi = src.slice(src.indexOf("from 'lucide-react'"))
    for (const ikona of ['Package', 'Loader2', 'CheckCircle2', 'AlertTriangle']) {
      expect(uvozi).toContain(ikona)
    }
  })
})
