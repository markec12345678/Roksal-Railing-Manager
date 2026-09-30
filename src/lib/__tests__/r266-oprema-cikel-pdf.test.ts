// ---------------------------------------------------------------------------
// R266 — OPREMA — ŽIVLJENJSKI CIKL PDF (22. člen 'izvozi' družine, P1-f) —
// testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN
// VRSTNI RED = bajtno ENAK — sort interno + kanon seed po id, f(množica);
// %PDF- magija; NOV glifni razred — R249 doktrina; brat R265 bajtno zdrav) +
// ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave opremaCikelPregled;
// kalibracijski 4-vejni jezik — potečena/manjka rok/do/ne zahteva) + fail-closed
// (podvojen id, invariance R145 jedra — inspectionDue ⇒ next, calibrationOverdue
// ⇒ rok, alarm na nemerski = pokvaren vir) + vsebinski dokazi na VIRU liba in
// komponente (pill VEDNO viden, FRESH paginirani fetch — tiha rezina
// prepovedana, mini-vrstica state-oka, 0 novih hex).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildOpremaCikelPdfDoc,
  opremaCikelPdfFilename,
  opremaCikelPregled,
  preveriOpremoVnos,
  sortirajOpremoCikel,
  kosBeseda,
  OPREMA_STATUS_LABELI,
  type OpremaCikelVnos,
} from '@/lib/oprema-cikel-pdf'
import {
  buildProjektiTerminiPdfDoc,
  type ProjektiTerminiProjektVnos,
  type ProjektiTerminiTerminVnos,
} from '@/lib/projekti-termini-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r257/r265 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/oprema-cikel-pdf.ts')
const komponenta = beri('src/components/roksal/logistics-tab.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-29T08:00:00.000Z')

// Osnovni kos (nemerski, brez periodike, na voljo, brez lokacije) + nadgradbe.
function kos(over: Partial<OpremaCikelVnos> & Pick<OpremaCikelVnos, 'id' | 'naziv'>): OpremaCikelVnos {
  return {
    tip: 'Ročno orodje',
    status: 'NA_VOLJO',
    lokacija: null,
    serijskaStevilka: null,
    lastInspectionAt: null,
    inspectionIntervalDays: null,
    nextInspectionAt: null,
    inspectionDue: false,
    inspectionUnknown: false,
    calibrationRequired: false,
    calibrationDueDate: null,
    calibrationCertificate: null,
    calibrationOverdue: false,
    calibrationMissing: false,
    zadnjiServis: null,
    assignmentsCount: 0,
    ...over,
  }
}

// 5 kosov — VSE veje: zapadel pregled + potečena kalibracija (e1, RED akcija),
// nezabeležen pregled + manjka kal. rok (e3, AMBER iskreno neznano),
// IZGUBLJENO brez lokacije (e2), V_SERVISU z naslednjim pregledom (e4),
// UPOKOJENO (e5 — referenčni pregled vključuje tudi mrtve).
const OPREMA: OpremaCikelVnos[] = [
  kos({ id: 'e1', naziv: 'Laserni merilec', tip: 'Merska oprema', lokacija: 'Delavnica', serijskaStevilka: 'SN-1', lastInspectionAt: '2026-01-01T00:00:00.000Z', inspectionIntervalDays: 180, nextInspectionAt: '2026-06-30T00:00:00.000Z', inspectionDue: true, calibrationRequired: true, calibrationDueDate: '2026-08-01T00:00:00.000Z', calibrationOverdue: true, assignmentsCount: 2 }),
  kos({ id: 'e2', naziv: 'Ladder A', status: 'IZGUBLJENO' }),
  kos({ id: 'e3', naziv: 'Blinker Set', status: 'V_UPORABI', tip: 'Merska oprema', inspectionIntervalDays: 90, inspectionUnknown: true, calibrationRequired: true, calibrationMissing: true, assignmentsCount: 1 }),
  kos({ id: 'e4', naziv: 'Viličar', status: 'V_SERVISU', tip: 'Prevoz', lokacija: 'Skladišče', lastInspectionAt: '2026-03-01T00:00:00.000Z', inspectionIntervalDays: 365, nextInspectionAt: '2027-03-01T00:00:00.000Z' }),
  kos({ id: 'e5', naziv: 'Stari kolesek', status: 'UPOKOJENO' }),
]

