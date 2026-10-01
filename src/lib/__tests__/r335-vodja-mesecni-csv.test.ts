// ---------------------------------------------------------------------------
// R335 — 62. člen (issue #1 IZVOZI družina): izvoz MESEČNEGA poročila vodje
// kot DETERMINISTIČNI CSV. CSV brat PDF poročilu runda M (boss-report-pdf) —
// EN VIR: ISTI ReportData vhod (mesecniPregledData v komponenti — DVA
// potrošnika), mesecIme + STATUS_SL UVOŽENA iz PDF brata (anti-divergenca po
// konstrukciji), celice = ISTI izpisi kot PDF body (eur/eur0 EN VIR
// csv-export; zapadli 'Dni zapadlo' = ISTA izpeljava kot PDF). Glave =
// VERBATIM PDF autoTable head — testi pinajo PROTI PDF VIRU (vzorec
// R330/R331/R332/R334). Format = kanon R136 toCsv (BOM + podpičje + CRLF +
// RFC 4180). 'Izvoženo ob' = PODATKOVNI izvoz z referenčnim mesecem (kanon
// R330–R333 — 'Dni zapadlo' je odvisen od dneva; čas je del resnice).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mesecIme, STATUS_SL, type ReportData } from '@/lib/boss-report-pdf'
import {
  vodjaMesecniCsv,
  vodjaMesecniCsvFilename,
  vodjaMesecniCsvKpiVrstice,
  vodjaMesecniCsvPrihodekVrstica,
  vodjaMesecniCsvPlacanVrstica,
  vodjaMesecniCsvZapadliVrstica,
  vodjaMesecniCsvProjektVrstica,
  vodjaMesecniCsvSklep,
  MESECNI_CSV_GLAVE_PRIHODKI,
  MESECNI_CSV_GLAVE_PLACANI,
  MESECNI_CSV_GLAVE_ZAPADLI,
  MESECNI_CSV_GLAVE_PROJEKTI,
  MESECNI_VIR_NIZ,
} from '@/lib/vodja-mesecni-csv'
import { slDatumKratko } from '@/lib/csv-export'

const PDF_VIR = readFileSync(join(process.cwd(), 'src/lib/boss-report-pdf.ts'), 'utf8')

// Fiksni TOČKASTI čas (determinizem — kanon 46./47. člen; TZ neodvisni UTC ISO)
const NOW = new Date('2026-10-01T09:15:00.000Z')

const FIXTURE: ReportData = {
  mesec: { year: 2026, month: 9 }, // oktober (0-based)
  generatedAt: NOW,
  stats: {
    prihodekMesec: 12345.5,
    marza: 3086,
    odprtoZnesek: 5000,
    zapadloZnesek: 1200,
    zapadloSt: 2,
    projektovNovih: 3,
    ureMesec: 42,
    skupajProjektov: 12,
    skupajStrank: 8,
    skupniLTV: 98765.4,
    nizkaZaloga: 2,
    odprtaNarocila: 3,
    brezDobavitelja: 1,
    zamujeneDobave: 1,
    potekliOpomniki: 4,
  },
  prihodki6: [
    { label: 'Maj', eur: 1000 },
    { label: 'Jun', eur: 0 },
    { label: 'Jul', eur: 2500.25 },
    { label: 'Avg', eur: 300 },
    { label: 'Sep', eur: 4800 },
    { label: 'Okt', eur: 12345.5 },
  ],
  placaniTaMesec: [
    {
      stevilka: 'R-2026-001',
      kupec: 'Kupec A',
      projekt: 'Projekt A',
      znesek: 1234.5,
      datumIzdaje: '2026-09-20',
      rokPlacilaDni: 8,
      status: 'PLACAN',
      placanoAt: '2026-10-01T10:00:00.000Z',
    },
  ],
  izdaniZapadli: [
    {
      stevilka: 'R-2026-002',
      kupec: 'Kupec; B', // podpičje → RFC 4180 citiranje (quoteField kanon R136)
      projekt: 'Projekt B',
      znesek: 600,
      datumIzdaje: '2026-09-01', // + 8 dni = 9. 9. → 22 dni zapadlo (UTC)
      rokPlacilaDni: 8,
      status: 'IZDAN',
      placanoAt: null,
    },
    {
      stevilka: 'R-2026-003',
      kupec: 'Kupec, C', // vejica → NECITIRANA (LEKCIJA R334 2: ločilo je podpičje)
      projekt: '',
      znesek: 300,
      datumIzdaje: '2026-08-20', // + 8 dni = 28. 8. → 34 dni zapadlo
      rokPlacilaDni: 8,
      status: 'IZDAN',
      placanoAt: null,
    },
  ],
  projekti: [
    { naziv: 'Ogrja A', stranka: 'Stranka A', status: 'V_TEKU', cena: 5000 },
    { naziv: 'Ogrja B', stranka: '', status: 'NEZNAN_STATUS', cena: null },
  ],
}

