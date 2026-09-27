// R210 — Domov: kartica 'Naročila, ki čakajo na dejanje' (družina Low Stock
// Alert + R202 iskreni stolpci). Izpeljanka iz REALNIH naročil (EN vir
// resnice — ista ruta kot Material → Naročila), vidna LE ko aktivnih > 0
// (brez lažnega 0), nalagalna napaka je svoja fail-verbose veja.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const domov = readFileSync(join(root, 'src/components/roksal/dashboard-tab.tsx'), 'utf8')
// Blok nove kartice: od R210 komentarja do Activity Timeline.
const blok = domov.slice(
  domov.indexOf('R210 — Naročila, ki čakajo'),
  domov.indexOf('Activity Timeline'),
)

describe('R210 — Domov: naročila, ki čakajo na dejanje (iskra resnice)', () => {
  it('izpeljanka filtrira TOČNO tri aktivne statuse (R208 ogledalo — EN semantika)', () => {
    expect(domov).toContain(
      "o.status === 'OSNUTEK' || o.status === 'POSLANO' || o.status === 'POTRJENO'",
    )
  })

  it('kartica viden LE ko aktivnih > 0 (brez lažnega 0, R208 vzorec)', () => {
    expect(domov).toContain('aktivnaNarocilaDomov > 0 ?')
  })

  it('iskrena svežina: "iz zadnjega nalaganja" — brez dodatnih requestov (R182 semantika)', () => {
    expect(blok).toContain('iz zadnjega nalaganja')
  })

  it('fail-verbose: nalagalna napaka je VIDNA veja z Poskusi znova (družina R203)', () => {
    expect(domov).toContain('Naročil ni bilo mogoče naložiti')
    expect(domov).toContain('narocilaError')
    expect(domov).toContain('role="alert"')
    expect(domov).toContain('void fetchNarocila()')
  })

  it('fetchAll vključi 4. vir — EN nosilec za začetek IN osvežitev ob fokusu (R171)', () => {
    expect(domov).toContain(
      'Promise.all([fetchProjects(), fetchInventory(), fetchCustomers(), fetchNarocila()])',
    )
  })

  it('0 novih hex — samo roksal žetoni (amber/red kartica, r168 družina)', () => {
    expect(blok).toContain('border-roksal-amber/40')
    expect(blok).toContain('bg-roksal-amber/5')
    expect(blok).toContain('text-roksal-ink')
    expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('ikone aria-hidden + števec tabular-nums (družina R177/R208)', () => {
    expect(blok).toContain('aria-hidden="true"')
    expect(blok).toContain('tabular-nums')
  })

  it('brez izmišljenega uspeha: kartica ne trdi, da je bilo kaj poslano/opravljeno', () => {
    expect(domov).not.toContain('Naročilo bo poslano dobavitelju')
  })

  it('brez lažne navigacije: pot do pregleda je opisana (Material → Naročila), gumb "odpri" ne obstaja', () => {
    expect(blok).toContain('Material → Naročila')
  })
})
