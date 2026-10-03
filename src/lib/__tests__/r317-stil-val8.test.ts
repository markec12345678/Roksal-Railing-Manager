// R317 — MANDATORY STIL val 8 (r162/…/R316 vzorec): IZVOZNA družina gumbov —
// focus-visible ring harmonizacija na roksal žetone.
//
// Motiv (sweep R317, 53 gumbov): ui/button BAZA nosi generičen
// focus-visible:ring-ring/50 — vsak gumb JE ima ring, IZVOZNA družina pa
// NOSI IZRECNE roksal žetone (49× navy/40; 2× amber/50 + offset — novi vodja
// gumbi R316 JSON + R317 CSV, bratska simetrija v isti blok glavi). Pred
// R317: site-survey PDF gumb je edini brez izrecnega žetona (speto na
// generično bazo) → harmoniziran na družinski kanon navy/40.
//
// R318 PIN SHIFT (48. člen): vodja blok glava dobi ČETRTI amber gumb (PDF
// brat CSV-ja — bratska simetrija; register ×3 → ×4 z obrnjeno regresijo:
// stari ×3 pin je prepovedan — polzaporedje ne sme nazaj; precedens
// R316 JSON → R317 CSV → R318 PDF).
//
// R321 PIN SHIFT (50. člen): vodja blok glava dobi ŠESTI amber/50 gumb
// (meritve zmogljivosti PDF — brat zaslona R312, Deliverable 6 tisk;
// register ×5 → ×6 z obrnjeno regresijo: stari ×5 pin je prepovedan —
// polzaporedje ne sme nazaj; precedens R320 končna PDF).
//
// R324 PIN SHIFT (52. člen): vodja blok glava dobi OSMI amber/50 gumb
// R355 PIN SHIFT (65. člen): vodja blok glava dobi DEVETI amber/50 gumb (KATALOG)
// (dnevni pregled vodje PDF — brat CSV R163, IZVOZI družina; register
// ×7 → ×8 z obrnjeno regresijo: stari ×7 pin je prepovedan — polzaporedje
// ne sme nazaj; precedens R321/R323).
//
// R326 PIN SHIFT (53. člen): zgodovina cen materiala CSV gumb (inventory
// tab — NOVI panel CenaZgodovinaPanel; ring = navy/40, amber/50 register
// ostane zaklenjen v vodji ×8; anti-stale števec drevesa 58 → 59 z
// obrnjeno regresijo: stari 58 pin je prepovedan — polzaporedje ne sme nazaj).
//
// R327 PIN SHIFT (54. člen): zgodovina cen materiala PDF gumb (ISTI panel —
// PDF BRAT CSV-ju, bratska simetrija par na isti blok glavi; ring = navy/40,
// amber/50 register ostane zaklenjen v vodji ×8; anti-stale števec drevesa
// 59 → 60 z obrnjeno regresijo: stari 59 pin je prepovedan — polzaporedje
// ne sme nazaj).
//
// R328 PIN SHIFT (55. člen): primerjava dobaviteljev CSV gumb (NOVI pod
// panel CenaDobaviteljiPanel na inventory tabu — §5 'supplier comparison';
// ring = navy/40, amber/50 register ostane zaklenjen v vodji ×8; anti-stale
// števec drevesa 60 → 61 z obrnjeno regresijo: stari 60 pin je prepovedan —
// polzaporedje ne sme nazaj).
//
// R329 PIN SHIFT (56. člen): primerjava dobaviteljev PDF gumb (ISTI pod
// panel — PDF BRAT CSV-ju R328, bratska simetrija para na isti blok glavi;
// ring = navy/40, amber/50 register ostane zaklenjen v vodji ×8; anti-stale
// števec drevesa 61 → 62 z obrnjeno regresijo: stari 61 pin je prepovedan —
// polzaporedje ne sme nazaj).
//
// R330 PIN SHIFT (57. člen): pregled projektov in terminov CSV gumb
// (logistics-tab — pariteta Projekti PDF R265, izvozna PAR na isti vrsti;
// ring = navy/40, amber/50 register ostane zaklenjen v vodji ×8; anti-stale
// števec drevesa 62 → 63 z obrnjeno regresijo: stari 62 pin je prepovedan —
// polzaporedje ne sme nazaj).
//
// R331 PIN SHIFT (58. člen): pregled spomnikov ponudb CSV gumb (CRM kartica
// Ponudbe — sledenje, quote-followup — pariteta Ponudbe PDF R267, izvozna
// PAR na isti blok glavi; ring = navy/40, amber/50 register ostane zaklenjen
// v vodji ×8; anti-stale števec drevesa 63 → 64 z obrnjeno regresijo: stari
// 63 pin je prepovedan — polzaporedje ne sme nazaj).
//
// R332 PIN SHIFT (59. člen): potekli opomniki CSV gumb (CRM tab izvozna
// cona — CSV BRAT PDF R252, bratska simetrija para na isti vrsti; ring =
// navy/40, amber/50 register ostane zaklenjen v vodji ×8; anti-stale števec
// drevesa 64 → 65 z obrnjeno regresijo: stari 64 pin je prepovedan —
// polzaporedje ne sme nazaj).
//
// R333 PIN SHIFT (60. člen): pozicija dobaviteljev CSV gumb (Material
// pregled izvozna cona — CSV BRAT PDF R264, bratska simetrija para na isti
// vrsti; ring = navy/40, amber/50 register ostane zaklenjen v vodji ×8;
// anti-stale števec drevesa 65 → 66 z obrnjeno regresijo: stari 65 pin je
// prepovedan — polzaporedje ne sme nazaj).
//
// R334 PIN SHIFT (61. člen): poročilo končne verifikacije CSV gumb (vodja
// blok glava — CSV BRAT JSON R316 + PDF R320, izvozna TRIADA na isti blok
// glavi; ring = amber/50 + offset-2 — ISTI žeton kot brata; vodja amber
// register ×8 → ×9 z obrnjeno regresijo: stari ×8 pin je prepovedan —
// polzaporedje ne sme nazaj; precedens R316 JSON → R320 PDF → R334 CSV;
// anti-stale števec drevesa 66 → 67 z obrnjeno regresijo: stari 66 pin je
// prepovedan — polzaporedje ne sme nazaj).
//
// R335 PIN SHIFT (62. člen): mesečno poročilo vodje CSV gumb (vodja blok
// glava — CSV BRAT Poročilo PDF rundi M; EN VIR mesecniPregledData — isti
// ReportData za OBA izvoza; ring = amber/50 + offset-2 — ISTI žeton kot
// brat; vodja amber register ×9 → ×10 z obrnjeno regresijo: stari ×9 pin
// je prepovedan — polzaporedje ne sme nazaj; precedens R316 JSON → R320
// PDF → R334 CSV → R335 CSV; anti-stale števec drevesa 67 → 68 z obrnjeno
// regresijo: stari 67 pin je prepovedan — polzaporedje ne sme nazaj).
//
// STRAŽAR (kanon GLOBALNI sken r310/r316 prenesen na izvozno družino):
//  • vsak izvozni gumb (aria-label="Izvozi …") nosi IZRECEN
//    focus-visible:ring-2 žeton (ne samo baza);
// R336 PIN SHIFT (63. člen): sistem zdravje CSV gumb (SistemZdravjeCard —
// zadnja vodja kartica brez izvoza) — gumb je v SESTAVLJENI kartici
// (sistem-zdravje-card.tsx), NE v vodja-dashboard datoteki → ring =
// navy/40 (val20 Material precedens — izven vodja datoteke), amber/50
// register OSTANE ×10 z obrnjeno regresijo: stari ×10 pin ostane; anti-stale
// števec drevesa 68 → 69 z obrnjeno regresijo (polzaporedje ne sme nazaj).
//
// R337 PIN SHIFT (64. člen): AI raba pregled CSV gumb (vodja blok glava —
// ZADNJI vodja dokazni blok dobi izvoz; CSV brat zaslona R311, EN VIR
// aiRabaCsv(aiRaba) — handler poda že IZRISANI pregled; ring = amber/50 +
// offset — ISTI žeton kot končna verifikacija CSV pill; vodja amber
// register ×10 → ×11 z obrnjeno regresijo: stari ×10 pin je prepovedan —
// polzaporedje ne sme nazaj; precedens R316 JSON → R320 PDF → R334 CSV →
// R335 CSV → R337 CSV; anti-stale števec drevesa 69 → 70 z obrnjeno
// regresijo — polzaporedje ne sme nazaj).
//
//  • barva = roksal žeton (navy/40 ali amber/50) — 0 surovih barv;
//  • amber/50 SAMO v vodja-dashboard (izrecen zaklenjen register z razlogom
//    — R308/R316 lekcija: semantične izjeme + bratska simetrija blok glav);
//  • anti-stale: števec gumbov mora ujemati pričakovanje (zastarel test =
//    fail, kanon r316-stil-val7).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROKSAL_DIR = join(process.cwd(), 'src/components/roksal')