function zgradi(vhodi: readonly OpremaCikelVnos[] = OPREMA, now: Date = NOW): Buffer {
  const doc = buildOpremaCikelPdfDoc(vhodi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R266 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno + kanon seed po id); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([OPREMA[4], OPREMA[2], OPREMA[0], OPREMA[3], OPREMA[1]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(OPREMA, new Date('2026-09-29T08:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 30 znanih družinskih razredov IN ≠ brat R265) + ime Oprema-cikel-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261, 35409, 37228, 39094, 41009, 37560]
    expect(znani).not.toContain(bin.length)
    // Brat R265 z ISTIMI vhodi kot njegov test — drug dokument = druga dolžina.
    const r265Projekti: ProjektiTerminiProjektVnos[] = [
      { id: 'p1', nazivProjekta: 'Ograja Alenka', datumMontaze: '2026-10-02T08:00:00.000Z', stranka: 'Stranka Alenka' },
      { id: 'p2', nazivProjekta: 'Terasa Bernard', datumMontaze: '2026-10-10T08:00:00.000Z', stranka: null },
      { id: 'p3', nazivProjekta: 'Balustrada Cvetka', datumMontaze: null, stranka: 'Stranka Cvetka' },
    ]
    const r265Termini: ProjektiTerminiTerminVnos[] = [
      { projectId: 'p1', status: 'ZAKLJUCENO', predvideneUre: 6, datumZacetka: '2026-09-20T08:00:00.000Z' },
      { projectId: 'p1', status: 'NAVRTENO', predvideneUre: 8, datumZacetka: '2026-10-05T08:00:00.000Z' },
      { projectId: 'p1', status: 'NAVRTENO', predvideneUre: 4, datumZacetka: '2026-10-06T08:00:00.000Z' },
      { projectId: 'p1', status: 'PREKlicANO', predvideneUre: 3, datumZacetka: '2026-10-07T08:00:00.000Z' },
      { projectId: 'p3', status: 'V_TEKU', predvideneUre: 5, datumZacetka: '2026-09-29T08:00:00.000Z' },
    ]
    const r265Bin = Buffer.from(buildProjektiTerminiPdfDoc(r265Projekti, r265Termini, { now: NOW }).output('arraybuffer'))
    expect(r265Bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).not.toBe(r265Bin.length)
    expect(opremaCikelPdfFilename(NOW)).toBe('Oprema-cikel-2026-09-29.pdf')
    expect(() => opremaCikelPdfFilename('danes' as unknown as Date)).toThrow(TypeError)
  })

  it('soli 0x95–0x98 — UNIKATNE v družini (register: projekti-termini 0x91–0x94 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x95)')
    expect(lib).toContain('fnv1aHex(seed, 0x98)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x91)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x8d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x89)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x85)')
  })
})

