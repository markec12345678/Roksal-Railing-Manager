// R173 — refetch-on-focus za CRM + prodajno ploščo (P1-c) + fail-verbose
// plošča + logistični CSV metapodatki (P1-d, konsistentnost z R171).
// ---------------------------------------------------------------------------
// P1-c: crm-tab (loadCustomers, že fail-verbose R162) in deal-pipeline
// (loadProjects, prej fail-silent `if (res.ok)` brez else + `catch ignore`
// — R173 popravljen v fail-verbose R162 vzorec) sta žičena na
// useRefetchOnFocus; render vrata `loading && prazno` (vzorec termini-card
// R170) — osvežitev ne utripa skeletov/vrtiljaka nad obstoječimi podatki.
// P1-d: logistični CSV dobi meta vrstice Obseg/Povzetek/Izvoženo ob —
// povzetek je ISTI terminUrPovzetekRazsirjen niz kot na zaslonu (EN VIR
// RESNICE), pečat ISTI casOznaka kot glava (null → vrstica izpuščena).
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { terminUrPovzetek, terminUrPovzetekRazsirjen, vsotaPredvidenihUr, type TerminPrikazVnos } from '@/lib/termini-prikaz'

const crm = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/crm-tab.tsx'), 'utf8')

const pipeline = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/deal-pipeline.tsx'), 'utf8')

const logistika = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')

const vnos = (over: Partial<TerminPrikazVnos> = {}): TerminPrikazVnos => ({
  id: 't1',
  projectId: 'p1',
  projektIme: 'Nadstropna ograja, Kranj',
  strankaIme: 'Novak d.o.o.',
  strankaNaslov: 'Cesta 1, Kranj',
  lokacija: 'Vhod A',
  ekipaIme: 'Ekipa 1',
  monterId: 'u1',
  monterIme: 'Janez',
  status: 'NAVRTENO',
  datumZacetka: '2026-09-26T08:00:00.000Z',
  predvideneUre: 8,
  moja: true,
  ...over,
})

describe('R173 terminUrPovzetekRazsirjen — EN VIR RESNICE za zaslon in izvoz', () => {
  it('preskoceni = 0 → NATANKO terminUrPovzetek niz (nič dodanega)', () => {
    const ag = vsotaPredvidenihUr([vnos(), vnos({ predvideneUre: 4 })])
    expect(terminUrPovzetekRazsirjen(ag, 0)).toBe(terminUrPovzetek(ag))
    expect(terminUrPovzetekRazsirjen(ag, 0)).toBe('Skupaj 12 h · 2 termina')
  })

  it('preskoceni = 1 → "· 1 vnos preskočen (neveljaven vnos)"', () => {
    const ag = vsotaPredvidenihUr([vnos()])
    expect(terminUrPovzetekRazsirjen(ag, 1)).toBe('Skupaj 8 h · 1 termin · 1 vnos preskočen (neveljaven vnos)')
  })

  it('preskoceni = 3 → množina "· 3 vnosov preskočenih (neveljaven vnos)"', () => {
    const ag = vsotaPredvidenihUr([vnos()])
    expect(terminUrPovzetekRazsirjen(ag, 3)).toBe('Skupaj 8 h · 1 termin · 3 vnosov preskočenih (neveljaven vnos)')
  })

  it('deluje tudi z "≥" agregatom (brez ure) in preklicanimi — osnova nespremenjena', () => {
    const ag = vsotaPredvidenihUr([vnos({ predvideneUre: null, status: 'PREKlicANO' })])
    const osnova = terminUrPovzetek(ag)
    expect(terminUrPovzetekRazsirjen(ag, 2)).toBe(`${osnova} · 2 vnosov preskočenih (neveljaven vnos)`)
  })

  it('fail-closed: pokvarjen preskoceni → TypeError', () => {
    const ag = vsotaPredvidenihUr([vnos()])
    expect(() => terminUrPovzetekRazsirjen(ag, -1)).toThrow(TypeError)
    expect(() => terminUrPovzetekRazsirjen(ag, 1.5)).toThrow(TypeError)
    expect(() => terminUrPovzetekRazsirjen(ag, Number.NaN)).toThrow(TypeError)
    expect(() => terminUrPovzetekRazsirjen(ag, Number.POSITIVE_INFINITY)).toThrow(TypeError)
  })

  it('fail-closed: pokvarjen agregat → TypeError (isti kontrakt kot terminUrPovzetek)', () => {
    const pokvarjen = { ure: -5, stTerminov: 1, brezUre: 0, preklicanih: 0 }
    expect(() => terminUrPovzetekRazsirjen(pokvarjen as never, 0)).toThrow(TypeError)
  })
})

