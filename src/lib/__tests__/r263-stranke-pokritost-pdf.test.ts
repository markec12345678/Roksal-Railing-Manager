// ---------------------------------------------------------------------------
// R263 — STRANKE — OPOMNIŠKA POKRITOST PDF (19. člen 'izvozi' družine, P1-f)
// — testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN
// VRSTNI RED = bajtno ENAK — sort interno, f(množica); %PDF- magija; NOV
// glifni razred — R249 doktrina) + presek-resnice (opomnikStatus VERBATIM iz
// API-ja — ⚠️ opomnikDatum > 7 dni v prihodnje ostane 'NI', lib NE trdi
// invariante o datumu; vrstica = slepa pika NE-arhivirana; arhivirane brez
// opomnika = poimenovan števec; pokritost % VEDNO definiran — strankN ≥ 1;
// sort LTV DESC + ime ASC + id ASC) + vsebinski dokazi na VIRU liba in
// komponente.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildStrankePokritostPdfDoc,
  strankePokritostPdfFilename,
  strankeOpomnikiPokritost,
  preveriStrankoVnos,
  type StrankaOpomnikVnos,
} from '@/lib/stranke-pokritost-pdf'
import { buildZalogaOsnutekPdfDoc } from '@/lib/zaloga-osnutek-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r257 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/stranke-pokritost-pdf.ts')
const komponenta = beri('src/components/roksal/crm-tab.tsx')
const crmCsvLib = beri('src/lib/crm-csv.ts')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-28T11:00:00.000Z')

// 4 stranke: Nina LTV 1000 brez opomnika (slepa pika), Bor LTV 3000 brez
// opomnika (najvrednejša slepa pika — akcijski red prvi), Cvetka LTV 2000
// z opomnikom (AKTIVEN — pokrita), Danica ARHIVIRANA brez opomnika (iskren
// odpad — brez vrstice, poimenovan števec).
const STRANKE: StrankaOpomnikVnos[] = [
  { id: 's-nina', ime: 'Nina Nova', naslov: 'Ulica 4', status: 'AKTIVEN', kategorija: 'Posameznik', telefon: '041 111 222', zadnjiKontakt: '2026-05-01T10:00:00.000Z', ltv: 1000, opomnikStatus: 'NI' },
  { id: 's-bor', ime: 'Bor Bor', naslov: 'Cesta 2', status: 'POTENCIALEN', kategorija: 'Podjetje', telefon: null, zadnjiKontakt: null, ltv: 3000, opomnikStatus: 'NI' },
  { id: 's-cvetka', ime: 'Cvetka Cvet', naslov: 'Trg 3', status: 'AKTIVEN', kategorija: null, telefon: '041 333 444', zadnjiKontakt: '2026-08-15T10:00:00.000Z', ltv: 2000, opomnikStatus: 'AKTIVEN' },
  { id: 's-danica', ime: 'Danica Dan', naslov: 'Kraj 5', status: 'ARHIVIRAN', kategorija: 'Drugo', telefon: null, zadnjiKontakt: null, ltv: 500, opomnikStatus: 'NI' },
]

function zgradi(
  stranke: readonly StrankaOpomnikVnos[] = STRANKE,
  now: Date = NOW,
): Buffer {
  const doc = buildStrankePokritostPdfDoc(stranke, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R263 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([STRANKE[3], STRANKE[1], STRANKE[0], STRANKE[2]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(STRANKE, new Date('2026-09-28T11:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 25 znanih družinskih razredov) + ime Stranke-opomniska-pokritost-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261]
    expect(znani).not.toContain(bin.length)
    expect(strankePokritostPdfFilename(NOW)).toBe('Stranke-opomniska-pokritost-2026-09-28.pdf')
  })

  it('soli 0x89–0x8c — UNIKATNE v družini (register: zaloga-osnutek 0x85–0x88 — bratje NE delijo semen; 0x89 v object-storage je PNG magija, NE salt)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x89)')
    expect(lib).toContain('fnv1aHex(seed, 0x8c)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x85)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x81)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x69)')
  })
})