describe('R266 — ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave)', () => {
  it('povzetek: 5 kosov, 2 merski, zapadel 1 (e1), nezabeležen 1 (e3), kal. potečena 1, manjka kal. rok 1, brez lokacije 3 (e2+e3+e5), rezervacij 3, statusi 1/1/1/1/1', () => {
    const { povzetek } = opremaCikelPregled(OPREMA)
    expect(povzetek.oprem).toBe(5)
    expect(povzetek.merskih).toBe(2)
    expect(povzetek.pregledZapadel).toBe(1)
    expect(povzetek.pregledNezabelezen).toBe(1)
    expect(povzetek.kalPotecena).toBe(1)
    expect(povzetek.kalManjkaRok).toBe(1)
    expect(povzetek.brezLokacije).toBe(3)
    expect(povzetek.rezervacij).toBe(3)
    expect(povzetek.naVoljo).toBe(1)
    expect(povzetek.vUporabi).toBe(1)
    expect(povzetek.vServisu).toBe(1)
    expect(povzetek.izgubljeno).toBe(1)
    expect(povzetek.upokojeno).toBe(1)
  })

  it('sort NAZIV ASC (code-unit — brez locale) + istonaslovna izenačba id ASC; premešan vhod = ISTI povzetek (f(MNOŽICA)); VSA oprema v vrsticah (tudi UPOKOJENO/IZGUBLJENO)', () => {
    const { vrste } = opremaCikelPregled(OPREMA)
    expect(vrste.map((v) => v.id)).toEqual(['e3', 'e2', 'e1', 'e5', 'e4'])
    const enak = sortirajOpremoCikel([
      { ...vrste[0], id: 'z9', naziv: 'Enak Naziv' },
      { ...vrste[0], id: 'a1', naziv: 'Enak Naziv' },
    ])
    expect(enak.map((v) => v.id)).toEqual(['a1', 'z9'])
    const premešan = opremaCikelPregled([OPREMA[4], OPREMA[1], OPREMA[0], OPREMA[3], OPREMA[2]])
    expect(premešan.povzetek).toEqual(opremaCikelPregled(OPREMA).povzetek)
    expect(premešan.vrste.map((v) => v.statusKoda)).toContain('UPOKOJENO')
    expect(premešan.vrste.map((v) => v.statusKoda)).toContain('IZGUBLJENO')
  })

  it('kalibracijski 4-vejni jezik per vrsta (potečena/do/manjka rok/ne zahteva) + status oznake iz OPREMA_STATUS_LABELI + tip poimenovan; brez-lokacija resnica', () => {
    const { vrste } = opremaCikelPregled(OPREMA)
    const e1 = vrste.find((v) => v.id === 'e1')!
    expect(e1.kalPotecena).toBe(true)
    expect(e1.kalRok).toBe('2026-08-01T00:00:00.000Z')
    expect(e1.pregledZapadel).toBe(true)
    expect(e1.status).toBe('Na voljo')
    expect(e1.statusKoda).toBe('NA_VOLJO')
    const e3 = vrste.find((v) => v.id === 'e3')!
    expect(e3.kalManjkaRok).toBe(true)
    expect(e3.kalRok).toBeNull()
    expect(e3.pregledNezabelezen).toBe(true)
    expect(e3.status).toBe('V uporabi')
    const e2 = vrste.find((v) => v.id === 'e2')!
    expect(e2.kalNeZahteva).toBe(true)
    expect(e2.lokacija).toBeNull()
    expect(e2.status).toBe('Izgubljeno')
    const e5 = vrste.find((v) => v.id === 'e5')!
    expect(e5.status).toBe('Upokojeno')
    expect(OPREMA_STATUS_LABELI.UPOKOJENO).toBe('Upokojeno')
    expect(OPREMA_STATUS_LABELI.IZGUBLJENO).toBe('Izgubljeno')
  })
})

describe('R266 — fail-closed v libu (družina R236/R250–R265)', () => {
  it('prazen seznam opreme ne nastaja dokumenta — TypeError s toast sporočilom komponente (obe vrati: build IN pregled)', () => {
    expect(() => buildOpremaCikelPdfDoc([], { now: NOW })).toThrow(TypeError)
    expect(() => buildOpremaCikelPdfDoc([], { now: NOW })).toThrow('prazen seznam opreme ne nastaja dokumenta')
    expect(() => opremaCikelPregled([])).toThrow('prazen seznam opreme ne nastaja dokumenta — pregled se izvozi, ko je vpisan prvi kos opreme')
  })

  it('fail-closed ×13: podvojen id, ne-polje, ne-options, pokvaren now, null vnos, prazni id/naziv/tip/lokacija/serijska/potrdilo, neznan status, interval 0/1.5, ne-ISO datum, ne-boolean, negativen števec — indeks krivca', () => {
    expect(() => opremaCikelPregled([OPREMA[0], { ...OPREMA[0] }])).toThrow('podvojen id opreme e1')
    expect(() => buildOpremaCikelPdfDoc('ne-polje' as unknown as OpremaCikelVnos[], { now: NOW })).toThrow(TypeError)
    expect(() => buildOpremaCikelPdfDoc(OPREMA, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildOpremaCikelPdfDoc(OPREMA, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildOpremaCikelPdfDoc(OPREMA, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => preveriOpremoVnos(null as unknown as OpremaCikelVnos, 2)).toThrow('pričakovana oprema')
    expect(() => preveriOpremoVnos({ ...kos({ id: 'x', naziv: 'N' }), id: '' }, 2)).toThrow('id mora biti ne-prazen niz')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: '  ' }), 2)).toThrow('naziv mora biti ne-prazen niz')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', tip: '' }), 2)).toThrow('tip mora biti ne-prazen niz')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', lokacija: '' }), 2)).toThrow('lokacija mora biti ne-prazen niz ALI null')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', serijskaStevilka: '' }), 2)).toThrow('serijskaStevilka mora biti ne-prazen niz ALI null')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', calibrationCertificate: '' }), 2)).toThrow('calibrationCertificate mora biti ne-prazen niz ALI null')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', status: 'POKVAREN' as unknown as OpremaCikelVnos['status'] }), 2)).toThrow('status mora biti eden izmed 5 znanih')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', inspectionIntervalDays: 0 }), 2)).toThrow('inspectionIntervalDays mora biti celo število ≥ 1')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', inspectionIntervalDays: 1.5 }), 2)).toThrow('inspectionIntervalDays mora biti celo število ≥ 1')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', lastInspectionAt: 'ne-iso' }), 2)).toThrow('lastInspectionAt mora biti ISO niz')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', inspectionDue: 'da' as unknown as boolean }), 2)).toThrow('inspectionDue mora biti boolean')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', assignmentsCount: -1 }), 2)).toThrow('assignmentsCount mora biti celo število ≥ 0')
  })

  it('invariance R145 jedra (pokvaren vir fail-closed): inspectionDue brez next, calibrationOverdue brez roka, kalibracijski alarm na nemerski', () => {
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', inspectionDue: true, nextInspectionAt: null }), 4)).toThrow('inspectionDue brez naslednjega roka')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', calibrationRequired: true, calibrationOverdue: true, calibrationDueDate: null }), 7)).toThrow('calibrationOverdue brez kalibracijskega roka')
    expect(() => preveriOpremoVnos(kos({ id: 'x', naziv: 'N', calibrationRequired: false, calibrationMissing: true }), 8)).toThrow('kalibracijski alarm na nemerski opremi')
  })

  it('sklanjatev kosBeseda (slovenski dvojinski razred — 2 kosa / 3-4 kosi / 5+ kosov / 11-14 kosov) + fail-closed ne-celo', () => {
    expect(kosBeseda(0)).toBe('kosov')
    expect(kosBeseda(1)).toBe('kos')
    expect(kosBeseda(2)).toBe('kosa')
    expect(kosBeseda(3)).toBe('kosi')
    expect(kosBeseda(4)).toBe('kosi')
    expect(kosBeseda(5)).toBe('kosov')
    expect(kosBeseda(11)).toBe('kosov')
    expect(kosBeseda(12)).toBe('kosov')
    expect(kosBeseda(14)).toBe('kosov')
    expect(kosBeseda(21)).toBe('kos')
    expect(kosBeseda(22)).toBe('kosa')
    expect(kosBeseda(23)).toBe('kosi')
    expect(kosBeseda(101)).toBe('kos') // 'sto EN kos' — singular po enicah (R168 kanon)
    expect(kosBeseda(111)).toBe('kosov')
    expect(() => kosBeseda(1.5)).toThrow(TypeError)
    expect(() => kosBeseda(-1)).toThrow(TypeError)
  })
})

