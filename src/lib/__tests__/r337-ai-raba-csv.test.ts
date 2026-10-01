// R337 — 64. člen (issue #1 IZVOZI družina): AI RABA PREGLED CSV testi.
// ---------------------------------------------------------------------------
// Pokritje:
//  • glave VERBATIM + oblika kanona R136 (BOM + podpičje + CRLF + trailing);
//  • WYSIWYG meta glava (števci EN VIR projcije — ISTI kot zaslon vrstica;
//    'AI-obveznih' IZPELJAN stAi − stNadomestkov = 0 po konstrukciji —
//    NIČ trdo kodirane ničle);
//  • blok A: žive AI površine verbatim (EN VIR pin PROTI projciji R311 —
//    opis/modul/nadomestekOpis/nadomestekModul, NIČ trdo kodiranih nizov);
//  • blok B: kandidati verbatim (funkcija/zakaj/status) + vrstica statusa =
//    ISTA formula kot zaslon ('Kandidati — {kandidatiStatus ?? različni
//    statusi}'; fixture z mešanimi statusi pina vejo 'različni statusi');
//  • Sklep EN VIR (ISTI niz kot aiRabaPregled().sklep — zaslon + testi +
//    docs + CSV = potrošniki ENEGA niza);
//  • vir niz + RFC 4180 (realni kandidat 'zakaj' vsebuje podpičje →
//    citiranje — LEKCIJA R334 2; fixture pina citirano celico);
//  • DETERMINIZEM FULL (dva klica bajtno enaka — brez-časa kanon R334/R336:
//    nič 'Izvoženo ob', katalog je statična resnica repozitorija);
//  • filename bratska simetrija (ai-raba.csv, brez datuma);
//  • fail-closed: ne-objekt / ne-polje / pokvaren sklep / nefinitni števci /
//    dolžinsko neskladje + graditeljski vrstici — kanon R299 (TypeError z
//    imenom polja/graditelja);
//  • žičenje: vodja handler poda že IZRISANI pregled (aiRabaCsv(aiRaba) —
//    EN VIR po konstrukciji) + pill + legenda medija.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AI_RABA_CSV_GLAVE_KANDIDATI,
  AI_RABA_CSV_GLAVE_ZIVE,
  AI_RABA_VIR_NIZ,
  aiRabaCsv,
  aiRabaCsvFilename,
  aiRabaCsvKandidatVrstica,
  aiRabaCsvZivaVrstica,
} from '@/lib/ai-raba-csv'
import { aiRabaPregled } from '@/lib/ai-raba-pregled'
import type { AiRabaPregled } from '@/lib/ai-raba-pregled'

const PREGLED = aiRabaPregled()

function razcleni(csv: string): string[][] {
  return csv
    .replace(/^\uFEFF/, '')
    .replace(/\r\n$/, '')
    .split('\r\n')
    .map((vrstica) => vrstica.split(';'))
}

/** Minimalna veljavna fixture (mešani statusi — veja 'različni statusi'). */
const FIXTURE: AiRabaPregled = {
  zive: [
    {
      id: 'x',
      opis: 'Opis; z podpičjem',
      modul: 'modul-x',
      nadomestekId: 'y',
      nadomestekOpis: 'Nadomestek (brez AI)',
      nadomestekModul: 'modul-y',
    },
  ],
  kandidati: [
    {
      funkcija: 'Funkcija; test',
      zakaj: 'Zakaj; utemeljitev',
      status: 'NE-IMPLEMENTIRANO — kandidat (nič povezano)',
    },
  ],
  kandidatiStatus: null,
  stAi: 1,
  stKandidatov: 1,
  stNadomestkov: 1,
  sklep: 'Sklep; z podpičjem',
}

