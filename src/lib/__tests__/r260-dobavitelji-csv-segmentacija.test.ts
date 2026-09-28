// R260 (P1-f nadgradna CSV brata, 'izvozi' družina — 16. člen po štetju
// nadgraden) — DOBAVITELJI CSV SEGMENTACIJA popust/dobavniRok iz ISTEGA DTO:
//  • ENA izpeljava `dobaviteljiSegmentacija` = CSV stolpca 10/11 (DA/NE) +
//    zaslonski žig na kartici + komponentni toast agregat — ni izračuna
//    drugje;
//  • DVOPROHODNI izračun (MIN/MAX nato filter) = f(MNOŽICA) po konstrukciji
//    (premešan vhod → bajtno ISTI rezultat — R258 lekcija 1 najmočnejša
//    oblika);
//  • nosilci po IDENTITETI referenc (ne nazivi — dva istonažna dobavitelja
//    z različnim rokom sta RAZLIČNI resnici);
//  • CSV kontrakt R233: stolpci 1–9 NESPREMENJENI (append-only, R232
//    'Pretekel rok' vzorec); toast pove realni agregat (R248 lekcija);
//    zaslonski žig 'največji popust' SAMO kadar največji > 0.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildDobaviteljiPdfDoc,
  dobaviteljiSegmentacija,
  type DobaviteljPdfVnos,
} from '@/lib/dobavitelji-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const lib = beri('src/lib/dobavitelji-pdf.ts')
const komponenta = beri('src/components/roksal/material-intelligence-tab.tsx')

function dob(naziv: string, rok: number, aktivna = true, popust = 0): DobaviteljPdfVnos {
  return { naziv, aktivna, kontakt: null, telefon: null, email: null, dobavniRok: rok, popust }
}

function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

// okno funkcije downloadSuppliersCsv (r233 vzorec okna)
function csvOkno(): string {
  return oknoMed(komponenta, 'function downloadSuppliersCsv', '// R207 — stil statusnega filtra')
}

