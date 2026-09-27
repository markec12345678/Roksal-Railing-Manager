// R203 — FAIL-VERBOSE STRAŽAR (družina R161–R163): 12 tihih neuspehov po
// vsem UI je popravljeno — vsaka popravljena funkcija MORA imeti
// `} else {` vejo z videnim razlogom (toast/panel) in R203 oznako.
// Kršitev (odstranjen else / izgubljeno sporočilo) = rdeči test.
// ---------------------------------------------------------------------------
// (1) logistics-tab: handleCreateCrew / handleCreateEquip (409/401/500 so
//     prej tiho utihnili — dialog ostal odprt brez razlage) + eventHistory
//     (prazen seznam = lažni "ni dogodkov") + vidna role=note opomba.
// (2) material-intelligence-tab: handleCreateSupplier / handleAddPrice.
// (3) photo-tab: handleDelete / handleDuplicate / handleAnnotationSave
//     (+ iskren batch povzetek: skriti neuspehi so laž — števec neuspelih)
//     + delRes.ok preverba (podvojene slike).
// (4) dashboard-tab: fetchInventory / fetchCustomers (lažni "Še ni strank"
//     = R161 QuoteFollowUp vzorec) + vidna role=alert panela s Poskusi znova.
// (5) roksal-catalog: fetchProfili (lažni "Ni profilov, ki ustrezajo
//     iskanju" tudi brez iskanja) + trojna veja (napaka / iskanje / res-prazno).
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