describe('r335 vodja-mesecni CSV izvoz (62. člen — IZVOZI družina)', () => {
  const raw = vodjaMesecniCsv(FIXTURE, NOW)
  const vrstice = raw.slice(1).split('\r\n') // vključno s praznimi (trailing '' od CRLF)

  it('glave + KPI naslovi + sklep template + dni izpeljava = VERBATIM PDF VIR (anti-divergenca — nič dvojnega)', () => {
    expect(MESECNI_CSV_GLAVE_PLACANI).toEqual(['Račun', 'Kupec', 'Projekt', 'Plačano', 'Znesek'])
    expect(MESECNI_CSV_GLAVE_ZAPADLI).toEqual(['Račun', 'Kupec', 'Rok plačila', 'Dni zapadlo', 'Znesek'])
    expect(MESECNI_CSV_GLAVE_PROJEKTI).toEqual(['Projekt', 'Stranka', 'Status', 'Cena'])
    // ANTI-DIVERGENCA pini: PDF VIR nosi ISTA stolpca (autoTable head runda M)
    expect(PDF_VIR).toContain("head: [['Račun', 'Kupec', 'Projekt', 'Plačano', 'Znesek']]")
    expect(PDF_VIR).toContain("head: [['Račun', 'Kupec', 'Rok plačila', 'Dni zapadlo', 'Znesek']]")
    expect(PDF_VIR).toContain("head: [['Projekt', 'Stranka', 'Status', 'Cena']]")
    // KPI naslovi = VERBATIM PDF kpiBox klicev
    expect(PDF_VIR).toContain("'Prihodek (plačano)'")
    expect(PDF_VIR).toContain("'Marža (25 %)'")
    expect(PDF_VIR).toContain("'Odprto (izdano)'")
    expect(PDF_VIR).toContain("'Zapadlo'")
    expect(PDF_VIR).toContain("'Novih projektov'")
    expect(PDF_VIR).toContain("'Ure (koledar)'")
    // zapadli 'Dni zapadlo' = ISTA izpeljava kot PDF body (rok = izdaja + rok;
    // dni = max(0, floor((generatedAt − rok)/86400000)))
    expect(PDF_VIR).toContain('rok.setDate(rok.getDate() + inv.rokPlacilaDni)')
    expect(PDF_VIR).toContain('Math.max(0, Math.floor((data.generatedAt.getTime() - rok.getTime()) / 86400000))')
    // sklep = VERBATIM PDF sklepna vrstica (ISTI template segmenti)
    expect(PDF_VIR).toContain('`Skupno stanje: ${s.skupajProjektov} projektov, ${s.skupajStrank} strank, skupni LTV ${eur0(s.skupniLTV)}.`')
    // EN VIR uvozi: mesecIme + STATUS_SL prihajata iz PDF brata (nič kopij)
    expect(mesecIme(2026, 9)).toBe('Oktober')
    expect(STATUS_SL['V_TEKU']).toBe('V teku')
  })

  it('oblika kanona R136: BOM + CRLF + točkovna struktura (glava + Izvoženo ob + KPI ×6 + prihodki 6 + plačani + zapadli + projekti + meta)', () => {
    expect(raw.startsWith('\uFEFF')).toBe(true)
    expect(raw.endsWith('\r\n')).toBe(true)
    // glava dokumenta = naslov + referenčni mesec (mesecIme EN VIR iz PDF brata)
    expect(vrstice[0]).toBe('Mesečno poročilo vodje;Oktober 2026')
    // 'Izvoženo ob' = PODATKOVNI izvoz z referenčnim mesecem (kanon R330–R333)
    expect(vrstice[1]).toBe('Izvoženo ob;2026-10-01T09:15:00.000Z')
    expect(vrstice[2]).toBe('')
    // KPI blok ×6 (ISTI naslovi in izpisi kot PDF kpiBox)
    expect(vrstice[3]).toBe('Prihodek (plačano);12.346 €')
    expect(vrstice[4]).toBe('Marža (25 %);3086 €')
    expect(vrstice[5]).toBe('Odprto (izdano);5000 €')
    expect(vrstice[6]).toBe('Zapadlo;1200 € (2)')
    expect(vrstice[7]).toBe('Novih projektov;3')
    expect(vrstice[8]).toBe('Ure (koledar);42 h')
    expect(vrstice[9]).toBe('')
    // prihodki blok (glava + 6 mesecev = ISTI izpisi kot stolpci grafa)
    expect(vrstice[10]).toBe('Mesec;Prihodki')
    expect(vrstice[11]).toBe('Maj;1000 €')
    expect(vrstice[12]).toBe('Jun;0 €')
    expect(vrstice[13]).toBe('Jul;2500 €')
    expect(vrstice[14]).toBe('Avg;300 €')
    expect(vrstice[15]).toBe('Sep;4800 €')
    expect(vrstice[16]).toBe('Okt;12.346 €')
    expect(vrstice[17]).toBe('')
    // plačani blok (VERBATIM glava + ISTI celici kot PDF body)
    expect(vrstice[18]).toBe('Račun;Kupec;Projekt;Plačano;Znesek')
    expect(vrstice[19]).toBe('R-2026-001;Kupec A;Projekt A;1. 10. 2026;1234,50 €')
    expect(vrstice[20]).toBe('')
    // zapadli blok (VERBATIM glava + dni izpeljava + RFC 4180)
    expect(vrstice[21]).toBe('Račun;Kupec;Rok plačila;Dni zapadlo;Znesek')
    expect(vrstice[22]).toBe('R-2026-002;"Kupec; B";9. 9. 2026;22;600,00 €')
    expect(vrstice[23]).toBe('R-2026-003;Kupec, C;28. 8. 2026;34;300,00 €')
    expect(vrstice[24]).toBe('')
    // projekti blok (VERBATIM glava + STATUS_SL EN VIR + '—' celici)
    expect(vrstice[25]).toBe('Projekt;Stranka;Status;Cena')
    expect(vrstice[26]).toBe('Ogrja A;Stranka A;V teku;5000,00 €')
    expect(vrstice[27]).toBe('Ogrja B;—;NEZNAN_STATUS;—')
    expect(vrstice[28]).toBe('')
    // meta: števci (ISTA resnica kot PDF opozorila) + sklep VERBATIM + vir
    expect(vrstice[29]).toBe('Plačanih računov;1')
    expect(vrstice[30]).toBe('Nizka zaloga;2')
    expect(vrstice[31]).toBe('Odprta naročila;3')
    expect(vrstice[32]).toBe('Brez dobavitelja;1')
    expect(vrstice[33]).toBe('Zamujene dobave;1')
    expect(vrstice[34]).toBe('Potekli opomniki;4')
    expect(vrstice[35]).toBe('Skupaj projektov;12')
    expect(vrstice[36]).toBe('Skupaj strank;8')
    expect(vrstice[37]).toBe('Skupni LTV;98.765 €')
    expect(vrstice[38]).toBe('Sklep;Skupno stanje: 12 projektov, 8 strank, skupni LTV 98.765 €.')
    expect(vrstice[39]).toBe(`Vir;${MESECNI_VIR_NIZ}`)
  })

  it('KPI zapadlo veja: 0 zapadlih → \'0 €\' (ISTA PDF veja kot kpiBox pogoj) — prihodek/izdelek vrstice WYSIWYG', () => {
    const brezZapadlih: ReportData = {
      ...FIXTURE,
      stats: { ...FIXTURE.stats, zapadloSt: 0, zapadloZnesek: 0 },
    }
    const kpi = vodjaMesecniCsvKpiVrstice(brezZapadlih.stats)
    expect(kpi[3]).toEqual(['Zapadlo', '0 €'])
    // vrstica graditelja = ISTI izpisi kot kpiBox
    expect(vodjaMesecniCsvPrihodekVrstica({ label: 'Okt', eur: 12345.5 })).toEqual(['Okt', '12.346 €'])
    expect(vodjaMesecniCsvPlacanVrstica(FIXTURE.placaniTaMesec[0])).toEqual([
      'R-2026-001',
      'Kupec A',
      'Projekt A',
      '1. 10. 2026',
      '1234,50 €',
    ])
    // 'Dni zapadlo' = ISTA izpeljava kot PDF (rok izpeljava fiksna — UTC neodvisna
    // pričakovanja: isti izračun kot PDF formula na ISTIH vhodih)
    const rok = new Date(FIXTURE.izdaniZapadli[0].datumIzdaje)
    rok.setDate(rok.getDate() + FIXTURE.izdaniZapadli[0].rokPlacilaDni)
    expect(vodjaMesecniCsvZapadliVrstica(FIXTURE.izdaniZapadli[0], NOW)).toEqual([
      'R-2026-002',
      'Kupec; B',
      slDatumKratko(rok),
      String(Math.max(0, Math.floor((NOW.getTime() - rok.getTime()) / 86400000))),
      '600,00 €',
    ])
    expect(vodjaMesecniCsvProjektVrstica(FIXTURE.projekti[0])).toEqual(['Ogrja A', 'Stranka A', 'V teku', '5000,00 €'])
  })

  it('projekti prazna polja = PDF pariteta: prazen seznam → ISTA vrstica \'—\' (kot PDF autoTable body prazni prikaz)', () => {
    const prazen: ReportData = { ...FIXTURE, projekti: [] }
    const csv = vodjaMesecniCsv(prazen, NOW)
    const v = csv.slice(1).split('\r\n')
    const i = v.findIndex((x) => x === 'Projekt;Stranka;Status;Cena')
    expect(v[i + 1]).toBe('—;—;—;—')
  })

  it('sklep funkcija = VERBATIM PDF sklepna vrstica (EN VIR stats — ŠESTI+ potrošnik istega formata)', () => {
    expect(vodjaMesecniCsvSklep(FIXTURE)).toBe('Skupno stanje: 12 projektov, 8 strank, skupni LTV 98.765 €.')
  })

  it('DETERMINIZEM: isti vhod = bajtno identična datoteka (dva klica); filename = bratska simetrija z PDF imenom (porocilo-YYYY-MM.csv)', () => {
    expect(vodjaMesecniCsv(FIXTURE, NOW)).toBe(raw)
    expect(vodjaMesecniCsv(FIXTURE, NOW)).toBe(vodjaMesecniCsv(FIXTURE, NOW))
    expect(vodjaMesecniCsvFilename(FIXTURE)).toBe('porocilo-2026-10.csv')
    expect(vodjaMesecniCsvFilename(FIXTURE)).toBe(vodjaMesecniCsvFilename(FIXTURE))
    // bratska simetrija: PDF VIR shrani porocilo-YYYY-MM.pdf (ISTI mesec IZ VHODA)
    expect(PDF_VIR).toContain('doc.save(`porocilo-${data.mesec.year}-${mm}.pdf`)')
  })

  it('RFC 4180 citiranje: podpičje citira, vejica NE (quoteField kanon R136 — LEKCIJA R334 2); kupec z narekovajem podvojen', () => {
    const kraft: ReportData = {
      ...FIXTURE,
      izdaniZapadli: [
        {
          stevilka: 'R-X',
          kupec: 'Podjetje; d.o.o. "Nova"',
          projekt: 'a,b',
          znesek: 1,
          datumIzdaje: '2026-09-01',
          rokPlacilaDni: 8,
          status: 'IZDAN',
          placanoAt: null,
        },
      ],
    }
    const csv = vodjaMesecniCsv(kraft, NOW)
    const v = csv.slice(1).split('\r\n')
    const i = v.findIndex((x) => x.startsWith('R-X;'))
    // ; sproži citiranje, " se podvoji; zapadli tabela NIČE projekt stolpca
    // (5 celic — ISTI red kot PDF body); vejica v projektnem imenu ostane
    // NECITIRANA v glavni fixture vrstici (R-2026-003 — ločilo je podpičje)
    expect(v[i]).toBe('R-X;"Podjetje; d.o.o. ""Nova""";9. 9. 2026;22;1,00 €')
  })

  it('fail-closed pogled: pokvaren ReportData/now → TypeError z imenom liba (nič tihe degradacije)', () => {
    expect(() => vodjaMesecniCsv(null as unknown as ReportData, NOW)).toThrow(/vodjaMesecniCsv: pričakovano poročilo/)
    expect(() =>
      vodjaMesecniCsv({ ...FIXTURE, mesec: { year: 2026, month: 12 } } as ReportData, NOW),
    ).toThrow(/vodjaMesecniCsv: pričakovan veljaven mesec/)
    expect(() =>
      vodjaMesecniCsv({ ...FIXTURE, generatedAt: 'ni datum' } as unknown as ReportData, NOW),
    ).toThrow(/vodjaMesecniCsv: pričakovan veljaven generatedAt/)
    expect(() =>
      vodjaMesecniCsv({ ...FIXTURE, stats: null } as unknown as ReportData, NOW),
    ).toThrow(/vodjaMesecniCsv: pričakovani statistiki/)
    const pokvarenStats = { ...FIXTURE, stats: { ...FIXTURE.stats, prihodekMesec: Number.NaN } }
    expect(() => vodjaMesecniCsv(pokvarenStats, NOW)).toThrow(/pričakovan finiten števec stats\.prihodekMesec/)
    expect(() =>
      vodjaMesecniCsv({ ...FIXTURE, prihodki6: FIXTURE.prihodki6.slice(0, 5) } as ReportData, NOW),
    ).toThrow(/pričakovanih 6 mesecev prihodkov/)
    expect(() =>
      vodjaMesecniCsv({ ...FIXTURE, placaniTaMesec: 'ni polje' } as unknown as ReportData, NOW),
    ).toThrow(/pričakovana polja plačanih računov/)
    expect(() =>
      vodjaMesecniCsv({ ...FIXTURE, izdaniZapadli: null } as unknown as ReportData, NOW),
    ).toThrow(/pričakovana polja zapadlih računov/)
    expect(() =>
      vodjaMesecniCsv({ ...FIXTURE, projekti: 42 } as unknown as ReportData, NOW),
    ).toThrow(/pričakovana polja projektov/)
    expect(() => vodjaMesecniCsv(FIXTURE, 'ni čas' as unknown as Date)).toThrow(/vodjaMesecniCsv: pričakovan veljaven now/)
  })

  it('fail-closed vrstica graditelja: ne-objekt / pokvarena polja → TypeError z imenom graditelja', () => {
    expect(() => vodjaMesecniCsvKpiVrstice(null as unknown as never)).toThrow(/vodjaMesecniCsvKpiVrstice: pričakovani statistiki/)
    expect(() => vodjaMesecniCsvPrihodekVrstica(null as unknown as never)).toThrow(/vodjaMesecniCsvPrihodekVrstica: pričakovan mesec prihodkov/)
    expect(() => vodjaMesecniCsvPrihodekVrstica({ label: 'X', eur: Number.NaN })).toThrow(/pričakovan mesec prihodkov/)
    expect(() => vodjaMesecniCsvPlacanVrstica(null as unknown as never)).toThrow(/vodjaMesecniCsvPlacanVrstica: pričakovan račun/)
    expect(() =>
      vodjaMesecniCsvPlacanVrstica({ ...FIXTURE.placaniTaMesec[0], znesek: Number.NaN }),
    ).toThrow(/pričakovan račun/)
    expect(() => vodjaMesecniCsvZapadliVrstica(null as unknown as never, NOW)).toThrow(/vodjaMesecniCsvZapadliVrstica: pričakovan račun/)
    expect(() => vodjaMesecniCsvZapadliVrstica(FIXTURE.izdaniZapadli[0], 'x' as unknown as Date)).toThrow(
      /vodjaMesecniCsvZapadliVrstica: pričakovan veljaven generatedAt/,
    )
    expect(() => vodjaMesecniCsvProjektVrstica(null as unknown as never)).toThrow(/vodjaMesecniCsvProjektVrstica: pričakovan projekt/)
    expect(() => vodjaMesecniCsvSklep(null as unknown as never)).toThrow(/vodjaMesecniCsvSklep: pričakovano poročilo/)
    expect(() => vodjaMesecniCsvFilename(null as unknown as never)).toThrow(/vodjaMesecniCsvFilename: pričakovano poročilo/)
    expect(() =>
      vodjaMesecniCsvFilename({ ...FIXTURE, mesec: { year: 2026, month: -1 } } as ReportData),
    ).toThrow(/vodjaMesecniCsvFilename: pričakovan veljaven mesec/)
  })
})
