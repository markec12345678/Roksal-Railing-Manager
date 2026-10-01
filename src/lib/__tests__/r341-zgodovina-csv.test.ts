// R341 — 65. člen issue #1 (IZVOZI družina): zgodovina izračunov CSV →
// kanon EN VIR (toCsv R136 + downloadCsvText R296).
// ---------------------------------------------------------------------------
//  • prej: ročno sestavljanje (lastno citiranje `"..."`, ročni BOM,
//    `\n` brez CR, ročna anchor/blob ples) — ZADNJI preostali ročni CSV v
//    calculator-tab;
//  • zdaj: toCsv(headers, rows) + downloadCsvText(filename, csv) — ISTA
//    mehanika kot bratje IZVOZI (R334/R335/R336/R337);
//  • glave / vrstice / ime datoteke / toasti NESPREMENJENI (kanon 65. člena);
//  • iskren presledek obnašanja: `\n` → CRLF (kanon R136 RFC 4180);
//  • determinizem: brez časa v datoteki razen vrstic, ki jih poda zgodovina.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { toCsv, downloadCsvText } from '@/lib/csv-export'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const tab = readFileSync(TAB, 'utf8')

/** Okno vrstic okoli iskanega niza (ISTA ekstrakcija kot val8 STRAŽAR). */
function oknoOkoli(vir: string, iskalni: string): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(iskalni))
  if (i < 0) return ''
  return vrstice.slice(Math.max(0, i - 10), i + 12).join('\n')
}

describe('r341 zgodovina CSV — kanon toCsv + downloadCsvText (65. člen)', () => {
  it('tab uvozi toCsv + downloadCsvText iz csv-export (EN VIR)', () => {
    expect(tab).toContain(
      'toCsv, downloadCsvText } from \'@/lib/csv-export\'',
    )
  })

  it('exportHistoryCsv uporablja kanon (okno okoli klica) — podatki EN VIR iz history.ts (R342)', () => {
    const okno = oknoOkoli(tab, "toast.success('Zgodovina izvožena v CSV')")
    expect(okno).toContain('downloadCsvText(')
    expect(okno).toContain('toCsv([...ZGODOVINA_CSV_GLAVE], zgodovinaCsvVrstice(history))')
    expect(okno).toContain('roksal-zgodovina-')
  })

  it('0 ročnih ostankov: brez lastnega citiranja, BOM-a, blob/anchor plesa v tabu', () => {
    expect(tab).not.toContain('new Blob')
    expect(tab).not.toContain('createObjectURL')
    expect(tab).not.toContain('uFEFF')
    expect(tab).not.toContain('replace(/"/g')
  })

  it('glave VERBATIM ohranjene (7 stolpcev) — EN VIR ZGODOVINA_CSV_GLAVE (R342 FAZA 4)', () => {
    const hist = readFileSync(join(process.cwd(), 'src/components/roksal/calculator/history.ts'), 'utf8')
    expect(hist).toContain("'Datum',")
    expect(hist).toContain("'Način',")
    expect(hist).toContain("'Ključni rezultat',")
    expect(hist).toContain("'Projekt',")
    expect(hist).toContain("'Formula',")
    expect(hist).toContain("'Odtis vhodov',")
    expect(hist).toContain("'Vhodni podatki',")
    // tab ne podvaja glav (EN VIR)
    expect(tab).not.toContain("['Datum', 'Način'")
  })

  it('vrstica zgodovine VERBATIM (7 celic) — EN VIR zgodovinaCsvVrstice (R342 FAZA 4)', () => {
    const hist = readFileSync(join(process.cwd(), 'src/components/roksal/calculator/history.ts'), 'utf8')
    expect(hist).toContain('slDatumKratko(new Date(h.timestamp))')
    expect(hist).toContain('slCasDolgo(new Date(h.timestamp))')
    expect(hist).toContain('h.modeLabel,')
    expect(hist).toContain('h.keyResult,')
    expect(hist).toContain("h.projectName ?? ''")
    expect(hist).toContain("h.formulaVersion ?? ''")
    expect(hist).toContain("h.inputHash ?? ''")
    expect(hist).toContain('JSON.stringify(h.inputs),')
    // tab ne podvaja gradnje vrstic (EN VIR)
    expect(tab).not.toContain('history.map((h) => [')
  })

  it('prazna zgodovina: fail-closed toast ostaja (guardo kanon)', () => {
    expect(tab).toContain("toast.error('Zgodovina je prazna')")
  })

  it('toCsv kanon deluje: BOM + podpičje + CRLF + RFC 4180 citiranje', () => {
    const csv = toCsv(['A', 'B'], [['1', 'p;x'], ['2', 'imam "narekovaj"']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('\r\n')
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv).toContain('"p;x"')
    expect(csv).toContain('"imam ""narekovaj"""')
  })

  it('downloadCsvText: mehanika prenosa (R296) — delegira na downloadTextFile s CSV MIME', () => {
    // EN VIR potrditev na ravni vira (jsdom-free, kanon determinizem):
    // downloadCsvText = tanek ovoj okoli downloadTextFile + 'text/csv' MIME
    const lib = readFileSync(join(process.cwd(), 'src/lib/csv-export.ts'), 'utf8')
    const i = lib.indexOf('export function downloadCsvText')
    const telo = lib.slice(i, lib.indexOf('}', i))
    expect(telo).toContain("downloadTextFile(filename, csv, 'text/csv;charset=utf-8')")
    // in downloadTextFile nosi blob/anchor/revoke ples, ki ga tab NE ponavlja
    const j = lib.indexOf('export function downloadTextFile')
    const mehanika = lib.slice(j)
    expect(mehanika).toContain('new Blob([vsebina]')
    expect(mehanika).toContain('URL.revokeObjectURL(url)')
  })
})
