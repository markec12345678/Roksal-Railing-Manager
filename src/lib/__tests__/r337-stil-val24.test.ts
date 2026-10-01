// R337 — MANDATORY STIL val 24 (r162/…/R336 vzorec): AI raba pregled CSV
// pill (64. člen — vodja blok glava, ZADNJI vodja dokazni blok dobi izvoz).
// ---------------------------------------------------------------------------
//  • pill = amber/50 družina (ISTI žeton kot končna verifikacija CSV pill —
//    byte-paritet className VRSTICA; gumb JE v vodja-dashboard datoteki →
//    amber/50 register ×10 → ×11, val8 drevo 69 → 70);
//  • taktilni žeton press-scale (val9 vzorec) — vodja register 17 → 18;
//  • oči para: FileSpreadsheet aria-hidden (CSV brat družina
//    R323/R334/R335/R336);
//  • definicijski naslov medija (title) + legenda medija (starejši podpisi
//    NEPREMIKNJENI);
//  • EN VIR žeton: handler poda že IZRISANI pregled (aiRabaCsv(aiRaba) —
//    zaslon in CSV NE moreta divergirati);
//  • obrnjena regresija: val 23 navy/40 pill ŽIVA + val 22 PAR ŽIVA + val 21
//    TRIADA ŽIVA + globals .press-scale ŽIV + 0 surovih barv na novi pill
//    (0-hex kanon val 15–23);
//  • register sodelovanje: val8 (70 + amber ×12 [R355]) + val9 (19 taktilnih [R355]) +
//    val23 (×19 [R355]) pini shiftani V ENI rundi (LEKCIJA R334 5).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const KARTICA = join(process.cwd(), 'src/components/roksal/sistem-zdravje-card.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')
const VAL8 = join(process.cwd(), 'src/lib/__tests__/r317-stil-val8.test.ts')
const VAL9 = join(process.cwd(), 'src/lib/__tests__/r318-stil-val9.test.ts')
const VAL23 = join(process.cwd(), 'src/lib/__tests__/r336-stil-val23.test.ts')

const vodja = readFileSync(VODJA, 'utf8')
const kartica = readFileSync(KARTICA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')
const val8 = readFileSync(VAL8, 'utf8')
const val9 = readFileSync(VAL9, 'utf8')
const val23 = readFileSync(VAL23, 'utf8')

/** Okno vrstic okoli iskanega niza (ISTA ekstrakcija kot val8 STRAŽAR). */
function oknoOkoli(vir: string, iskalni: string): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(iskalni))
  if (i < 0) return ''
  return vrstice.slice(Math.max(0, i - 8), i + 6).join('\n')
}