describe('r337 ai-raba-csv — 64. člen IZVOZI (CSV brat ai-raba-dokaz bloka)', () => {
  it('glave VERBATIM + oblika kanona R136 (BOM + podpičje + CRLF + trailing CRLF)', () => {
    const csv = aiRabaCsv(PREGLED)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    // tabela PRVA (vzorec R334/R336): glava bloka A = prva vrstica
    expect(
      csv.startsWith('\uFEFFZmožnost (opis);Modul;Nadomestek (brez AI);Nadomestek (modul)\r\n'),
    ).toBe(true)
    expect(AI_RABA_CSV_GLAVE_ZIVE).toEqual([
      'Zmožnost (opis)',
      'Modul',
      'Nadomestek (brez AI)',
      'Nadomestek (modul)',
    ])
    expect(AI_RABA_CSV_GLAVE_KANDIDATI).toEqual(['Funkcija', 'Zakaj', 'Status'])
    expect(csv.endsWith('\r\n')).toBe(true)
    // podpičje = ločilo (ne vejica — kanon R136)
    expect(razcleni(csv)[0]).toEqual([...AI_RABA_CSV_GLAVE_ZIVE])
  })

  it('WYSIWYG meta glava: števci EN VIR projcije (ISTI kot zaslon vrstica) + AI-obveznih IZPELJAN (0 po konstrukciji — nič trdo kodirane ničle)', () => {
    const vrstice = razcleni(aiRabaCsv(PREGLED))
    const najdi = (label: string): string[] | undefined =>
      vrstice.find((v) => v[0] === label)
    expect(najdi('AI raba — iskrena resnica')).toEqual(['AI raba — iskrena resnica'])
    expect(najdi('AI površin v živo (z nadomestkom)')).toEqual([
      'AI površin v živo (z nadomestkom)',
      String(PREGLED.stAi),
    ])
    expect(najdi('Nadomestkov (determinističnih)')).toEqual([
      'Nadomestkov (determinističnih)',
      String(PREGLED.stNadomestkov),
    ])
    expect(najdi('Kandidatov (ne-implementiranih)')).toEqual([
      'Kandidatov (ne-implementiranih)',
      String(PREGLED.stKandidatov),
    ])
    expect(najdi('AI-obveznih')).toEqual([
      'AI-obveznih',
      String(PREGLED.stAi - PREGLED.stNadomestkov),
    ])
    // EN VIR resnica kataloga (register R311): 2 'ai' zmožnosti z nadomestkom,
    // 3 iskrena kandidata — 0 AI-obveznih po konstrukciji
    expect(PREGLED.stAi).toBe(2)
    expect(PREGLED.stNadomestkov).toBe(2)
    expect(PREGLED.stKandidatov).toBe(3)
    expect(PREGLED.stAi - PREGLED.stNadomestkov).toBe(0)
  })

  it('blok A verbatim: žive AI površine = EN VIR projcija (pin PROTI R311 — opis, modul, nadomestek*, vrstni red ISTI)', () => {
    const csv = aiRabaCsv(PREGLED)
    const vrstice = razcleni(csv)
    for (let i = 0; i < PREGLED.zive.length; i++) {
      const z = PREGLED.zive[i]!
      const v = vrstice[1 + i] // glava bloka A (vrstica 0) + podatkovne vrstice
      expect(v).toEqual([z.opis, z.modul, z.nadomestekOpis, z.nadomestekModul])
    }
    // zaslon pokaže opis + '→ nadomestek (brez AI): …' — CSV nosi ISTI nizi
    for (const z of PREGLED.zive) {
      expect(csv).toContain(z.opis)
      expect(csv).toContain(z.nadomestekOpis)
    }
  })

  it('blok B verbatim: kandidati (funkcija/zakaj/status) + vrstica statusa = ISTA formula kot zaslon', () => {
    const csv = aiRabaCsv(PREGLED)
    // vsi trije kandidati delijo isti iskren status → formula pokaže status
    expect(csv).toContain(`Kandidati — ${PREGLED.kandidatiStatus}`)
    for (const k of PREGLED.kandidati) {
      expect(csv).toContain(k.funkcija)
      expect(csv).toContain(k.zakaj)
      expect(csv).toContain(k.status)
    }
    // fixture z mešanimi statusi (kandidatiStatus null) → veja 'različni statusi'
    const mešani: AiRabaPregled = { ...FIXTURE, kandidatiStatus: null }
    expect(aiRabaCsv(mešani)).toContain('Kandidati — različni statusi')
  })

  it('Sklep EN VIR: ISTI niz kot aiRabaPregled().sklep (zaslon + testi + docs + CSV = potrošniki ENEGA niza)', () => {
    const csv = aiRabaCsv(PREGLED)
    expect(csv).toContain(`Sklep;${PREGLED.sklep}`)
    expect(PREGLED.sklep).toContain('AI-obveznih: 0 — jedro deluje brez AI')
  })

  it('vir niz + RFC 4180: podpičje znotraj celic → citiranje (LEKCIJA R334 2 — realni kandidat zakaj nosi podpičje)', () => {
    const csv = aiRabaCsv(PREGLED)
    expect(csv).toContain(`Vir;${AI_RABA_VIR_NIZ}`)
    // realni katalog: 'zakaj' vsebuje podpičje ('…počasno; CV hevristike…') —
    // celica MORA biti citirana (narekovaj + ohranjeno podpičje)
    const citirana = PREGLED.kandidati.filter((k) => k.zakaj.includes(';'))
    expect(citirana.length).toBeGreaterThan(0)
    expect(csv).toContain('"')
    // fixture: citirana celica je ENA celica (razcleni naivno — preverjamo
    // surovi niz: narekovaj objame podpičje)
    const fx = aiRabaCsv(FIXTURE)
    expect(fx).toContain('"Opis; z podpičjem"')
    expect(fx).toContain('"Funkcija; test"')
    expect(fx).toContain('"Sklep; z podpičjem"')
  })

  it('DETERMINIZEM FULL: dva klica = bajtno identična datoteka (brez-časa kanon R334/R336 — nič Izvoženo ob)', () => {
    const a = aiRabaCsv(PREGLED)
    const b = aiRabaCsv(PREGLED)
    expect(a).toBe(b)
    expect(a).not.toContain('Izvoženo ob')
    // privzeti vhod = EN VIR graditelj — isti rezultat kot z izrisano projcijo
    expect(aiRabaCsv()).toBe(a)
  })

  it('filename bratska simetrija: ai-raba.csv (brez datuma — statična resnica kataloga, vzorec R334/R336)', () => {
    expect(aiRabaCsvFilename()).toBe('ai-raba.csv')
    expect(aiRabaCsvFilename()).not.toMatch(/\d{4}-\d{2}/)
  })

  it('fail-closed pregled: ne-objekt / ne-polje / pokvaren sklep / nefinitni števci / dolžinsko neskladje — TypeError z imenom', () => {
    // @ts-expect-error — namenoma pokvaren vhod (test fail-closed poti)
    expect(() => aiRabaCsv(null)).toThrowError(/aiRabaCsv/)
    // @ts-expect-error
    expect(() => aiRabaCsv('ne-polje')).toThrowError(/aiRabaCsv/)
    // @ts-expect-error
    expect(() => aiRabaCsv({ ...FIXTURE, zive: 'ne-polje' })).toThrowError(/aiRabaCsv/)
    // @ts-expect-error
    expect(() => aiRabaCsv({ ...FIXTURE, kandidati: 'ne-polje' })).toThrowError(/aiRabaCsv/)
    expect(() => aiRabaCsv({ ...FIXTURE, sklep: '' })).toThrowError(/aiRabaCsv/)
    expect(() => aiRabaCsv({ ...FIXTURE, stAi: Number.NaN })).toThrowError(/aiRabaCsv/)
    expect(() => aiRabaCsv({ ...FIXTURE, stKandidatov: -1 })).toThrowError(/aiRabaCsv/)
    // dolžinsko neskladje (zive.length != stNadomestkov) — zip asercija
    expect(() => aiRabaCsv({ ...FIXTURE, stNadomestkov: 5 })).toThrowError(/aiRabaCsv/)
  })

  it('fail-closed graditeljski vrstici: ne-objekt + prazno/kvarno polje (kanon R299 — TypeError z imenom graditelja in polja)', () => {
    // @ts-expect-error
    expect(() => aiRabaCsvZivaVrstica(null)).toThrowError(/aiRabaCsvZivaVrstica/)
    expect(() => aiRabaCsvZivaVrstica({ ...FIXTURE.zive[0], opis: '' })).toThrowError(
      /aiRabaCsvZivaVrstica/,
    )
    // @ts-expect-error
    expect(() => aiRabaCsvZivaVrstica({ ...FIXTURE.zive[0], modul: 42 })).toThrowError(
      /aiRabaCsvZivaVrstica/,
    )
    // @ts-expect-error
    expect(() => aiRabaCsvKandidatVrstica(null)).toThrowError(/aiRabaCsvKandidatVrstica/)
    expect(() => aiRabaCsvKandidatVrstica({ ...FIXTURE.kandidati[0], zakaj: '  ' })).toThrowError(
      /aiRabaCsvKandidatVrstica/,
    )
    // @ts-expect-error
    expect(() => aiRabaCsvKandidatVrstica({ ...FIXTURE.kandidati[0], status: '' })).toThrowError(
      /aiRabaCsvKandidatVrstica/,
    )
    // srečna pot: vrstici = verbatim projcija
    expect(aiRabaCsvZivaVrstica(FIXTURE.zive[0]!)).toEqual([
      'Opis; z podpičjem',
      'modul-x',
      'Nadomestek (brez AI)',
      'modul-y',
    ])
    expect(aiRabaCsvKandidatVrstica(FIXTURE.kandidati[0]!)).toEqual([
      'Funkcija; test',
      'Zakaj; utemeljitev',
      'NE-IMPLEMENTIRANO — kandidat (nič povezano)',
    ])
  })

  it('žičenje: vodja handler poda že IZRISANI pregled (aiRabaCsv(aiRaba) — EN VIR po konstrukciji) + pill + legenda medija', () => {
    const vodja = readFileSync(
      join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'),
      'utf8',
    )
    expect(vodja).toContain('const csv = aiRabaCsv(aiRaba)')
    expect(vodja).toContain('a.download = aiRabaCsvFilename()')
    expect(vodja).toContain('aria-label="Izvozi pregled AI rabe kot CSV"')
    expect(vodja).toContain('data-testid="ai-raba-csv-pill"')
    // sinhron, brez spinnerja (vzorec TRIADA R334/R335/R336) — handler NE
    // postavlja VTeku stanja (spinner je rezerviran za poročila z UI izvedbo)
    const handlerZacetek = vodja.indexOf('function exportAiRabaCsv')
    const handlerKonec = vodja.indexOf('function exportZmogljivostPdf')
    const handler = vodja.slice(handlerZacetek, handlerKonec)
    expect(handler).not.toContain('VTeku')
    // legenda medija + definicijski naslov medija
    expect(vodja).toContain('AI raba CSV = ista resnica kot zaslon')
    expect(vodja).toContain('data-testid="ai-raba-csv-legenda"')
    expect(vodja).toContain('Excel za arhiv in filtriranje po modulu/statusu')
  })
})