describe('R266 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 8 stolpcev (Oprema, Tip, Status, Lokacija, Zadnji pregled, Naslednji pregled, Kalibracija, Rezervacije) — head dobesedno', () => {
    expect(lib).toContain("['Oprema', 'Tip', 'Status', 'Lokacija', 'Zadnji pregled', 'Naslednji pregled', 'Kalibracija', 'Rezervacije']")
  })

  it('barvna resnica: potečena RED bold (akcija), manjka rok AMBER, ne zahteva sivo, zapadel pregled RED bold, ni zabeležen AMBER, \'—\' sivo; NIKOLI utišan alarm', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain("raw.startsWith('potečena')")
    expect(okno).toContain("raw === 'manjka rok'")
    expect(okno).toContain("raw === 'ne zahteva'")
    expect(okno).toContain("raw === 'ni zabeležen'")
    expect(okno).toContain('textColor = RED')
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GRAY')
    expect(okno).toContain('fontStyle = \'bold\'')
  })

  it('KPI 5 boxov z signalnim jezikom (zapadel RED>0, nezabeležen AMBER>0, potečena RED>0, manjka kal. rok AMBER>0, kosov NAVY)', () => {
    expect(lib).toContain("'Kosov'")
    expect(lib).toContain("'Pregled zapadel'")
    expect(lib).toContain("'Pregled nezabeležen'")
    expect(lib).toContain("'Kalibracija potečena'")
    expect(lib).toContain("'Manjka kal. rok'")
    expect(lib).toContain('povzetek.pregledZapadel > 0 ? RED : GREEN')
    expect(lib).toContain('povzetek.pregledNezabelezen > 0 ? AMBER : GREEN')
    expect(lib).toContain('povzetek.kalPotecena > 0 ? RED : GREEN')
    expect(lib).toContain('povzetek.kalManjkaRok > 0 ? AMBER : GREEN')
  })

  it('sklep: izključitve/resnice poimenovane (akcija; iskreno neznano; poimenovano brez-lokacija; VSA oprema — referenčni pregled; vir polna resnica + paginacija)', () => {
    expect(lib).toContain('(akcija)')
    expect(lib).toContain('(iskreno neznano — interval brez zapisa)')
    expect(lib).toContain('(kalibracija pogoj)')
    expect(lib).toContain('brez vpisane lokacije')
    expect(lib).toContain('(poimenovano)')
    expect(lib).toContain('(referenčni pregled — VSA oprema)')
    expect(lib).toContain('vir = /api/equipment (polna resnica, paginacija do 10.000 kosov)')
  })

  it('glava OPREMA — ŽIVLJENJSKI CIKL + osveženo + noge Stran i/N + NOVI datotečni kontrakt Oprema-cikel-', () => {
    expect(lib).toContain("'OPREMA — ŽIVLJENJSKI CIKL'")
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
    expect(lib).toContain("`Oprema-cikel-${todayStamp(now)}.pdf`")
  })

  it('brez locale-odvisnih APIjev + NIČ mreže v libu (client-only resnica; route NIČ; R259 lekcija 2 — ne-lovi komentarjev)', () => {
    expect(lib).not.toContain('localeCompare')
    expect(lib).not.toContain('toLocaleString')
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).not.toContain('fetch(')
    expect(lib).not.toContain("from 'node:crypto'")
    expect(lib).not.toContain("require('node:crypto')")
  })
})