describe('R260 — dobaviteljiSegmentacija (ENA izpeljava segmentov)', () => {
  it('agregatna resnica — 3 dobavitelji (rok 5/12/7, popust 0/3/0): najhitrejši 5 (Alu-Mont), največji popust 3 (Plesk)', () => {
    const alu = dob('Alu-Mont', 5, true, 0)
    const plesk = dob('Plesk', 12, true, 3)
    const ceving = dob('Ceving', 7, true, 0)
    const seg = dobaviteljiSegmentacija([alu, plesk, ceving])
    expect(seg.najhitrejsi).toBe(5)
    expect(seg.najhitrejsiVnosi).toHaveLength(1)
    expect(seg.najhitrejsiVnosi[0]).toBe(alu)
    expect(seg.najvecjiPopust).toBe(3)
    expect(seg.najvecjiPopustVnosi).toHaveLength(1)
    expect(seg.najvecjiPopustVnosi[0]).toBe(plesk)
  })

  it('fail-closed: prazen seznam → TypeError (komponenta pokaže iskren toast)', () => {
    expect(() => dobaviteljiSegmentacija([])).toThrow(TypeError)
    expect(() => dobaviteljiSegmentacija([])).toThrow(/prazen seznam ne nastaja segmentov/)
    expect(() => dobaviteljiSegmentacija(null as unknown as DobaviteljPdfVnos[])).toThrow(TypeError)
    expect(() => dobaviteljiSegmentacija(undefined as unknown as DobaviteljPdfVnos[])).toThrow(TypeError)
  })

  it('en sam dobavitelj — je edini nosilec OBIH segmentov (trivialna resnica ni utišana)', () => {
    const solo = dob('Solo Dobavitelj', 9, true, 2)
    const seg = dobaviteljiSegmentacija([solo])
    expect(seg.najhitrejsi).toBe(9)
    expect(seg.najvecjiPopust).toBe(2)
    expect(seg.najhitrejsiVnosi[0]).toBe(solo)
    expect(seg.najvecjiPopustVnosi[0]).toBe(solo)
  })

  it('izenačba MNOŽICA: vsi nosilci MIN roka so VSI v najhitrejsiVnosi (nikoli izmišljen ednina)', () => {
    const a = dob('Brdo', 6, true, 0)
    const b = dob('Ceving', 6, true, 1)
    const c = dob('Alu-Mont', 11, true, 0)
    const seg = dobaviteljiSegmentacija([a, b, c])
    expect(seg.najhitrejsi).toBe(6)
    expect(seg.najhitrejsiVnosi).toHaveLength(2)
    expect(seg.najhitrejsiVnosi[0]).toBe(a)
    expect(seg.najhitrejsiVnosi[1]).toBe(b)
    expect(seg.najvecjiPopust).toBe(1)
    expect(seg.najvecjiPopustVnosi[0]).toBe(b)
  })

  it('izenačba MNOŽICA popusta: trije nosilci MAX popusta vsi izpostavljeni', () => {
    const a = dob('A', 5, true, 4)
    const b = dob('B', 9, true, 4)
    const c = dob('C', 12, true, 4)
    const seg = dobaviteljiSegmentacija([a, b, c])
    expect(seg.najvecjiPopust).toBe(4)
    expect(seg.najvecjiPopustVnosi).toHaveLength(3)
  })

  it('f(MNOŽICA): premešan vhod da ISTI rezultat (dvoprohodni izračun — nič odvisnosti od vrstnega reda)', () => {
    const a = dob('Alu-Mont', 5, true, 0)
    const b = dob('Plesk', 12, true, 3)
    const c = dob('Ceving', 7, true, 0)
    const naraven = dobaviteljiSegmentacija([a, b, c])
    const premesan = dobaviteljiSegmentacija([c, a, b])
    const obrnjen = dobaviteljiSegmentacija([b, c, a])
    const oblika = (s: ReturnType<typeof dobaviteljiSegmentacija>) => ({
      najhitrejsi: s.najhitrejsi,
      najhitrejsiNazivi: s.najhitrejsiVnosi.map((v) => v.naziv).sort(),
      najvecjiPopust: s.najvecjiPopust,
      najvecjiPopustNazivi: s.najvecjiPopustVnosi.map((v) => v.naziv).sort(),
    })
    expect(oblika(premesan)).toEqual(oblika(naraven))
    expect(oblika(obrnjen)).toEqual(oblika(naraven))
  })

  it('identiteta referenc: nosilci so ISTI vhodni vnosi (ne kopije, ne nazivna ločila)', () => {
    const x = dob('Isti Naziv', 5, true, 0)
    const y = dob('Isti Naziv', 12, true, 0)
    const seg = dobaviteljiSegmentacija([x, y])
    // istonažna dobavitelja z različnim rokom sta RAZLIČNI resnici —
    // samo x je nosilec najhitrejšega roka (nazivna izenačba NE razlikuje ju)
    expect(seg.najhitrejsi).toBe(5)
    expect(seg.najhitrejsiVnosi).toHaveLength(1)
    expect(seg.najhitrejsiVnosi[0]).toBe(x)
    // oba imata popust 0 → oba nosilca največjega popusta (mehanična DA/NE)
    expect(seg.najvecjiPopust).toBe(0)
    expect(seg.najvecjiPopustVnosi).toHaveLength(2)
  })

  it('ne-celo povprečje ne obstaja v segmentih — samo MIN/MAX ostanejo celi iz vhoda (5.5 rok je resnica vhoda)', () => {
    const seg = dobaviteljiSegmentacija([dob('Pol', 5, true, 0), dob('Pol Drug', 6, true, 2)])
    expect(seg.najhitrejsi).toBe(5)
    expect(seg.najvecjiPopust).toBe(2)
  })

  it('čista f(vhoda): poklicana dvakrat → nov objekt, ISTA vsebina (brez stranskih učinkov)', () => {
    const vhod = [dob('A', 3, true, 1), dob('B', 8, true, 5)]
    const s1 = dobaviteljiSegmentacija(vhod)
    const s2 = dobaviteljiSegmentacija(vhod)
    expect(s1).not.toBe(s2)
    expect(s1.najhitrejsi).toBe(s2.najhitrejsi)
    expect(s1.najvecjiPopust).toBe(s2.najvecjiPopust)
    // vhod NI mutiran (dvoprohodni filter ne piše po vhodu)
    expect(vhod).toHaveLength(2)
    expect(vhod[0].dobavniRok).toBe(3)
  })

  it('lib: NIČ locale APIjev (code-unit resnica — R257 lekcija 4)', () => {
    expect(lib).not.toContain('localeCompare')
    expect(lib).not.toContain('Intl.')
  })
})

