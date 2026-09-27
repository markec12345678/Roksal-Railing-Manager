// R205 — OSNUTEK NAROČILA STRAŽAR: naročilnica postane SLEDLJIV zapis.
// ---------------------------------------------------------------------------
// R204 je naročilnico postavil v odložišče (iskren izhod). R205 dodaja drugi
// pravi izhod: shrani kot MaterialOrder (status OSNUTEK, strežnik ga vsili) —
// dobavitelja izbere uporabnik, količine = narociloKolicina (EN VIR RESNICE),
// BREZ vrednosti iz UI (strežnik vzame realno vrednost dobavitelja ali 0).
// Aplikacija trdi LE 'shranjen osnutek', NIKOLI 'poslano'. Ta stražar
// zagotavlja:
//  (1) POST telo: supplierId + items z narociloKolicina, BREZ vrednosti iz UI;
//  (2) fail-verbose z razlogom iz odgovora (vzorec R140/R163/R203/R204);
//  3) uspešen toast trdi LE 'OSNUTEK' + 'Nič še ni poslano dobavitelju.';
//  (4) openOsnutekDialog: iskren prazen seznam + WYSIWYG isti seznam kot R204;
//  (5) CSV priloga: narocilnicaCsvVrstice + glava (EN VIR RESNICE);
//  (6) dialog: R182 fail-verbose trojna veja dobaviteljev + a11y + pill družina;
//  (7) R177 lucide pin ostane nedotaknjen (FileDown alfabetsko pred History).
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

describe('R205 stražar: handleShraniOsnutek (POST telo + fail-verbose + iskren toast)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')
  const okno = oknoMed(
    src,
    '// R205 — shrani osnutek: POST /api/material-orders ustvari MaterialOrder s',
    '  // R205 — CSV priloga',
  )

  it('POST telo: supplierId + items z narociloKolicina (EN VIR), opombe pogojne', () => {
    expect(okno).toContain("method: 'POST'")
    expect(okno).toContain('supplierId: osnutekDobavitelj')
    expect(okno).toContain('kolicina: narociloKolicina(a)')
    expect(okno).toContain('osnutekOpombe.trim() ? { opombe: osnutekOpombe.trim() } : {}')
  })

  it('BREZ vrednosti iz UI v POST telesu (demo ocene ne gredo v naročilo)', () => {
    expect(okno).not.toContain('cena:')
    expect(okno).not.toContain('cenaEur')
    expect(okno).not.toContain('getEstimatedPrice')
  })

  it('fail-verbose z razlogom iz odgovora (vzorec R140/R163/R203/R204)', () => {
    expect(okno).toContain('res.json().catch(() => null)')
    expect(okno).toContain("data?.error?.trim() || `Napaka pri shranjevanju osnutka (${res.status})`")
    expect(okno).toContain("'Napaka pri povezavi s strežnikom'")
  })

  it('uspešen toast trdi LE OSNUTEK + Material → Naročila + Nič še ni poslano', () => {
    expect(okno).toContain("toast.success('Osnutek naročila shranjen (status OSNUTEK)'")
    expect(okno).toContain('najdeš ga v Material → Naročila. Nič še ni poslano dobavitelju.')
    // po uspehu dialog zaprt + stanje počiščeno (nič ostankov)
    expect(okno).toContain('setOsnutekOpen(false)')
    expect(okno).toContain("setOsnutekDobavitelj('')")
  })

  it('začitna zaščita: brez dobavitelja ALI brez artiklov → viden razlog', () => {
    expect(okno).toContain("'Izberite dobavitelja za osnutek naročila.'")
    expect(okno).toContain('setOsnutekSubmitting(true)')
    expect(okno).toContain('setOsnutekSubmitting(false)')
  })
})

describe('R205 stražar: openOsnutekDialog (iskren prazen seznam + WYSIWYG)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')
  const okno = oknoMed(
    src,
    '// R205 — odpri dialog osnutka: isti WYSIWYG seznam vidnih artiklov pod',
    '// R205 — shrani osnutek: POST /api/material-orders ustvari MaterialOrder s',
  )

  it('prazen seznam → iskren toast, dialog se NE odpre (nič izmišljenega)', () => {
    expect(okno).toContain('Ni artiklov pod minimalno zalogo — nič za naročilo.')
    expect(okno).toContain('return')
  })

  it('WYSIWYG: isti seznam vidnih artiklov pod minimumom kot naročilnica R204', () => {
    expect(okno).toContain('filtered.filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga)')
    expect(okno).toContain('setOsnutekArtikli(podMin)')
    expect(okno).toContain('setOsnutekOpen(true)')
  })
})