describe('r337 STIL val 24 — AI raba pregled CSV pill: amber/50 družina + taktilna + a11y', () => {
  it('pill viden: aria + testid + FileSpreadsheet aria-hidden (oči para CSV bratov) + brez spinnerja', () => {
    const gumb = oknoOkoli(vodja, 'aria-label="Izvozi pregled AI rabe kot CSV"')
    expect(gumb).toContain('data-testid="ai-raba-csv-pill"')
    expect(gumb).toContain('<FileSpreadsheet className="h-3 w-3" aria-hidden="true" />')
    expect(gumb).toContain('variant="outline"')
    expect(gumb).toContain('onClick={exportAiRabaCsv}')
  })

  it('amber/50 ring token — byte-paritet className VRSTICA z končno verifikacijo CSV pill (R334 vzorec)', () => {
    const novGumb = oknoOkoli(vodja, 'aria-label="Izvozi pregled AI rabe kot CSV"')
    const bratGumb = oknoOkoli(vodja, 'aria-label="Izvozi poročilo končne verifikacije kot CSV"')
    // className VRSTICA, ne okno (LEKCIJA R336 2: komentarji omenjajo
    // register, NE stil — pariteta mora biti stil-bajtna)
    const novRazred = novGumb.split('\n').find((v) => v.includes('className='))
    const bratRazred = bratGumb.split('\n').find((v) => v.includes('className='))
    expect(novRazred).toBeTruthy()
    expect(novRazred).toBe(bratRazred)
    // ISTI žeton: amber/50 focus ring + press-scale taktilni
    expect(novRazred).toContain('press-scale')
    expect(novRazred).toContain('focus-visible:ring-roksal-amber/50')
  })

  it('taktilni register ×18 (val9 sodelovanje — PIN SHIFT 17 → 18, LEKCIJA R334 5: V ENI rundi)', () => {
    const gumb = oknoOkoli(vodja, 'aria-label="Izvozi pregled AI rabe kot CSV"')
    expect(gumb).toContain('press-scale')
    // R355: 18 → 19 (KATALOG pill — 65. člen)
    expect(vodja.split('press-scale').length - 1).toBe(19)
  })

  it('definicijski naslov medija (title) — ista resnica + determinizem + Excel razlika medija', () => {
    const gumb = oknoOkoli(vodja, 'aria-label="Izvozi pregled AI rabe kot CSV"')
    expect(gumb).toContain('title="Izvozi pregled AI rabe')
    expect(gumb).toContain('isti katalog = bajtno identična datoteka')
    expect(gumb).toContain('Excel za arhiv in filtriranje po modulu/statusu')
  })

  it('legenda medija ŽIVA + starejši podpisi NEPREMIKNJENI (blok naslov + sklep ostajata)', () => {
    expect(vodja).toContain(
      'AI raba CSV = ista resnica kot zaslon (isti katalog = bajtno identična datoteka — Excel za arhiv in filtriranje).',
    )
    expect(vodja).toContain('data-testid="ai-raba-sklep"')
    expect(vodja).toContain('AI raba — iskrena resnica')
  })

  it('EN VIR žeton: handler poda že IZRISANI pregled (aiRabaCsv(aiRaba)) — zaslon in CSV NE moreta divergirati', () => {
    expect(vodja).toContain("from '@/lib/ai-raba-csv'")
    expect(vodja).toContain('const csv = aiRabaCsv(aiRaba)')
    expect(vodja).toContain('a.download = aiRabaCsvFilename()')
  })

  it('obrnjena regresija: val 23 navy/40 ŽIVA (kartica) + val 22 PAR ŽIVA + val 21 TRIADA ŽIVA + globals .press-scale ŽIV', () => {
    // val 23: sistem zdravje pill ŠE VEDNO navy/40 v kartici (brez amber)
    const zdravjeGumb = oknoOkoli(kartica, 'aria-label="Izvozi sistem zdravje kot CSV"')
    expect(zdravjeGumb).toContain('data-testid="sistem-zdravje-csv-pill"')
    expect(zdravjeGumb).toContain('focus-visible:ring-roksal-navy/40')
    // val 22 + val 21: mesečni PAR + končna TRIADA v vodji
    expect(vodja).toContain('data-testid="vodja-mesecni-csv-pill"')
    expect(vodja).toContain('data-testid="koncna-verifikacija-csv-pill"')
    // globals anti-stale
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
  })

  it('register sodelovanje: val8 (70 + amber ×12) + val9 (19) + val23 (19) — vsi čez-valovni pini shiftani V ENI rundi + 0-hex', () => {
    expect(val8).toContain('R337 PIN SHIFT 69 → 70')
    // R355: val8 amber pin 11 → 12 (KATALOG pill — 65. člen)
    expect(val8).toContain('vodjaAmber.length).toBe(12)')
    // R355: križni pini 18 → 19 (KATALOG pill — oba registrska testa posodobljena V ENI rundi, LEKCIJA R334 5)
    expect(val9).toContain('expect(pojavitve).toBe(19)')
    expect(val23).toContain('expect(vodja.split(\'press-scale\').length - 1).toBe(19)')
    // 0 surovih barv na novi pill (0-hex kanon)
    const gumb = oknoOkoli(vodja, 'aria-label="Izvozi pregled AI rabe kot CSV"')
    expect(gumb).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