describe('R263 — presek-resnice (ENA resnica za KPI + tabelo + sklep + mini-vrstico + toast)', () => {
  it('pokritost po opomnikStatus VERBATIM: NI (ne-arhivirana) = vrstica, AKTIVEN = pokrita, ARHIVIRANA NI = števec brez vrstice; % VEDNO definiran', () => {
    const { vrste, povzetek } = strankeOpomnikiPokritost(STRANKE)
    expect(vrste).toHaveLength(2) // Nina + Bor (Cvetka pokrita, Danica arhivirana)
    expect(vrste.map((v) => v.ime)).toEqual(['Bor Bor', 'Nina Nova']) // LTV DESC
    expect(povzetek.strankN).toBe(4)
    expect(povzetek.brezN).toBe(2)
    expect(povzetek.zOpomnikomN).toBe(1)
    expect(povzetek.potekliN).toBe(0)
    expect(povzetek.arhiviranihBrezN).toBe(1)
    expect(povzetek.pokritostOdstotek).toBeCloseTo(25, 9) // 1/4
    expect(povzetek.pokritostNiz).toBe('25,0')
  })

  it('POTEKEL šteje kot pokrit + poimenovan: potekliN raste, pokritost % ostane ISTA resnica (sekundarna resnica — svoj dokument R252)', () => {
    const pot = strankeOpomnikiPokritost(STRANKE.map((s) => (s.id === 's-cvetka' ? { ...s, opomnikStatus: 'POTEKEL' as const } : s)))
    expect(pot.povzetek.potekliN).toBe(1)
    expect(pot.povzetek.zOpomnikomN).toBe(1)
    expect(pot.povzetek.pokritostNiz).toBe('25,0')
    expect(pot.vrste).toHaveLength(2) // POTEKEL NE pride na seznam slepih pik
  })

  it('sort LTV DESC + izenačba ime ASC code-unit + id ASC (dva istonaslovna z ISTIM LTV = RAZLIČNI resnici po id — R260/R262 lekcija)', () => {
    const para: StrankaOpomnikVnos[] = [
      { id: 's-b', ime: 'Ista Firma', naslov: 'A 1', status: 'AKTIVEN', kategorija: null, telefon: null, zadnjiKontakt: null, ltv: 100, opomnikStatus: 'NI' },
      { id: 's-a', ime: 'Ista Firma', naslov: 'B 2', status: 'AKTIVEN', kategorija: null, telefon: null, zadnjiKontakt: null, ltv: 100, opomnikStatus: 'NI' },
      { id: 's-c', ime: 'Majhna', naslov: 'C 3', status: 'AKTIVEN', kategorija: null, telefon: null, zadnjiKontakt: null, ltv: 50, opomnikStatus: 'NI' },
    ]
    const { vrste } = strankeOpomnikiPokritost(para)
    expect(vrste.map((v) => v.id)).toEqual(['s-a', 's-b', 's-c']) // LTV enaka → ime enako → id ASC
    const obrnjeno = strankeOpomnikiPokritost([...para].reverse())
    expect(obrnjeno.vrste.map((v) => v.id)).toEqual(['s-a', 's-b', 's-c']) // f(MNOŽICA)
  })

  it('LTV 0 je resnica (vrstica obstaja) + necel LTV 2 decimalki; status labeli VERBATIM iz CRM_STATUS_LABELS (EN VIR crm-csv)', () => {
    const ena: StrankaOpomnikVnos[] = [
      { id: 's-x', ime: 'Zero Zero', naslov: 'N 1', status: 'NEAKTIVEN', kategorija: 'Stanovanjska skupnost', telefon: null, zadnjiKontakt: '2026-01-02T00:00:00.000Z', ltv: 0, opomnikStatus: 'NI' },
    ]
    const { vrste, povzetek } = strankeOpomnikiPokritost(ena)
    expect(vrste[0].status).toBe('Neaktiven') // ISTI label kot zaslon
    expect(vrste[0].ltv).toBe(0)
    expect(povzetek.pokritostNiz).toBe('0,0')
    const necel: StrankaOpomnikVnos[] = [
      { id: 's-y', ime: 'Necel Necel', naslov: 'N 2', status: 'AKTIVEN', kategorija: null, telefon: null, zadnjiKontakt: null, ltv: 123.455, opomnikStatus: 'NI' },
    ]
    expect(strankeOpomnikiPokritost(necel).vrste[0].ltv).toBeCloseTo(123.455, 9)
  })

  it('premešan vhod = ISTI povzetek (f(MNOŽICA)); pokritost % enaka ne glede na vrstni red odgovora', () => {
    const a = strankeOpomnikiPokritost(STRANKE).povzetek
    const b = strankeOpomnikiPokritost([STRANKE[2], STRANKE[3], STRANKE[0], STRANKE[1]]).povzetek
    expect(a).toEqual(b)
  })
})

