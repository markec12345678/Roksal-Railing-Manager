// ---------------------------------------------------------------------------
// R251 — OPOMNIK PDF (8. člen 'izvozi' družine, P1-k) — testi.
// Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; %PDF- magija;
// glifni razred minute — R249 doktrina) + vsebinski dokazi na VIRU liba in
// komponente (oknoMed; PDF content stream je fontno kodiran — izvleka teksta
// iz bajtov NI resnična).
// WYSIWYG dokazi: opomnikStatus pride VERBATIM iz API-ja (žig na kartici —
// lib NE izračunava statusa), dni resnica = ISTA formula kot API
// (Math.floor(diff / 86400000)) z now KOT PARAMETER; lib NE prečka dni in
// statusa (±1 dan ob polnoči je dokumentiran rob — NIKOLI lažen alarm).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildOpomnikPdfDoc,
  opomnikDniNiz,
  opomnikDniResnica,
  opomnikPdfFilename,
  preveriOpomnikVnos,
  type OpomnikPdfVnos,
} from '@/lib/opomnik-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med dvema markerjema (r207/r233/r244/r245/r250 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/opomnik-pdf.ts')
const komponenta = beri('src/components/roksal/crm-tab.tsx')
const prihodkiLib = beri('src/lib/prihodki-pdf.ts')
const crmCsvLib = beri('src/lib/crm-csv.ts')

const ZDANJ: Date = new Date(2026, 8, 28, 15, 0, 0) // fiksen vhod — determinizem

// ENA stranka = EN terenski list. ŠČŽ niz za fontni dokaz.
const STRANKA: OpomnikPdfVnos = {
  ime: 'ŠČŽ Gradnja d.o.o.',
  naslov: 'Cesta Republike 14, 4000 Kranj',
  telefon: '+386 41 234 567',
  email: 'info@scz-gradnja.si',
  kontaktnaOseba: 'Maja Novak',
  kategorija: 'Podjetje',
  opomnikDatum: '2026-10-02T09:00:00.000Z', // ~4 dni v prihodnje od ZDANJ → AKTIVEN ('še X dni')
  opomnikOpis: 'Letni pregled balkonov',
  zadnjiKontakt: '2026-09-10T12:00:00.000Z',
  createdAt: '2025-03-15T08:00:00.000Z',
  opomnikStatus: 'AKTIVEN',
  ltv: 12450.5,
  skupajProjektov: 3,
  zaklenjeni: 2,
}

function zgradi(vnos: OpomnikPdfVnos = STRANKA, now: Date = ZDANJ): Buffer {
  const doc = buildOpomnikPdfDoc(vnos, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R251 — opomnikDniResnica: ISTA formula kot API (Math.floor), now KOT PARAMETER (determinizem)', () => {
  it('prek datuma (POTEKEL resnica) / še prihaja (AKTIVEN resnica) / rob točno danes → smer DO z 0', () => {
    // 02.10. 09:00Z − 28.09. popoldne = ~3.7 dni → floor 3, smer DO
    const r = opomnikDniResnica(STRANKA, ZDANJ)
    expect(r.smer).toBe('DO')
    expect(r.dni).toBeGreaterThanOrEqual(3)
    expect(r.dni).toBeLessThanOrEqual(4)
    // prek: opomnik 4 dni v preteklosti → floor(-4.2) = -5 → PREK 5 (ISTI Math.floor kot API)
    const prek = opomnikDniResnica({ opomnikDatum: '2026-09-24T10:00:00.000Z' }, ZDANJ)
    expect(prek.smer).toBe('PREK')
    expect(prek.dni).toBeGreaterThanOrEqual(4)
    expect(prek.dni).toBeLessThanOrEqual(5)
    // rob: opomnik še NISO prekoračil (now 30 min PRED datumom, isti dan) → floor(+0.5h/24h)=0 → DO 0 ('še 0 dni')
    const zdaj = opomnikDniResnica({ opomnikDatum: '2026-09-28T13:00:00.000Z' }, new Date(Date.UTC(2026, 8, 28, 12, 30, 0)))
    expect(zdaj.smer).toBe('DO')
    expect(zdaj.dni).toBe(0)
    // floor negativni rob: now 30 min PO datumu (isti dan) → floor(-0.5h/24h)=−1 → PREK 1 — ISTI Math.floor
    // kot API (opomnikStatus bi ob istem času dal days=−1 → POTEKEL; formula pariteta, NIČ izmišljenega)
    const poDatumu = opomnikDniResnica({ opomnikDatum: '2026-09-28T13:00:00.000Z' }, new Date(Date.UTC(2026, 8, 28, 13, 30, 0)))
    expect(poDatumu.smer).toBe('PREK')
    expect(poDatumu.dni).toBe(1)
  })

  it('opomnikDniNiz: ENA prikazna resnica za blok + toast + PDF KPI (WYSIWYG — vzorec razlikaOdstotekNiz R247)', () => {
    const niz = opomnikDniNiz(STRANKA, ZDANJ)
    expect(niz).toMatch(/^še \d+ dni$/)
    const prek = opomnikDniNiz({ opomnikDatum: '2026-09-20T10:00:00.000Z' }, ZDANJ)
    expect(prek).toMatch(/^prek \d+ dni$/)
    // enak vhod = enak niz (determinizem)
    expect(opomnikDniNiz(STRANKA, ZDANJ)).toBe(niz)
  })

  it('lib NE izračunava statusa (VERBATIM iz API-ja — žig na kartici) in NE prečka dni/statusa (±1 dan ob polnoči = dokumentiran rob, NIKOLI lažen alarm)', () => {
    const preverba = oknoMed(lib, 'export function preveriOpomnikVnos', '/** Determinističen file-ID')
    expect(preverba).not.toContain('Math.floor')
    expect(preverba).not.toContain('POTEKEL = ')
    // dni formula je ločena funkcija — ISTI Math.floor kot API
    expect(oknoMed(lib, 'export function opomnikDniResnica', 'export function opomnikDniNiz')).toContain('Math.floor(')
  })
})