/** Najdi vse izvozne gumbe (aria-label="Izvozi …") z oknom className vrstic. */
function izvozniGumbi(): Array<{ datoteka: string; vrstica: number; okno: string }> {
  const najdeni: Array<{ datoteka: string; vrstica: number; okno: string }> = []
  for (const f of readdirSync(ROKSAL_DIR).filter((n) => n.endsWith('.tsx'))) {
    const vrstice = readFileSync(join(ROKSAL_DIR, f), 'utf8').split('\n')
    for (let i = 0; i < vrstice.length; i++) {
      if (!vrstice[i].includes('aria-label="Izvozi')) continue
      // className je tipično do 6 vrstic nad aria-label ali do 5 pod njo
      najdeni.push({
        datoteka: f.replace('.tsx', ''),
        vrstica: i + 1,
        okno: vrstice.slice(Math.max(0, i - 8), i + 6).join('\n'),
      })
    }
  }
  return najdeni
}

describe('r317 STIL val 8 — izvozna družina: focus-visible ring STRAŽAR', () => {
  const gumbi = izvozniGumbi()
  const AMBER_ZETONI = new Set(['vodja-dashboard'])

  it('anti-stale: 70 izvoznih gumbov v drevesu (69 pred R337 + NOVI AI raba pregled CSV)', () => {
    expect(gumbi.length).toBeGreaterThanOrEqual(71) // R335 PIN SHIFT 67 → 68 + R336 PIN SHIFT 68 → 69 + R337 PIN SHIFT 69 → 70 + R355 PIN SHIFT 70 → 71 (KATALOG pill — 65. člen; stari pini so prepovedani — obrnjena regresija, polzaporedje ne sme nazaj)
    // novi gumb 50. člena je prisoten
    expect(gumbi.some((g) => g.okno.includes('Izvozi meritve zmogljivosti kot PDF'))).toBe(true)
    // novi gumb 51. člena je prisoten (R322)
    expect(gumbi.some((g) => g.okno.includes('Izvozi meritve zmogljivosti kot CSV'))).toBe(true)
    // novi gumb 52. člena je prisoten (R324)
    expect(gumbi.some((g) => g.okno.includes('Izvozi dnevni pregled vodje kot PDF'))).toBe(true)
    // novi gumb 53. člena je prisoten (R326 — zgodovina cen materiala CSV)
    expect(gumbi.some((g) => g.okno.includes('Izvozi zgodovino cen materiala kot CSV'))).toBe(true)
    // novi gumb 54. člena je prisoten (R327 — zgodovina cen materiala PDF brat)
    expect(gumbi.some((g) => g.okno.includes('Izvozi zgodovino cen materiala kot PDF'))).toBe(true)
    // novi gumb 55. člena je prisoten (R328 — primerjava dobaviteljev CSV)
    expect(gumbi.some((g) => g.okno.includes('Izvozi primerjavo dobaviteljev kot CSV'))).toBe(true)
    // novi gumb 56. člena je prisoten (R329 — primerjava dobaviteljev PDF brat)
    expect(gumbi.some((g) => g.okno.includes('Izvozi primerjavo dobaviteljev kot PDF'))).toBe(true)
    // novi gumb 57. člena je prisoten (R330 — pregled projektov in terminov CSV brat)
    expect(gumbi.some((g) => g.okno.includes('Izvozi pregled projektov in terminov kot CSV'))).toBe(true)
    // novi gumb 58. člena je prisoten (R331 — pregled spomnikov ponudb CSV brat)
    expect(gumbi.some((g) => g.okno.includes('Izvozi pregled spomnikov ponudb kot CSV'))).toBe(true)
    // novi gumb 59. člena je prisoten (R332 — potekli opomniki CSV brat)
    expect(gumbi.some((g) => g.okno.includes('Izvozi potekle opomnike kot CSV'))).toBe(true)
    // novi gumb 60. člena je prisoten (R333 — pozicija dobaviteljev CSV brat)
    expect(gumbi.some((g) => g.okno.includes('Izvozi pozicijo dobaviteljev kot CSV'))).toBe(true)
    // novi gumb 61. člena je prisoten (R334 — končna verifikacija CSV brat)
    expect(gumbi.some((g) => g.okno.includes('Izvozi poročilo končne verifikacije kot CSV'))).toBe(true)
    // novi gumb 62. člena je prisoten (R335 — mesečno poročilo vodje CSV brat)
    expect(gumbi.some((g) => g.okno.includes('Izvozi mesečno poročilo vodje kot CSV'))).toBe(true)
    // novi gumb 63. člena je prisoten (R336 — sistem zdravje CSV, SistemZdravjeCard)
    expect(gumbi.some((g) => g.okno.includes('Izvozi sistem zdravje kot CSV'))).toBe(true)
  })

  it('vsak izvozni gumb nosi IZRECEN focus-visible ring žeton (ne samo ui baza)', () => {
    const brez = gumbi.filter((g) => !g.okno.includes('focus-visible:ring-2'))
    expect(brez).toEqual([])
  })

  it('ring barva = roksal žeton (navy/40 ali amber/50) — 0 surovih barv', () => {
    const kršitve = gumbi
      .map((g) => ({
        ...g,
        barve: [
          ...g.okno.matchAll(
            /focus-visible:ring-(roksal-(?:navy|amber|green|red|ink)\/?\d*|amber-\d+(?:\/\d+)?|red-\d+|white|black)/g,
          ),
        ].map((m) => m[1]),
      }))
      .filter((g) => g.barve.length === 0 || g.barve.some((b) => !b.startsWith('roksal-')))
    expect(kršitve).toEqual([])
  })

  it('amber/50 ring SAMO v zaklenjenem registru (vodja-dashboard — blok glavni gumbi, bratska simetrija)', () => {
    const kršitve = gumbi.filter(
      (g) => g.okno.includes('focus-visible:ring-roksal-amber/50') && !AMBER_ZETONI.has(g.datoteka),
    )
    expect(kršitve).toEqual([])
    // R335 register je ŽIV: vodja res nosi 11 amber gumbov (dnevni CSV R163 +
    // JSON 46. + CSV 47. + audit PDF 48. + končna verifikacija PDF 49. +
    // meritve zmogljivosti PDF 50. + meritve zmogljivosti CSV 51. + dnevni
    // pregled PDF 52. člen + končna verifikacija CSV 61. člen + mesečno
    // poročilo CSV 62. člen + AI raba pregled CSV 64. člen R337 — isti vodja
    // blok glavni vzorec z offset-2;
    // PIN SHIFT ×10 → ×11 z obrnjeno regresijo: stari ×10 pin je prepovedan —
    // polzaporedje ne sme nazaj)
    const vodjaAmber = gumbi.filter(
      (g) => g.datoteka === 'vodja-dashboard' && g.okno.includes('focus-visible:ring-roksal-amber/50'),
    )
    // R355: 11 → 12 (KATALOG pill — 65. člen, bratska simetrija izvozne družine)
    expect(vodjaAmber.length).toBe(12)
    const ariaVseh = vodjaAmber.map((g) => {
      const m = g.okno.match(/aria-label="([^"]+)"/)
      return m ? m[1] : ''
    })
    expect(ariaVseh).toContain('Izvozi dnevni pregled vodje kot CSV')
    expect(ariaVseh).toContain('Izvozi dnevni pregled vodje kot PDF')
    expect(ariaVseh).toContain('Izvozi poročilo končne verifikacije kot JSON')
    expect(ariaVseh).toContain('Izvozi avtomatizacijski audit kot CSV')
    expect(ariaVseh).toContain('Izvozi avtomatizacijski audit kot PDF')
    expect(ariaVseh).toContain('Izvozi poročilo končne verifikacije kot PDF')
    expect(ariaVseh).toContain('Izvozi meritve zmogljivosti kot PDF')
    expect(ariaVseh).toContain('Izvozi meritve zmogljivosti kot CSV')
    // R334: končna verifikacija CSV (61. člen) — izvozna TRIADA
    expect(ariaVseh).toContain('Izvozi poročilo končne verifikacije kot CSV')
    // R335: mesečno poročilo vodje CSV (62. člen) — CSV brat Poročilo PDF
    expect(ariaVseh).toContain('Izvozi mesečno poročilo vodje kot CSV')
    // R355: polni katalog zmožnosti CSV (65. člen) — KATALOG pill
    expect(ariaVseh).toContain('Izvozi polni katalog avtomatizacijskih zmožnosti kot CSV')
    // R337: AI raba pregled CSV (64. člen) — ZADNJI vodja dokazni blok dobi
    // izvoz (EN VIR aiRabaCsv(aiRaba) — handler poda že IZRISANI pregled)
    expect(ariaVseh).toContain('Izvozi pregled AI rabe kot CSV')
    // R336: sistem zdravje CSV (63. člen) NI v vodja datoteki — v SistemZdravjeCard
    // (sestavljena kartica z lastnim stanjem); amber/50 register je bil ×10 do
    // R336 (navy/40 družina — val20 Material precedens), R337 AI raba CSV gumb
    // je SPET v vodja datoteki → register ×11 (PIN SHIFT zgoraj).
  })

  it('R317 harmonizirana vrstica: site-survey PDF gumb ima družinski ring (regresijski pin — nazaj = fail)', () => {
    const raw = readFileSync(join(ROKSAL_DIR, 'site-survey-tab.tsx'), 'utf8')
    expect(raw).toContain(
      'hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 focus-visible:outline-none',
    )
  })
})
