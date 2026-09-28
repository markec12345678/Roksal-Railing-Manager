// R211 — projekt-detail dialog: fail-verbose meritve/portal viri (zadnja
// razpoložljiva fail-open vrzel iz R203 inventarja) + pečat svežine naročilnega
// vira na Domov kartici (R171 vzorec). Prej: `return []/null` + tihi catch =
// lažno 'Ni meritev za ta projekt' / 'Onemogočen' nad NEZNANIM dejanskim
// stanjem. Zdaj: role=alert + razlog + Poskusi znova (samo za napovedani vir);
// akcije (omogoči portal) skrite dokler vir ne odgovori (fail-closed UI).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const domov = readFileSync(join(root, 'src/components/roksal/dashboard-tab.tsx'), 'utf8')
// Blok novih refetch funkcij (od R211 komentarja do portalAction).
const refetchBlok = domov.slice(
  domov.indexOf('R211: fail-verbose viri v projektu-detail dialogu'),
  domov.indexOf('async function portalAction'),
)
// Blok Domov naročilne kartice (R210 kom + R211 pečat do Activity Timeline).
const karticaBlok = domov.slice(
  domov.indexOf('R210 — Naročila, ki čakajo'),
  domov.indexOf('Activity Timeline'),
)

describe('R211 — fail-verbose meritve/portal viri v projektu-detail dialogu', () => {
  it('stara tiha vrata so GONE: ne-ok odgovor ne vrača več sintetiziranega []/null', () => {
    expect(domov).not.toContain('.catch(() => setDetailMeasurements([]))')
    expect(domov).not.toContain('.catch(() => setPortalInfo(null))')
    // odstranimo // komentarje (dokumentirajo STARE ravnanje) — gledamo kodo
    const koda = refetchBlok.replace(/^\s*\/\/.*$/gm, '')
    expect(koda).not.toContain('return []')
    expect(koda).not.toContain('return null')
  })

  it('napaka strežnika nosi RAZLOG: telo odgovora ali status (brez golih napak)', () => {
    expect(refetchBlok).toContain("throw new Error(err?.error || `Napaka strežnika (${res.status}).`)")
  })

  it('ločena refetch funkcija za vsak vir — Poskusi znova NE ponastavi celotnega dialoga', () => {
    expect(domov).toContain('function refetchDetailMeasurements(project: Project)')
    expect(domov).toContain('function refetchPortal(project: Project)')
    expect(refetchBlok).toContain('setDetailMeasurementsError(null)')
    expect(refetchBlok).toContain('setPortalError(null)')
  })

  it('openProjectDetail pokliče oba vira; nič ne fangi tiho (fail-verbose)', () => {
    const openBlok = domov.slice(
      domov.indexOf('function openProjectDetail'),
      domov.indexOf('function refetchDetailMeasurements'),
    )
    expect(openBlok).toContain('refetchDetailMeasurements(project)')
    expect(openBlok).toContain('refetchPortal(project)')
  })

  it('meritve: role=alert z naslovom + razlogom + Poskusi znova (družina R163/R202/R209)', () => {
    expect(domov).toContain('Meritev ni bilo mogoče naložiti')
    expect(domov).toContain('refetchDetailMeasurements(detailProject)')
  })

  it('meritve: značka je iskrena pri napaki (\'!\', ne lažni števec 0)', () => {
    expect(domov).toContain("detailMeasurementsError ? (\n                        <Badge variant=\"secondary\" className=\"text-[11px] bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20\" title={detailMeasurementsError}>!</Badge>")
  })

  it('portal: role=alert + iskreno pojasnilo (stanja ne izmišljujemo) + Poskusi znova', () => {
    expect(domov).toContain('Portala ni bilo mogoče naložiti')
    expect(domov).toContain('Stanja ne izmišljujemo — dokler vir ne odgovori, ne vemo, ali je portal omogočen.')
    expect(domov).toContain('refetchPortal(detailProject)')
  })

  it('portal: značka pokaže Napaka, ne lažno Onemogočen (obe kartici)', () => {
    expect(domov).toContain('portalError ? (\n                      <Badge className="bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20 text-2xs" title={portalError}>')
    expect((domov.match(/Napaka\n/g) || []).length).toBe(2)
  })

  it('fail-closed UI: akcije omogočanja SKRITE dokler vir ne odgovori (!portalError vrata)', () => {
    expect(domov).toContain('!portalLoading && !portalError && !portalInfo?.enabled && !canManagePortal')
    expect(domov).toContain('!portalLoading && !portalError && !portalInfo?.enabled && canManagePortal')
    expect(domov).toContain('!portalLoading && !portalError && !portalInfo?.measure?.enabled && !canManagePortal')
    expect(domov).toContain('!portalLoading && !portalError && !portalInfo?.measure?.enabled && canManagePortal')
  })

  it('merilna povezava: svoja vidna napaka (ločena kartica, isti vir)', () => {
    expect(domov).toContain('Merilne povezave ni bilo mogoče naložiti')
  })

  it('iskren prazen stanji OSTATA — vidni LE ko je vir uspešno odgovoril', () => {
    expect(domov).toContain('Ni meritev za ta projekt')
  })

  it('0 novih hex — samo roksal žetoni (r168 družina)', () => {
    expect(refetchBlok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    const alerti = domov.slice(domov.indexOf('Meritev ni bilo mogoče naložiti'), domov.indexOf('Merilna povezava (samomeritev)'))
    expect(alerti).toContain('border-roksal-red/30')
    expect(alerti).toContain('bg-roksal-red/5')
    expect(alerti).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('ikone aria-hidden + focus ringi na novih gumbih (družina R177)', () => {
    const alerti = domov.slice(domov.indexOf('Meritev ni bilo mogoče naložiti'), domov.indexOf('Merilna povezava (samomeritev)'))
    expect(alerti).toContain('aria-hidden="true"')
    expect(alerti).toContain('focus-visible:ring-roksal-red/40')
  })
})

describe('R211 — pečat svežine naročilnega vira (R171 vzorec)', () => {
  it('narocilaOsvezitev obstaja in je nastavljen LE v uspešni veji', () => {
    expect(domov).toContain('const [narocilaOsvezitev, setNarocilaOsvezitev] = useState<Date | null>(null)')
    expect((domov.match(/setNarocilaOsvezitev\(new Date\(\)\)/g) || []).length).toBe(1)
    // napaka + catch oba počistita (nikoli lažne svežine)
    expect((domov.match(/setNarocilaOsvezitev\(null\)/g) || []).length).toBe(2)
  })

  it('kartica pokaže Osveženo ob z casOznaka + tabular-nums + History ikona aria-hidden', () => {
    expect(karticaBlok).toContain('narocilaOsvezitev && (')
    expect(karticaBlok).toContain('Osveženo ob <span className="tabular-nums">{casOznaka(narocilaOsvezitev)}</span>')
    expect(karticaBlok).toContain('Čas zadnje uspešne osvežitve naročil')
    expect(karticaBlok).toContain('<History className="h-3 w-3 shrink-0" aria-hidden="true" />')
  })

  it('0 novih hex na kartici (roksal žetoni, r168 družina)', () => {
    expect(karticaBlok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('regresija R210: kartica + fail-verbose + izpeljanka ostanejo nedotaknjeni', () => {
    expect(domov).toContain('Naročila, ki čakajo na dejanje')
    expect(domov).toContain('aktivnaNarocilaDomov > 0 ?')
    expect(domov).toContain('Promise.all([fetchProjects(), fetchInventory(), fetchCustomers(), fetchNarocila()])')
  })
})