describe('R173 P1-c žičenje — CRM refetch-on-focus', () => {
  it('crm-tab importira + žiče useRefetchOnFocus(loadCustomers) — fail-verbose R162 loader', () => {
    const src = crm()
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/useRefetchOnFocus\(loadCustomers\)/)
    // loader ostane EDINI vir napak (hook ne požira — brez .catch v žičenju)
    expect(src).not.toMatch(/useRefetchOnFocus\(\s*\(\)\s*=>\s*loadCustomers\(\)\.catch/)
  })

  it('render vrata: loading && customers.length === 0 (osvežitev ne utripa skeletov — vzorec termini-card)', () => {
    const src = crm()
    expect(src).toMatch(/loading && customers\.length === 0 \?/)
  })
})

describe('R173 P1-c žičenje — prodajna plošča refetch-on-focus + fail-verbose', () => {
  it('deal-pipeline importira + žiče useRefetchOnFocus(loadProjects)', () => {
    const src = pipeline()
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/useRefetchOnFocus\(loadProjects\)/)
  })

  it('fail-verbose: !res.ok VEJA nastavi error + počisti items (nikoli tihega starega stanja)', () => {
    const src = pipeline()
    expect(src).toMatch(/if \(!res\.ok\) \{\s*\n\s*setItems\(\[\]\)\s*\n\s*itemsRef\.current = \[\]\s*\n\s*setError\(/)
    // 401 ima lastno sporočilo (vzorec R162 CRM)
    expect(src).toContain("'Prijava je potekla — ponovno se prijavite (napaka 401).'")
  })

  it('fail-verbose: catch NIČ tihega ignore — omrežna napaka je vidna', () => {
    const src = pipeline()
    expect(src).not.toMatch(/\/\* omrežna napaka[^*]*\*\//)
    expect(src).toContain("'Ni povezave s strežnikom — preverite omrežje in poskusite znova.'")
  })

  it('error panel: role="alert" + gumb Poskusi znova (R162 vzorec CRM, aria-label plošče)', () => {
    const src = pipeline()
    expect(src).toMatch(/role="alert"/)
    expect(src).toMatch(/onClick=\{\(\) => void loadProjects\(\)\}/)
    expect(src).toMatch(/aria-label="Ponovno naloži prodajno ploščo"/)
    expect(src).toContain('Poskusi znova')
  })

  it('render vrata: loading && items.length === 0 + aria-busy (osvežitev ne utripa vrtiljaka)', () => {
    const src = pipeline()
    expect(src).toMatch(/loading && items\.length === 0 \?/)
    expect(src).toMatch(/aria-busy=\{loading \|\| undefined\}/)
  })
})

describe('R173 P1-d žičenje — logistični CSV metapodatki (IZVOŽENO = ZASLON)', () => {
  it('logistika importira terminUrPovzetekRazsirjen (EN VIR RESNICE z zaslonom in CSV)', () => {
    const src = logistika()
    expect(src).toContain('terminUrPovzetekRazsirjen')
    // zaslon in izvoz uporabljata ISTI lib klic z ISTIMA argumentoma
    const calls = src.match(/terminUrPovzetekRazsirjen\(urPovzetek\.ag, urPovzetek\.preskoceni\)/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })

  it('CSV klic podaje povzetek + osvezitev (pečat) + obseg — EN VIR RESNICE', () => {
    const src = logistika()
    expect(src).toMatch(/downloadSchedulesCsv\(schedules, \{/)
    expect(src).toMatch(/povzetek: terminUrPovzetekRazsirjen\(urPovzetek\.ag, urPovzetek\.preskoceni\)/)
    expect(src).toMatch(/osvezitev: zadnjaOsvezitev/)
    expect(src).toMatch(/obseg: projectId \? 'Filtrirano na projekt' : 'Vsi termini'/)
  })

  it('meta vrstice: Obseg + Povzetek + pogojna Izvoženo ob (null → vrstica IZPUŠČENA)', () => {
    const src = logistika()
    expect(src).toContain("['Obseg', metapodatki.obseg]")
    expect(src).toContain("['Povzetek', metapodatki.povzetek]")
    expect(src).toMatch(/metapodatki\.osvezitev !== null\s*\n\s*\? \[\['Izvoženo ob \(čas zadnje osvežitve\)', casOznaka\(metapodatki\.osvezitev\)\]/)
  })

  it('starejši kontrakt R139 NI spremenjen: ime datoteke + 9 stolpcev ostaja', () => {
    const src = logistika()
    expect(src).toContain('`Termini-${todayStamp()}.csv`')
    expect(src).toContain("['Datum', 'Od', 'Do', 'Projekt', 'Stranka', 'Ekipa', 'Status', 'Lokacija', 'Ure']")
  })
})