describe('R251 — fail-closed: pokvaren vnos → TypeError z vzrokom (NIKOLI izmišljen dokument)', () => {
  it('OPOMNIK BREZ DATUMA ne nastaja dokumenta (družina: prazen seznam ne nastaja dokumenta) — pill komponente je viden samo ob datumu', () => {
    expect(() => buildOpomnikPdfDoc({ ...STRANKA, opomnikDatum: null as never }, { now: ZDANJ })).toThrow(TypeError)
    expect(() => buildOpomnikPdfDoc({ ...STRANKA, opomnikDatum: null as never }, { now: ZDANJ })).toThrow(/opomnik brez datuma ne nastaja dokumenta/)
    expect(() => buildOpomnikPdfDoc({ ...STRANKA, opomnikDatum: '2.10.2026' }, { now: ZDANJ })).toThrow(/opomnik brez datuma ne nastaja dokumenta/)
  })

  it('pokvarjena polja: prazno ime, prazen naslov, neznani status, negativen ltv, ne-celo št. projektov, negativen zaklenjeni — vzrok VEDNO v sporočilu', () => {
    expect(() => preveriOpomnikVnos({ ...STRANKA, ime: '  ' })).toThrow(/ime mora biti ne-prazen niz/)
    expect(() => preveriOpomnikVnos({ ...STRANKA, naslov: '' })).toThrow(/naslov mora biti ne-prazen niz/)
    expect(() => preveriOpomnikVnos({ ...STRANKA, opomnikStatus: 'NEZNAN' as never })).toThrow(/opomnikStatus mora biti eden iz/)
    expect(() => preveriOpomnikVnos({ ...STRANKA, ltv: -1 })).toThrow(/ltv mora biti končno ne-negativno/)
    expect(() => preveriOpomnikVnos({ ...STRANKA, skupajProjektov: 1.5 })).toThrow(/skupajProjektov mora biti celo število/)
    expect(() => preveriOpomnikVnos({ ...STRANKA, zaklenjeni: -2 })).toThrow(/zaklenjeni mora biti celo število/)
  })

  it('kontaktne inkonzistence: prazen niz NI null (pokvaren vir) — telefon/email/kontaktnaOseba/opomnikOpis = null ALI ne-prazen niz', () => {
    expect(() => preveriOpomnikVnos({ ...STRANKA, telefon: '' })).toThrow(/telefon mora biti null ALI ne-prazen niz/)
    expect(() => preveriOpomnikVnos({ ...STRANKA, email: '  ' })).toThrow(/email mora biti null ALI ne-prazen niz/)
    expect(() => preveriOpomnikVnos({ ...STRANKA, kontaktnaOseba: '' })).toThrow(/kontaktnaOseba mora biti null ALI ne-prazen niz/)
    expect(() => preveriOpomnikVnos({ ...STRANKA, opomnikOpis: '' })).toThrow(/opomnikOpis mora biti null ALI ne-prazen niz/)
    // null je VELJAVEN (iskren '—' v dokumentu)
    expect(() => preveriOpomnikVnos({ ...STRANKA, telefon: null, email: null, kontaktnaOseba: null, opomnikOpis: null, kategorija: null })).not.toThrow()
  })

  it('pokvarjene opcije: manjkajoč vnos / manjkajoč now / neveljaven now → TypeError (družinsko pravilo)', () => {
    expect(() => buildOpomnikPdfDoc(null as never, { now: ZDANJ })).toThrow(/pričakovana CRM stranka/)
    expect(() => buildOpomnikPdfDoc(STRANKA, null as never)).toThrow(/pričakovane opcije/)
    expect(() => buildOpomnikPdfDoc(STRANKA, { now: 'danes' as never })).toThrow(/pričakovan veljaven now/)
  })
})