describe('R205 stražar: CSV priloga (EN VIR RESNICE)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')
  const okno = oknoMed(
    src,
    '// R205 — CSV priloga: ista vsebina kot odložišče R204 v tabelarni obliki',
    'const selectedItem = inventory.find',
  )

  it('prenos prek narocilnicaCsvVrstice + določena glava (SI Excel pogodba)', () => {
    expect(okno).toContain('narocilnicaCsvVrstice(osnutekArtikli)')
    expect(okno).toContain("`narocilnica-${todayStamp()}.csv`")
    expect(okno).toContain("['Šifra', 'Naziv', 'Enota', 'Zaloga', 'Min. zaloga', 'Naroči']")
  })

  it('iskren prazen seznam + uspešen toast s sklanjatvijo', () => {
    expect(okno).toContain('Ni artiklov pod minimalno zalogo — nič za naročilo.')
    expect(okno).toContain('Naročilnica CSV prenesena —')
    expect(okno).toContain('zalogaPovzetekBeseda(osnutekArtikli.length)')
  })
})

describe('R205 stražar: dialog (a11y + R182 trojna veja + pill družina)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')
  const okno = oknoMed(
    src,
    '{/* R205 — osnutek naročila dialog (družina premik-dialoga: tokeni, 0 novih',
    '// R152: demoInventory IZBRISAN',
  )

  it('gumbi nosita točna aria-labela; ikone aria-hidden', () => {
    // glavni gumb (glava zavihka — svoje okno)
    const gumb = oknoMed(
      src,
      '{/* R205 — osnutek naročila: naročilnica vidnih artiklov pod minimumom',
      'aria-label="Izvozi vidno zalogo kot CSV"',
    )
    expect(gumb).toContain('aria-label="Shrani naročilnico vidnih artiklov kot osnutek naročila"')
    expect(gumb).toContain('Shrani naročilnico (vidni artikli pod minimumom) kot osnutek naročila — Material → Naročila')
    expect(gumb).toContain('<FileDown className="h-3.5 w-3.5" aria-hidden="true" />')
    // dialog footer: CSV priloga + submit
    expect(okno).toContain('aria-label="Prenesi naročilnico vidnih artiklov kot CSV"')
    expect(okno).toContain('<Download className="h-4 w-4" aria-hidden="true" />')
    expect(okno).toContain('<FileDown className="mr-2 h-4 w-4" aria-hidden="true" />')
  })

  it('dobavitelji: napaka (role=alert + Poskusi znova) / iskreno prazno / seznam', () => {
    expect(okno).toContain('role="alert"')
    expect(okno).toContain('Poskusi znova')
    expect(okno).toContain('Ni dobaviteljev — najprej dodaj dobavitelja (Material → Dobavitelji).')
    expect(okno).toContain("dobaviteljiStanje === 'nalagam'")
    expect(okno).toContain('Nalagam dobavitelje…')
  })

  it('submit onemogočen brez dobavitelja (fail-closed UI) + focus ringi', () => {
    expect(okno).toContain(
      "osnutekSubmitting || !osnutekDobavitelj || dobaviteljiStanje !== 'ok' || dobavitelji.length === 0",
    )
    expect(okno).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
    // pregled artiklov = WYSIWYG z EN VIR količino
    expect(okno).toContain('naroči {narociloKolicina(a)} {a.enota}')
    // dialog opis je iskren: status OSNUTEK + nič še poslano
    expect(okno).toContain('Nič še ni poslano dobavitelju.')
  })

  it('dobavitelji loader: fail-verbose tri-veja (R182 vzorec)', () => {
    const loader = oknoMed(
      src,
      '// R205 — naloziDobavitelje: fail-verbose trojna veja (vzorec R182 material-',
      'async function handleMovement()',
    )
    expect(loader).toContain("fetch('/api/suppliers')")
    expect(loader).toContain('Dobavitelje ni bilo mogoče naložiti (napaka ')
    expect(loader).toContain('Dobavitelje ni bilo mogoče naložiti — preverite povezavo.')
    expect(loader).toContain("setDobaviteljiStanje('ok')")
    expect(loader).toContain('if (osnutekOpen) void naloziDobavitelje()')
  })
})

describe('R205 stražar: R177 lucide pin + import hijena', () => {
  it('FileDown je vstavljen ALFABETIČNO pred pinano vrstico History (pin brez premika)', () => {
    const src = beri('src/components/roksal/inventory-tab.tsx')
    expect(src).toContain("  ClipboardList,\n  FileDown,\n  History,\n} from 'lucide-react'")
    expect(src.indexOf('FileDown')).toBeLessThan(src.indexOf('  History,\n}'))
  })

  it('lib uvoz vsebuje nove EN VIR izvoze (narocilnicaCsvVrstice + narociloKolicina)', () => {
    const src = beri('src/components/roksal/inventory-tab.tsx')
    expect(src).toContain("from '@/lib/zaloga-povzetek'")
    expect(src).toContain('narocilnicaCsvVrstice')
    expect(src).toContain('narociloKolicina')
  })
})
