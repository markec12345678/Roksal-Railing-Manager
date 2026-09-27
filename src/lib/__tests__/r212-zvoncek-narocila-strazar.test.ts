// R212 — zvonček/obvestilni center: aktivna naročila kot 6. signalna družina
// (P1-f iz R211 zaključka). Prej so aktivna naročila (OSNUTEK/POSLANO/POTRJENO)
// signalizirala LE na zavihku (R208 badge), Domov (R210 kartica) in pečatu
// (R211) — zvonček je ostal slep. Zdaj: EN združen digest iz ISTEGA vira
// (GET /api/material-orders — EN vir resnice), vidno LE ko aktivnih > 0
// (brez lažnega 0), fail-verbose R182 (403 = meja vloge tiho, ostalo vidno),
// navigacija prek obstoječega roksal:navigate { more: 'material' } vzorca.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(process.cwd(), 'src/components/roksal/notification-center.tsx'), 'utf8')
// Blok 6. vira (od R212 komentarja do vremenskega komentarja).
const blok = src.slice(
  src.indexOf('// 6) R212 — aktivna naročila'),
  src.indexOf('// 3) Vremensko opozorilo'),
)

describe('R212 — zvonček: aktivna naročila digest (6. signalna družina)', () => {
  it('EN vir resnice: ista ruta /api/material-orders kot Material → Naročila in R210 kartica', () => {
    expect(blok).toContain("fetch('/api/material-orders')")
  })

  it('izpeljanka filtrira TOČNO tri aktivne statuse (R208/R210 ogledalo — ENA semantika)', () => {
    expect(blok).toContain(
      "o.status === 'OSNUTEK' || o.status === 'POSLANO' || o.status === 'POTRJENO'",
    )
  })

  it('vidno LE ko aktivnih > 0 (brez lažnega 0, R208/R210 vzorec)', () => {
    expect(blok).toContain('if (aktivna.length > 0)')
  })

  it('naslov je ISTER kot R210 Domov kartica (ENA semantika čez signalce)', () => {
    expect(blok).toContain("title: 'Naročila, ki čakajo na dejanje',")
    expect(blok).toContain("meta: 'Pregled: Material → Naročila',")
  })

  it('statusi so dobesedne oznake chipov (R208) — determinizem, brez sklanjatev', () => {
    expect(blok).toContain("for (const status of ['OSNUTEK', 'POSLANO', 'POTRJENO'] as const)")
    expect(blok).toContain('if (n > 0) deli.push(`${status} ${n}`)')
    expect(blok).toContain("subtitle: `${deli.join(' · ')} — iz zadnjega nalaganja`,")
  })

  it('fail-verbose R182: non-403 neuspeh gre v vidno vrstico; 403 = meja vloge (tiho)', () => {
    expect(blok).toContain("neuspeliViri.push('naročila')")
    expect(blok).toContain('oRes.status !== 403')
  })

  it('id digesta je stalno določen (dedup zanesljiv)', () => {
    expect(blok).toContain("id: 'orders-active',")
    expect(blok).toContain("kind: 'order',")
  })

  it('navigacija: roksal:navigate { more: material, subTab: orders } (R206 lekcija — Material za Več sheetom; R213 direktno Naročila podzavihek)', () => {
    expect(src).toContain("new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'material', subTab: 'orders' } })")
  })

  it('KIND_STYLE: ShoppingCart + roksal-amber (ogledalo R210 kartice) — 0 novih hex', () => {
    expect(src).toContain("order: { icon: ShoppingCart, bg: 'bg-roksal-amber/15', fg: 'text-roksal-amber' },")
    expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('SheetDescription + iskreno prazno stanje omenjata naročila (brez lažnega vse-pod-nadzorom)', () => {
    expect(src).toContain('Nizka zaloga, današnje montaže, naročila, vreme, računi in poslana obvestila.')
    expect(src).toContain('Ni nizke zaloge, danes ni montaž, ni aktivnih naročil in vreme ne povzroča skrbi.')
  })

  it('regresija R200: more: ekipa navigacija + ack ostajata nedotaknjena', () => {
    expect(src).toContain("new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'ekipa' } })")
    expect(src).toContain('await openPersisted(n)')
  })

  it('regresija R182: pečat + viriNapaka mehanizma ostajata (EN vir napak)', () => {
    expect(src).toContain('{casOznaka(obvestilaOsvezitev)}')
    expect(src).toContain("setViriNapaka(`Nekateri viri niso bilo naloženi (${neuspeliViri.join(', ')}) — prikaz je lahko nepopoln.`)")
  })
})
