// R206 — ISKREN PREHOD POSLANO + NAROČILNICA IZ NAROČILA (stražar).
// ---------------------------------------------------------------------------
// R204 je odpravil izmišljeni toast 'obljuba o dostavi dobavitelju' (Zaloga);
// R205 je naročilnico naredil sledljivo (OSNUTEK); R206 zapre zadnjo povezavo
// iste družine v Material → Naročila:
//  (1) prehodni gumb OSNUTEK → POSLANO ne trdi več, da aplikacija pošilja
//      dokumente dobavitelju — novi naslov je OZNAČBA človeškega dejanja
//      ('Označi kot poslano') + iskren toast z razlago;
//  (2) vsako naročilo dobi gumb 'Naročilnica' — regeneracija dokumenta iz
//      SLEDLJIVIH postavk (lib buildNarocilnicaIzNarocila, brez vrednosti iz
//      UI), fail-verbose odložišče (vzorec R167/R203/R204/R205);
//  (3) R177 lucide pin ostane nedotaknjen (ClipboardList pred History).
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

describe('R206 stražar: iskren prehod POSLANO (stara oznaka gumba je GONE)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('stari gumb-aplikacija-pošilja je GONE (celotna datoteka)', () => {
    // 🔴 beseda je namerno odsotna tudi iz komentarjev runde (lekcija R204)
    expect(src).not.toContain('Po\u0161lji')
  })

  it('nov gumb je OZNAČBA človeškega dejanja + povezan na obstoječi PATCH prehod', () => {
    const okno = oknoMed(
      src,
      '{/* Status actions — R206: iskren gumb prehoda POSLANO',
      // R242: vrata zdaj po pravici — end-marker vključuje lahkoOdobri
      "{order.status === 'POSLANO' && lahkoOdobri && (",
    )
    expect(okno).toContain("handleOrderStatus(order.id, 'POSLANO')")
    expect(okno).toContain('Označi kot poslano')
    expect(okno).toContain('aplikacija ne pošilja dokumentov')
  })

  it('POTRJENO nespremenjen; DOBLJENO gre prek potrditvenega dialoga (R207 — edini prehod z resnično stransko resnico)', () => {
    const okno = oknoMed(
      src,
      // R242: vrata zdaj po pravici — start-marker vključuje lahkoOdobri
      "{order.status === 'POSLANO' && lahkoOdobri && (",
      '</CardContent>',
    )
    expect(okno).toContain("handleOrderStatus(order.id, 'POTRJENO')")
    expect(okno).toContain('Potrdi')
    // R207: DOBLJENO NE kliče PATCH takoj — odpre potrditveni dialog
    // (receiveOrder res popravi zalogo → postavke vidne PRED dejanjem)
    expect(okno).not.toContain("handleOrderStatus(order.id, 'DOBLJENO')")
    expect(okno).toContain('setReceiveDialogOrderId(order.id)')
    expect(okno).toContain('Dobljeno (v zalogo)')
    expect(okno).toContain('Prejem v zalogo — potrditev s prikazom postavk')
  })

  it('iskrni naslovi prehodov + razlaga za POSLANO (aplikacija ni kurir)', () => {
    const okno = oknoMed(
      src,
      'const handleOrderStatus = async (orderId: string, status: string) => {',
      '  // R206 — naročilnica iz naročila:',
    )
    expect(okno).toContain("POSLANO: 'Označeno kot poslano (status POSLANO)'")
    expect(okno).toContain("POTRJENO: 'Status → POTRJENO'")
    expect(okno).toContain("DOBLJENO: 'Dobljeno — material v zalogi'")
    expect(okno).toContain('Aplikacija ne pošilja dokumentov')
    // fail-verbose (R140) ostaja — R242: detail PRED error (R241 vzorec)
    expect(okno).toContain("data?.detail?.trim() || data?.error?.trim() || `HTTP ${res.status}`")
  })
})

describe('R206 stražar: naročilnica iz naročila (regeneracija dokumenta)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('kopirajNarocilnicoIzNarocila: lib + iskrena trditev + fail-verbose odložišče', () => {
    const okno = oknoMed(
      src,
      '  // R206 — naročilnica iz naročila: regeneracija dokumenta iz SLEDLJIVIH',
      '  // R140 — izvoz naročil v CSV (pisarniški pregled). R231 — podaja IZRECNO',
    )
    expect(okno).toContain('buildNarocilnicaIzNarocila(order, { now: new Date() })')
    expect(okno).toContain('navigator.clipboard.writeText(besedilo)')
    expect(okno).toContain('kopirana v odložišče')
    expect(okno).toContain('prilepi v e-pošto/SMS dobavitelju.')
    expect(okno).toContain("narociloPostavkaBeseda(order.items.length)")
    // fail-verbose odložišče (družina R167/R203/R204/R205)
    expect(okno).toContain("err.name === 'NotAllowedError'")
    expect(okno).toContain('Brskalnik je zavrnil dostop do odložišča (dovoljenje).')
    // fail-closed jedro pokvarjenega naročila → viden razlog
    expect(okno).toContain('Naročilnice ni mogoče sestaviti iz tega naročila')
  })

  it('gumb na vsakem naročilu: aria-label z dobaviteljem, ikona aria-hidden, focus ring', () => {
    const okno = oknoMed(
      src,
      '{/* Status actions — R206: iskren gumb prehoda POSLANO',
      '</CardContent>',
    )
    expect(okno).toContain('aria-label={`Kopiraj naročilnico naročila pri ${order.supplier.naziv} v odložišče`}')
    expect(okno).toContain('Naročilnica za dobavitelja iz postavk tega naročila — prilepi v e-pošto/SMS')
    expect(okno).toContain('<ClipboardList className="h-3 w-3" aria-hidden="true" />')
    expect(okno).toContain('void kopirajNarocilnicoIzNarocila(order)')
    expect(okno).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
  })

  it('lib uvozi (EN VIR dokumentov: zaloga-povzetek)', () => {
    expect(src).toContain("from '@/lib/zaloga-povzetek'")
    expect(src).toContain('buildNarocilnicaIzNarocila')
    expect(src).toContain('narociloPostavkaBeseda')
  })
})

describe('R206 stražar: R177 lucide pin', () => {
  it('ClipboardList je vstavljen pred pinano vrstico History (pin brez premika) — R208: XCircle tudi pred History', () => {
    const src = beri('src/components/roksal/material-intelligence-tab.tsx')
    // R235: FileText (PDF pill) za History — pin nadgrajen na nov rep;
    // R333: FileSpreadsheet (CSV pill 60. člen) za FileText — rep nadgrajen (vzorec R235)
    expect(src).toContain("  XCircle,\n  History,\n  FileText,\n  FileSpreadsheet,\n} from 'lucide-react'")
    expect(src.indexOf('ClipboardList')).toBeLessThan(src.indexOf('  History,\n  FileText,'))
  })
})