describe('R263 — fail-closed v libu (družina R236/R250–R262)', () => {
  it('prazen seznam strank ne nastaja dokumenta — TypeError s toast sporočilom komponente; 0 slepih pik (vse pokrite) TUDI ne nastaja dokumenta', () => {
    expect(() => buildStrankePokritostPdfDoc([], { now: NOW })).toThrow(TypeError)
    expect(() => buildStrankePokritostPdfDoc([], { now: NOW })).toThrow('prazen seznam strank ne nastaja dokumenta')
    expect(() => strankeOpomnikiPokritost([])).toThrow('prazen seznam strank nima pokritosti')
    // vse pokrite → 0 vrstic → dokument ne nastaja (iskren pozitiven toast)
    const pokrite: StrankaOpomnikVnos[] = [
      { id: 's-1', ime: 'Pokrita Pokrita', naslov: 'P 1', status: 'AKTIVEN', kategorija: null, telefon: null, zadnjiKontakt: null, ltv: 10, opomnikStatus: 'AKTIVEN' },
    ]
    expect(() => buildStrankePokritostPdfDoc(pokrite, { now: NOW })).toThrow(TypeError)
    expect(() => buildStrankePokritostPdfDoc(pokrite, { now: NOW })).toThrow('brez slepih pik ne nastaja dokumenta')
  })

  it('fail-closed ×11: ne-polje, ne-options, pokvaren now, ne-objekt, prazno ime, prazen naslov, neznan status, neznan opomnikStatus, NaN ltv, negativen ltv, prazna kategorija — indeks krivca', () => {
    const now = { now: NOW }
    expect(() => buildStrankePokritostPdfDoc('ne-polje' as unknown as StrankaOpomnikVnos[], now)).toThrow(TypeError)
    expect(() => buildStrankePokritostPdfDoc(STRANKE, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildStrankePokritostPdfDoc(STRANKE, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildStrankePokritostPdfDoc(STRANKE, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => preveriStrankoVnos(null as unknown as StrankaOpomnikVnos, 2)).toThrow('pričakovana CRM stranka')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], ime: '  ' }, 2)).toThrow('ime mora biti ne-prazen niz')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], naslov: '' }, 2)).toThrow('naslov mora biti ne-prazen niz')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], status: 'TUPI' }, 2)).toThrow('status mora biti eden iz')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], opomnikStatus: 'MAYBE' as unknown as 'NI' }, 2)).toThrow('opomnikStatus mora biti eden iz')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], ltv: NaN }, 2)).toThrow('ltv mora biti končno ne-negativno')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], ltv: -1 }, 2)).toThrow('ltv mora biti končno ne-negativno')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], kategorija: ' ' }, 2)).toThrow('kategorija mora biti null ALI ne-prazen niz')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], telefon: '' }, 2)).toThrow('telefon mora biti null ALI ne-prazen niz')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], zadnjiKontakt: 'ponedeljek' }, 2)).toThrow('zadnjiKontakt mora biti null ALI ISO niz')
    expect(() => preveriStrankoVnos({ ...STRANKE[0], id: '' }, 2)).toThrow('id mora biti ne-prazen niz')
  })

  it('EN VIR dokazi: CRM_STATUS_LABELS iz crm-csv (nič dvojnega seznama); brat R262 NESPREMENJEN (soli 0x85–0x88 + bajtno zdrav)', () => {
    expect(lib).toContain("import { CRM_STATUS_LABELS } from './crm-csv'")
    expect(crmCsvLib).toContain("AKTIVEN: 'Aktiven',")
    const r262Lib = beri('src/lib/zaloga-osnutek-pdf.ts')
    expect(r262Lib).toContain('fnv1aHex(seed, 0x85)')
    expect(r262Lib).not.toContain('fnv1aHex(seed, 0x89)')
    // brat R262 z ISTIMI vhodi = bajtno zdrav (dvojni bajtni dokaz — R260 vzorec)
    const doc = buildZalogaOsnutekPdfDoc(
      [{ id: 'a', sifraMateriala: 'S', naziv: 'N', kolicinaZaloga: 1, enota: 'kos', minimalnaZaloga: 5 }],
      [{ status: 'OSNUTEK', items: [{ inventoryId: 'a', kolicina: 2 }] }],
      { now: NOW },
    )
    expect(Buffer.from(doc.output('arraybuffer')).subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('R263 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 7 stolpcev (Stranka, Naslov, Status, Kategorija, Telefon, Zadnji kontakt, LTV (EUR)) — head dobesedno', () => {
    expect(lib).toContain("['Stranka', 'Naslov', 'Status', 'Kategorija', 'Telefon', 'Zadnji kontakt', 'LTV (EUR)']")
  })

  it('status barvna resnica: Aktiven GREEN bold, Potencialen AMBER bold, Neaktiven GRAY; \'—\' sivo (iskrena null resnica)', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain("label === 'Aktiven'")
    expect(okno).toContain('textColor = GREEN')
    expect(okno).toContain("label === 'Potencialen'")
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain("label === 'Neaktiven'")
    expect(okno).toContain('textColor = GRAY')
  })

  it('KPI 5 boxov z signalnim jezikom (Brez opomnika rdeče pri > 0, Z opomnikom zeleno, Poteklih rdeče pri > 0, Pokritost 100 GREEN / pod AMBER)', () => {
    expect(lib).toContain("'Strank'")
    expect(lib).toContain("'Brez opomnika'")
    expect(lib).toContain("'Z opomnikom'")
    expect(lib).toContain("'Poteklih'")
    expect(lib).toContain("'Pokritost (%)'")
    expect(lib).toContain("povzetek.brezN > 0 ? RED : NAVY")
    expect(lib).toContain("povzetek.potekliN > 0 ? RED : NAVY")
    expect(lib).toContain("povzetek.pokritostOdstotek >= 100 ? GREEN : AMBER")
  })

  it('sklep: izključitve poimenovane (arhiviranih brez opomnika — zaprt primer; poteklih — svoj dokument) — iskren podpis', () => {
    expect(lib).toContain('arhiviranih brez opomnika')
    expect(lib).toContain('brez vrstice — zaprt primer')
    expect(lib).toContain('svoj dokument: Potekli opomniki')
    expect(lib).toContain('akcijski red: najvrednejše prve')
  })

  it('glava STRANKE — OPOMNIŠKA POKRITOST + osveženo + noge Stran i/N', () => {
    expect(lib).toContain("'STRANKE — OPOMNIŠKA POKRITOST'")
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
  })

  it('brez locale-odvisnih APIjev (determinizem čez pasove/stroje)', () => {
    expect(lib).not.toContain('localeCompare')
    expect(lib).not.toContain('toLocaleString')
    expect(lib).not.toContain('toLocaleDateString')
  })

  it('NIČ mreže v libu (client-only resnica; route NIČ; R259 lekcija 2 — ne-lovi komentarjev)', () => {
    expect(lib).not.toContain('fetch(')
    expect(lib).not.toContain("from 'node:crypto'")
    expect(lib).not.toContain("require('node:crypto')")
  })
})