describe('R266 — komponenta (logistics-tab) — pill, mini-vrstica, handler', () => {
  it('pill VEDNO viden (bralni dokument, P1-k precedens; NI gated na equipment.length) + disabled={ocVTeku} dvoklik guard + press-scale + Activity aria-hidden', () => {
    expect(komponenta).toContain('aria-label="Izvozi pregled življenjskega cikla opreme kot PDF"')
    expect(komponenta).toContain('title="Življenjski cikl opreme kot pravi PDF — pregledi, kalibracije, statusi (vsa oprema)"')
    const pil = oknoMed(komponenta, 'Izvozi pregled življenjskega cikla opreme kot PDF', '<Activity aria-hidden="true"')
    expect(pil).toContain('disabled={ocVTeku}')
    expect(pil).not.toContain('disabled={equipment.length === 0}')
    expect(pil).toContain('press-scale')
    expect(komponenta).toContain('<Activity aria-hidden="true"')
  })

  it('F2 mini-vrstica (state-oka — kar uporabnik vidi): dot roksal-red/green, kondicionalna žiga ŽIVO samo kadar je akcija (R256 lekcija 4), tabular-nums, ISTA izpeljava', () => {
    const mini = oknoMed(komponenta, 'R266 — F2 ciklov mini-vrstica', '{equipment.length === 0 ?')
    expect(mini).toContain('Cikl (viden seznam):')
    expect(mini).toContain("bg-roksal-red' : 'bg-roksal-green'")
    expect(mini).toContain('{opremaCikelPovzetek.pregledZapadel > 0 && (')
    expect(mini).toContain('{opremaCikelPovzetek.kalPotecena > 0 && (')
    expect(mini).toContain('border-roksal-red/40 bg-roksal-red/10')
    expect(mini).toContain('tabular-nums')
    expect(mini).toContain('{kosBeseda(opremaCikelPovzetek.oprem)}')
  })

  it('memo PRED pogojnimi vračanji (pravila hooks) + ENA izpeljava ≥ 2 klici opremaCikelPregled (memo + handler — WYSIWYG, R263 test dokaz) — R306 pin shift: EN VIR refactor (memo = POLNI pregled, povzetek izpeljan; dokaz 36. člen IZ ISTEGA memo — NIČ dvojnega računa)', () => {
    expect(komponenta.indexOf('const opremaCikel = useMemo(')).toBeGreaterThan(-1)
    expect(komponenta.indexOf('const opremaCikel = useMemo(')).toBeLessThan(komponenta.indexOf('if (loadError)'))
    expect((komponenta.match(/opremaCikelPregled\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(komponenta).toContain('opremaCikelPregled(opremaCikelVhodi)') // ENA izpeljava memo (R306)
    expect(komponenta).toContain('const opremaCikelPovzetek = opremaCikel === null ? null : opremaCikel.povzetek') // izpeljan — NIČ dvojnega
    expect(komponenta).toContain('opremaCikelDokaz(opremaCikel.vrste)') // dokaz 36. člen IZ ISTEGA pregleda
  })

  it('handler: FRESH paginirani fetch VSE opreme — R297 pin shift: fetch mehanika v ENO funkcijo pridobiOpremoVnosi (PDF + CSV brat, ENA izpeljava vira — precedens R180/R294/R295/R296) + dvoklik guard + fail-closed PREJ (Ni vpisane opreme) → ENA izpeljava → generate; EN now; TypeError viden razlog', () => {
    const okno = oknoMed(komponenta, 'const handleOpremaCikelPdf', 'const handleOpremaCikelCsv')
    expect(okno).toContain('if (ocVTeku) return')
    expect(okno).toContain('const vnosi = await pridobiOpremoVnosi()')
    expect(okno).toContain("title: 'Ni vpisane opreme'")
    expect(okno).toContain("'Pregled življenjskega cikla se izvozi, ko je vpisan prvi kos opreme.'")
    const prazen = okno.indexOf('vnosi.length === 0')
    const generiraj = okno.indexOf('generateOpremaCikelPdf(')
    expect(prazen).toBeGreaterThanOrEqual(0)
    expect(generiraj).toBeGreaterThan(prazen)
    expect(okno).toContain('const { povzetek } = opremaCikelPregled(vnosi)')
    expect(okno).toContain('generateOpremaCikelPdf(vnosi, { now: new Date() })')
    expect(okno).toContain("title: 'Pregled opreme prenešen v PDF'")
    expect(okno).toContain('Oprema-cikel-…pdf — ${povzetek.oprem} ${kosBeseda(povzetek.oprem)}, zapadel pregled ${povzetek.pregledZapadel}, potečena kalibracija ${povzetek.kalPotecena}.')
    expect(okno).toContain("variant: 'destructive'")
    expect(okno).toContain('setOcVTeku(false)')
  })

  it('R297 — ENA izpeljava vira: pridobiOpremoVnosi = FRESH paginirani fetch (limit/offset — tiha rezina prepovedana) + MAX_OFFSET meja poimenovana; oba brata klicata ISTO funkcijo', () => {
    const vir = oknoMed(komponenta, 'const pridobiOpremoVnosi', 'const handleOpremaCikelPdf')
    expect(vir).toContain('fetch(`/api/equipment?limit=${limit}&offset=${offset}`, { credentials: \'same-origin\' })')
    expect(vir).toContain('GET /api/equipment → HTTP ${res.status}')
    expect(vir).toContain('Odgovora /api/equipment ni mogoče prebrati (ni polja).')
    expect(vir).toContain('if (stran.length < limit) break')
    expect(vir).toContain('offset > 10_000')
    expect(vir).toContain('nad mejo paginacije vira (MAX_OFFSET)')
    expect((komponenta.match(/pridobiOpremoVnosi\(\)/g) ?? []).length).toBe(2)
  })

  it('fail-verbose DTO pruning — R297 pin shift: v ENI funkciji pridobiOpremoVnosi (oba brata); vrstica brez id/naziv → TypeError; manjkajoč tip → TypeError (IDENTITETE pred libom — R264/R265 vzorec)', () => {
    const vir = oknoMed(komponenta, 'const pridobiOpremoVnosi', 'const handleOpremaCikelPdf')
    expect(vir).toContain('manjkajoč id/naziv v odgovoru API-ja')
    expect(vir).toContain('manjkajoč tip v odgovoru API-ja')
    expect(vir).toContain('const stran = data as Array<Record<string, unknown>>')
    expect(vir).toContain('const tip = EQUIPMENT_TYPES[tipApi] ?? (tipApi !== \'\' ? tipApi : null)')
  })

  it('legenda pill pariteta (družina): PDF = polna resnica, ne samo viden seznam', () => {
    expect(komponenta).toContain('PDF = življenjski cikl VSE opreme (pregledi · kalibracije · statusi — polna resnica, ne samo viden seznam)')
  })

  it('brat R265 NESPREMENJEN (soli 0x91–0x94 pri bratu — bajtno zdrav tudi po R266)', () => {
    const r265Lib = beri('src/lib/projekti-termini-pdf.ts')
    expect(r265Lib).toContain('fnv1aHex(seed, 0x91)')
    expect(r265Lib).not.toContain('fnv1aHex(seed, 0x95)')
  })

  it('0 novih hex (žetoni samo — družinsko pravilo R224–R265)', () => {
    const hexi = komponenta.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    const znani = new Set(['2a3f5f', '1d2b3e'])
    for (const h of hexi) expect(znani.has(h.slice(1).toLowerCase())).toBe(true)
  })
})