describe('R260 — CSV nadgradna (append-only, kontrakt R233 stolpci 1–9 NESPREMENJENI)', () => {
  it('CSV glava 11 stolpcev: kontrakt 1–9 + NOVA segmenta 10/11 na koncu (R232 append-only vzorec)', () => {
    const fn = csvOkno()
    expect(fn).toContain("'Najhitrejši rok', 'Največji popust']")
    // append-only: novi stolpci ZA 'Št. naročil', ne pred (indeks resnica)
    const stNarocil = fn.indexOf("'Št. naročil'")
    const najhitrejsi = fn.indexOf("'Najhitrejši rok'")
    const najvecji = fn.indexOf("'Največji popust'")
    expect(stNarocil).toBeGreaterThan(-1)
    expect(najhitrejsi).toBeGreaterThan(stNarocil)
    expect(najvecji).toBeGreaterThan(najhitrejsi)
  })

  it('DA/NE po IDENTITETI referenc (v === s) — ne po nazivu (dva istonažna = različni resnici)', () => {
    const fn = csvOkno()
    expect(fn).toContain("seg.najhitrejsiVnosi.some((v) => v === s) ? 'DA' : 'NE'")
    expect(fn).toContain("seg.najvecjiPopustVnosi.some((v) => v === s) ? 'DA' : 'NE'")
  })

  it('seg pride IZRECEN argument (pogodba kot danas pri jeZamujenaDobava — ENA izpeljava klicatelja)', () => {
    const fn = csvOkno()
    expect(fn).toContain('function downloadSuppliersCsv(suppliers: Supplier[], seg: DobaviteljiSegmentacija)')
  })

  it('kontrakt R233 celice 1–9 dobesedno NESPREMENJENI (zgodovinska resnica vrstice)', () => {
    const fn = csvOkno()
    expect(fn).toContain("s.aktivna ? 'Aktiven' : 'Neaktiven'")
    expect(fn).toContain("s.kontakt ?? ''")
    expect(fn).toContain('String(s.dobavniRok)')
    expect(fn).toContain("s._count ? String(s._count.materialPrices) : ''")
    expect(fn).toContain("s._count ? String(s._count.orders) : ''")
    expect(fn).toContain('`Dobavitelji-${todayStamp()}.csv`')
  })

  it('handler: seg izračunan ENkrat per akcijo — ISTA referenca za CSV IN toast (R259 vzorec)', () => {
    const fn = oknoMed(komponenta, 'const handleSuppliersCsv = () => {', "// R257 (P1-f, 13. člen)")
    expect(fn).toContain('const seg = dobaviteljiSegmentacija(suppliers)')
    expect((fn.match(/dobaviteljiSegmentacija\(suppliers\)/g) ?? []).length).toBe(1)
    expect(fn).toContain('downloadSuppliersCsv(suppliers, seg)')
  })

  it('handler: toast pove REALNI agregat (R248 lekcija) — najhitrejši rok + največji popust + sklanjatev', () => {
    const fn = oknoMed(komponenta, 'const handleSuppliersCsv = () => {', "// R257 (P1-f, 13. člen)")
    expect(fn).toContain('CSV prenesen — ${count} ${dobaviteljBeseda(count)}')
    expect(fn).toContain('Dobavitelji-…csv — najhitrejši rok ${seg.najhitrejsi} dni, največji popust ${seg.najvecjiPopust} %.')
  })

  it('handler: fail-closed (loading + 0 → iskren toast) + fail-verbose (TypeError → viden razlog) NESPREMENJENA', () => {
    const fn = oknoMed(komponenta, 'const handleSuppliersCsv = () => {', "// R257 (P1-f, 13. člen)")
    expect(fn).toContain('if (loading) return')
    expect(fn).toContain('if (suppliers.length === 0)')
    expect(fn).toContain("'Ni dobaviteljev za izvoz'")
    expect(fn).toContain("Izvoz CSV ni uspel")
    expect(fn).toContain("variant: 'destructive'")
  })
})