describe('R263 — komponenta (crm-tab) — pill, legenda, handler, mini-vrstica', () => {
  it('pill VEDNO viden (bralni dokument, P1-k precedens) + press-scale + Bell aria-hidden + dvoklik guard — pariteta R252/R253', () => {
    const okno = oknoMed(komponenta, 'onClick={handlePokritostPdf}', '</Button>')
    expect(okno).toContain('press-scale')
    expect(okno).toContain('Bell')
    expect(okno).toContain('aria-hidden="true"')
    expect(okno).toContain('disabled={pokritostVTeku}')
    expect(okno).toContain('focus-visible:ring-2')
  })

  it('legenda substring-parna nadgradna (R260 lekcija 3): stara R252 resnica dobesedno + nova R263 append — NIČ starega pina zlomljenega', () => {
    expect(komponenta).toContain('CSV = prikazani seznam · PDF = potekli opomniki (akcija) · Potekel = prek datuma · Koledar = vsi vpisani pregledi (časovna vrsta)')
    expect(komponenta).toContain('· Pokritost = stranke × opomnikStatus (slepe pike = brez datuma)')
  })

  it('handler: ENA izpeljava strankeOpomnikiPokritost za toast (≥ 2 klici — WYSIWYG), EN now, fail-closed toasta (0 strank / 0 slepih pik), TypeError viden razlog, dvoklik guard', () => {
    const okno = oknoMed(komponenta, 'const handlePokritostPdf', 'const handleExportCsv')
    expect(okno).toContain('if (pokritostVTeku) return')
    expect(okno).toContain("title: 'Ni strank v CRM'")
    expect(okno).toContain("'PDF se izvozi, ko je dodana prva stranka.'")
    expect(okno).toContain("title: 'Vse stranke imajo vpisan opomnik'")
    expect(okno).toContain("'PDF se izvozi, ko ostane kaka stranka brez vpisanega pregleda.'")
    expect(okno).toContain('buildStrankePokritostPdfDoc(pokritostVhodi, { now })')
    expect(okno).toContain('strankePokritostPdfFilename(now)')
    expect(okno).toContain("title: 'Pokritost opomnikov prenešena v PDF'")
    expect(okno).toContain("variant: 'destructive'")
    expect((komponenta.match(/strankeOpomnikiPokritost\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('DTO pruning iz ISTEGA customers state-a (NIČ nove mreže) + memo + opomnikStatus VERBATIM passthrough + id identiteta', () => {
    expect(komponenta).toContain('id: c.id')
    expect(komponenta).toContain('opomnikStatus: c.opomnikStatus')
    expect(komponenta).toContain('ltv: c.ltv')
    expect(komponenta).toContain('useMemo')
    expect(komponenta).toContain('customers.length > 0 ? strankeOpomnikiPokritost(pokritostVhodi).povzetek : null')
  })

  it('F2 mini-vrstica Pokritost opomnikov: WYSIWYG ISTA izpeljava + kondicionalni žig brez-opomnika (R256 lekcija 4) + žetoni 0 novih hex', () => {
    expect(komponenta).toContain('Pokritost opomnikov:')
    expect(komponenta).toContain('brez vpisanega opomnika · pokritost')
    const okno = oknoMed(komponenta, 'R263 — F2 pokritostna mini-vrstica', '</div>\n      )}\n\n      {/* R178')
    expect(okno).toContain("pokritostPovzetek.brezN > 0 ? 'bg-roksal-red' : 'bg-roksal-green'")
    expect(okno).toContain('border-roksal-red/40')
    expect(okno).toContain('bg-roksal-red/10')
    expect(okno).toContain('text-roksal-red')
  })

  it('0 novih hex (žetoni samo — družinsko pravilo R224–R262)', () => {
    const hexi = komponenta.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    const znani = new Set(['2a3f5f', '1d2b3e'])
    for (const h of hexi) expect(znani.has(h.slice(1).toLowerCase())).toBe(true)
  })
})