describe('R251 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod + enak now = bajtno enak PDF (document-pdf R121 100× pravilo)', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    // drugačen now → drugačen CreationDate → drugačen dokument (žig je vsebinski)
    expect(zgradi(STRANKA, ZDANJ).equals(zgradi(STRANKA, new Date(2026, 8, 28, 15, 1, 0)))).toBe(false)
    // drugačen status → drugačen fileId seed → drugačen dokument
    expect(zgradi(STRANKA).equals(zgradi({ ...STRANKA, opomnikStatus: 'POTEKEL' }))).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh znanih družinskih razredov) + ime datoteke Opomnik-YYYY-MM-DD.pdf', () => {
    const buf = zgradi()
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    // znani razredi: Osnutek [30057,30119,30191,30253], primerjalni [35565,
    // 38753,39927,41519,42798], cenik [37709,37771], prihodki [36788] —
    // opomnik je NOV dokument
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788]
    expect(znani.includes(buf.length)).toBe(false)
    expect(opomnikPdfFilename(ZDANJ)).toBe('Opomnik-2026-09-28.pdf')
  })

  it('soli 0x65–0x68 — UNIKATNE v družini (isti seed v dveh libih NE sme dati isti ID — register)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x65)')
    expect(lib).toContain('fnv1aHex(seed, 0x68)')
    // sorojenci NE smejo deliti 0x65–0x68 (prihodki 0x61–64)
    expect(prihodkiLib).not.toContain('0x65')
    expect(prihodkiLib).not.toContain('0x68')
  })
})

describe('R251 — PDF telesu skozi izpeljavo (KPI trio + tabele + sklep iz ISTEGA vira)', () => {
  it('KPI trio: Status < Datum opomnika < Dni + signal barve (POTEKEL RED, AKTIVEN AMBER, NI NAVY — ISTI jezik kot badge; 0 novih hex)', () => {
    const kpi = oknoMed(lib, "kpiBox(doc, 14, y, bw, bh, 'Status'", 'y += bh + 8')
    expect(kpi).toContain("'Datum opomnika'")
    expect(kpi).toContain("'Dni'")
    expect(lib).toContain("if (s === 'POTEKEL') return RED")
    expect(lib).toContain("if (s === 'AKTIVEN') return AMBER")
    expect(lib).toContain('return NAVY')
    // dni KPI nosi PREK resnico z RED barvo
    expect(oknoMed(lib, "kpiBox(\n    doc,\n    14 + 2 * (bw + gap)", 'y += bh + 8')).toContain("'PREK' ? `prek ${dni.dni}`")
    expect(oknoMed(lib, "kpiBox(\n    doc,\n    14 + 2 * (bw + gap)", 'y += bh + 8')).toContain("'PREK' ? RED : NAVY")
  })

  it('tabele: Stranka (6 polj) + Naloga (opis/zadnji kontakt/stranka od) + Kontekst (LTV/Projektov/Zaklenjenih — vse REALNE resnice, NIČ placeholderjev)', () => {
    expect(lib).toContain("['Ime', vnos.ime.trim()]")
    expect(lib).toContain("['Naslov', vnos.naslov.trim()]")
    expect(lib).toContain("['Telefon', vnos.telefon ?? '—']")
    expect(lib).toContain("['Opis', 'Zadnji kontakt', 'Stranka od']")
    expect(lib).toContain("vnos.opomnikOpis ?? '—'")
    expect(lib).toContain("vnos.zadnjiKontakt ? cenikDatumIso(vnos.zadnjiKontakt) : '—'")
    expect(lib).toContain("[[vnos.ltv.toFixed(2), String(vnos.skupajProjektov), String(vnos.zaklenjeni)]]")
  })

  it('sklepni podpis pove ISKRENO resnico (status SI + dni + projekti + LTV + terenski list podpis)', () => {
    const sklep = oknoMed(lib, 'sklepna vrstica', 'noge na vseh straneh')
    expect(sklep).toContain('Opomnik za ponovni kontakt — ')
    expect(sklep).toContain('opomnikDniNiz(vnos, now)')
    expect(sklep).toContain('projektov, LTV ')
    expect(sklep).toContain('terenski list za obisk, odgovornost kontakta ostaja na timu')
  })
})