describe('R260 — WYSIWYG zaslon (segmentni žigi = ISTA resnica kot CSV 10/11)', () => {
  it('zaslon: segZaslon iz ISTEGA liba (ENA izpeljava — natanko dve klicni točki: handler + zaslon)', () => {
    expect(komponenta).toContain('const segZaslon = dobaviteljiSegmentacija(suppliers)')
    expect((komponenta.match(/dobaviteljiSegmentacija\(suppliers\)/g) ?? []).length).toBe(2)
  })

  it('žig najhitrejši rok — VEDNO ko je nosilec (roko resnica nič ne utiša)', () => {
    expect(komponenta).toContain('najhitrejši rok</Badge>')
    expect(komponenta).toContain('segZaslon.najhitrejsiVnosi.includes(sup)')
  })

  it('žig največji popust — SAMO kadar največji > 0 (maksimum ničnih ni izpostavljanje — nič izmišljenega)', () => {
    expect(komponenta).toContain('največji popust</Badge>')
    expect(komponenta).toContain('segZaslon.najvecjiPopust > 0 && segZaslon.najvecjiPopustVnosi.includes(sup)')
  })

  it('žigi brez novih hex (želona pariteta — roksal-green žetoni, 0 stone)', () => {
    const fn = oknoMed(komponenta, 'segZaslon.najhitrejsiVnosi.includes(sup)', 'največji popust</Badge>')
    expect(fn).not.toMatch(/#[0-9a-fA-F]{6}\b/)
    expect(fn).toContain('bg-roksal-green/10')
    expect(fn).toContain('text-roksal-green')
  })

  it('legenda R260: stara resnica R259 dobesedno ohranjena + segmentacija append (append-only legenda)', () => {
    expect(komponenta).toContain('CSV = vrstica per dobavitelj · PDF = arhivski pregled z povprečnim in najhitrejšim dobavnim rokom')
    expect(komponenta).toContain('· CSV nosi segmentacijo (najhitrejši rok · največji popust)')
    expect(komponenta).toContain('aria-label="Legenda izvoza dobaviteljev"')
  })
})

describe('R260 — PDF brat NESPREMENJEN (R236/R259 kontrakt — bajtna determinizem ostaja)', () => {
  it('fileId seed R236 kontrakt ostaja: naziv/aktivna/dobavniRok+popust + soli 0x21–0x24', () => {
    expect(lib).toContain('`${s.naziv.trim()}:${s.aktivna ? 1 : 0}/${s.dobavniRok}+${s.popust}`')
    expect(lib).toContain('fnv1aHex(seed, 0x21)')
    expect(lib).toContain('fnv1aHex(seed, 0x24)')
  })

  it('PDF tabela ostaja 9 stolpcev (segmenti so CSV/zaslon/toast resnica — PDF kontrakt negre na poseg)', () => {
    expect(lib).toContain("head: [['Naziv', 'Status', 'Kontakt', 'Telefon', 'Email', 'Dobavni rok (dni)', 'Popust (%)', 'Št. cen', 'Št. naročil']]")
  })

  it('PDF bralni dokument ostane brez pravice gate (segmentacija NIKOLI ne zahteva nove mreže — route NIČ)', () => {
    // višja raven: komponenta ne doda fetch klicev za segmentacijo (ISTI DTO)
    const sup = oknoMed(komponenta, 'const handleSuppliersCsv = () => {', '// R257 (P1-f, 13. člen)')
    expect(sup).not.toContain('fetch(')
  })

  it('bajtni determinizem PDF: enak vhod = bajtno enak dokument (segmentacija NE piše v PDF)', () => {
    const vhod = [dob('Alu-Mont', 5, true, 0), dob('Plesk', 12, true, 3)]
    const ZDANJ = new Date('2026-09-28T12:00:00.000Z')
    const a = Buffer.from(buildDobaviteljiPdfDoc(vhod, { now: ZDANJ }).output('arraybuffer'))
    const b = Buffer.from(buildDobaviteljiPdfDoc(vhod, { now: ZDANJ }).output('arraybuffer'))
    expect(a.equals(b)).toBe(true)
    expect(a.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})