describe('R203 stražar: logistics-tab (ekipa/oprema/zgodovina)', () => {
  const src = beri('src/components/roksal/logistics-tab.tsx')

  it('handleCreateCrew + handleCreateEquip: else veji z razlogom + R203 oznako', () => {
    // ENOJNO okno: R203 komentar stoji PRED funkcijama → okno se začne tam.
    const okno = oknoMed(
      src,
      '// R203 — fail-verbose (vzorec R140/R163)',
      '// R163 fail-verbose: viden panel'
    )
    expect(okno).toContain('Ustvarjanje ekipe ni uspelo')
    expect(okno).toContain('Dodajanje opreme ni uspelo')
    // obe funkciji: else veja + razlog iz odgovora (logistics: else v novi vrstici)
    expect(okno.match(/else \{/g)?.length).toBeGreaterThanOrEqual(2)
    expect(okno.match(/res\.json\(\)\.catch\(\(\) => null\)\)/g)?.length).toBeGreaterThanOrEqual(2)
    expect(okno.match(/`Napaka \$\{res\.status\}`/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('eventHistory: padec NI tih — vidna opomba (napaka/omrežje), ne lažni "ni dogodkov"', () => {
    expect(src).toContain('setEventHistoryNapaka(null)')
    expect(src).toContain('`Zgodovina ni bila naložena (napaka ${res.status}).`')
    expect(src).toContain("setEventHistoryNapaka('Zgodovina ni bila naložena (omrežna napaka).')")
    // stari tih vzorec je GONE
    expect(src).not.toContain('zgodovina je naknadna — dialog ostane uporaben')
    // render: role=note, amber žetoni z dark: varianto na vrstici
    const noteOkno = oknoMed(src, 'eventHistoryNapaka && (', '</p>')
    expect(noteOkno).toContain('role="note"')
    expect(noteOkno).toContain('dark:text-roksal-amber')
  })
})

describe('R203 stražar: material-intelligence-tab (dobavitelj/cena)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('handleCreateSupplier: else veja + razlog + R203 oznako', () => {
    // R203 komentar stoji PRED funkcijo → okno se začne pri komentarju.
    const okno = oknoMed(src, '// R203 — fail-verbose (vzorec R140)', 'const handleAddPrice')
    expect(okno).toContain('Ustvarjanje dobavitelja ni uspelo')
    expect(okno).toMatch(/if \(res\.ok\)[\s\S]*\} else \{/)
    expect(okno).toContain('res.json().catch(() => null)')
  })

  it('handleAddPrice: else veja + razlog', () => {
    const okno = oknoMed(src, 'const handleAddPrice', 'const handleOrderStatus')
    expect(okno).toMatch(/if \(res\.ok\)[\s\S]*\} else \{/)
    expect(okno).toContain('Dodajanje cene ni uspelo')
    expect(okno).toContain('res.json().catch(() => null)')
  })
})

describe('R203 stražar: photo-tab (brisanje/duplikat/anotacije/batch)', () => {
  const src = beri('src/components/roksal/photo-tab.tsx')

  it('handleDelete: else veja z razlogom (403/404/500 se pokažejo)', () => {
    const okno = oknoMed(src, 'async function handleDelete', '// ---- Duplikat ----')
    expect(okno).toContain('R203')
    expect(okno).toMatch(/if \(res\.ok\)[\s\S]*\} else \{/)
    expect(okno).toContain("toast({ title: 'Brisanje ni uspelo'")
  })

  it('handleDuplicate: else veja z razlogom', () => {
    const okno = oknoMed(src, 'async function handleDuplicate', '// ---- Izvoz slike ----')
    expect(okno).toMatch(/if \(res\.ok\)[\s\S]*\} else \{/)
    expect(okno).toContain("toast({ title: 'Kopiranje ni uspelo'")
  })

  it('handleAnnotationSave: else veja + delRes.ok preverba (ni tihih podvojenih slik)', () => {
    const okno = oknoMed(src, 'async function handleAnnotationSave', '// ---- Batch upload ----')
    expect(okno).toMatch(/if \(res\.ok\)[\s\S]*\} else \{/)
    expect(okno).toContain('Shranjevanje anotacij ni uspelo')
    expect(okno).toContain('delRes.ok')
    expect(okno).toContain('brisanje stare slike ni uspelo')
  })

  it('batch upload: ISKREN povzetek — števec neuspelih + destructive, kadar > 0', () => {
    const okno = oknoMed(src, 'const napake = files.length - success', 'loadPhotos()')
    expect(okno).toContain('Neuspešnih prenosov')
    expect(okno).toContain("variant: napake > 0 ? 'destructive' : undefined")
    expect(okno).toContain(`${'${success}'}/${'${files.length}'} slik dodanih`)
  })
})

describe('R203 stražar: dashboard-tab (zaloga/stranke)', () => {
  const src = beri('src/components/roksal/dashboard-tab.tsx')

  it('fetchInventory: napaka je VIDNA (napaka ${status}/omrežje), stari "keep empty" GONE', () => {
    // R203 komentar je pri STATE deklaraciji → okno se začne tam.
    const okno = oknoMed(src, 'const [invError, setInvError]', 'const fetchCustomers')
    expect(okno).toContain('`Zaloge ni bilo mogoče naložiti (napaka ${res.status}).`')
    expect(okno).toContain("setInvError('Zaloge ni bilo mogoče naložiti — preverite povezavo.')")
    expect(src).not.toContain('keep empty')
    expect(okno).toContain('Array.isArray(data) ? data : []')
  })

  it('fetchCustomers: napaka je VIDNA — lažni "Še ni strank" ob padcu je GONE', () => {
    const okno = oknoMed(src, 'const fetchCustomers', '// R171 (P1-b iz R170)')
    expect(okno).toContain('`Strank ni bilo mogoče naložiti (napaka ${res.status}).`')
    expect(okno).toContain("setCustomersError('Strank ni bilo mogoče naložiti — preverite povezavo.')")
  })

  it('render: invError panel (role=alert + Poskusi znova) + customersError vrstica', () => {
    expect(src).toContain('Zaloga ni na voljo')
    expect(src).toContain('customersError ? (')
    // dva nova 'Poskusi znova' kličeta pravi fetch
    expect(src).toContain('onClick={() => void fetchInventory()}')
    expect(src).toContain('onClick={() => void fetchCustomers()}')
  })
})

describe('R203 stražar: roksal-catalog (profili)', () => {
  const src = beri('src/components/roksal/roksal-catalog.tsx')

  it('fetchProfili: napaka VIDNA + stari tih catch GONE', () => {
    expect(src).toContain('`Profilov ni bilo mogoče naložiti (napaka ${res.status}).`')
    expect(src).toContain("setNapaka('Profilov ni bilo mogoče naložiti — preverite povezavo.')")
    expect(src).not.toContain('/* ignore */')
    expect(src).toContain('Array.isArray(data) ? data : []')
  })

  it('render: trojna veja — napaka / iskanje-prazno / res-prazno (iskreni teksti)', () => {
    expect(src).toContain('role="alert"')
    expect(src).toContain('Poskusi znova')
    expect(src).toContain("'Ni profilov, ki ustrezajo iskanju.'")
    expect(src).toContain("'Ni aktivnih profilov v katalogu.'")
  })
})