describe('R251 — komponenta: pill + legenda + dni resnica + toast (WYSIWYG, ENA resnica na treh mestih)', () => {
  it('pill: aria + title + press-scale token + FileDown (ISTI žetoni kot prihodki pill — 0 novih hex) + dvoklik guard', () => {
    expect(komponenta).toContain('aria-label="Pripravi opomnik kot PDF"')
    expect(komponenta).toContain('Terenski list za ponovni kontakt kot pravi PDF')
    expect(komponenta).toContain('disabled={opomnikVTeku}')
    expect(komponenta).toContain('if (opomnikVTeku || !selectedCustomer) return')
    const pill = oknoMed(komponenta, 'onClick={handleOpomnikPdf}', '</Button>')
    expect(pill).toContain('press-scale')
    expect(pill).toContain('<FileDown className="h-3.5 w-3.5"')
  })

  it('pill živi V opomniškem bloku (viden točno takrat, ko opomnikDatum obstaja) — brez pravice gate (P1-k precedens, bralni dokument)', () => {
    const blok = oknoMed(komponenta, '{/* Opomnik */}', '{/* Zadnji kontakt */}')
    expect(blok).toContain('selectedCustomer.opomnikDatum &&')
    expect(blok).toContain('aria-label="Pripravi opomnik kot PDF"')
    expect(blok).not.toContain('lahko')
  })

  it('dni resnica v bloku = ISTI opomnikDniNiz (ENA resnica za blok + toast + PDF) + tabular-nums žeton', () => {
    const blok = oknoMed(komponenta, '{/* Opomnik */}', '{/* Zadnji kontakt */}')
    expect(blok).toContain('opomnikDniNiz({ opomnikDatum: selectedCustomer.opomnikDatum }, new Date())')
    expect(blok).toContain('tabular-nums')
  })

  it('legenda imenuje ISTO izpeljavo (PDF = terenski list, Potekel = prek datuma) — žetoni text-2xs text-muted-foreground, JSX ohrani ·', () => {
    expect(komponenta).toContain('PDF = terenski list za obisk · Potekel = prek datuma')
  })

  it('toast nosi REALNO resnico (ime + dni iz opomnikDniNiz) — EN now za žig + ime + dni (determinizem R250)', () => {
    expect(komponenta).toContain('Opomnik prenešen v PDF')
    expect(komponenta).toContain('opomnikPdfFilename(now)')
    expect(komponenta).toContain('buildOpomnikPdfDoc(vnos, { now })')
    expect(komponenta).toContain('${selectedCustomer.ime} · ${opomnikDniNiz(vnos, now)}')
  })

  it('fail-closed poti: brez datuma → iskren toast; TypeError → viden razlog; status gre VERBATIM (NIČ izračunavanja v klientu)', () => {
    expect(komponenta).toContain("'Opomnik ni nastavljen'")
    expect(komponenta).toContain('PDF se izvozi, ko je vpisan datum opomnika.')
    expect(komponenta).toContain('Opomnik PDF ni mogoče sestaviti iz teh podatkov')
    expect(komponenta).toContain('opomnikStatus: selectedCustomer.opomnikStatus')
  })
})

describe('R251 — ločeni dokumenti se še naprej obrestujejo (družinska bajtna stabilnost)', () => {
  it('CRM CSV brat NEspremenjen (isti buildCrmCsv klic, stranke- ime, brez opomnikove libi)', () => {
    expect(komponenta).toContain('buildCrmCsv(')
    expect(komponenta).toContain('crmCsvFilename(')
    expect(crmCsvLib).not.toContain('opomnikDniNiz')
    expect(crmCsvLib).not.toContain('Opomnik-')
  })

  it('prihodki brat NE pozna opomnika (ločeni dokumenti — bajtna stabilnost nedotaknjena)', () => {
    expect(prihodkiLib).not.toContain('buildOpomnikPdfDoc')
    expect(prihodkiLib).not.toContain('Opomnik-')
    expect(prihodkiLib).not.toContain('opomnikDniNiz')
  })
})
