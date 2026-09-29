#!/usr/bin/env python3
# R294 — mehanska zamenjava locale-odvisnih klicev z EN VIR čistimi izpeljavami
# (bajtno ISTI izpisi — ICU resnica node 24 sl-SI; glej r294 testi paritete).
import re

BASE = '/home/z/my-project/src/lib/'

def beri(f):
    return open(BASE + f, encoding='utf-8').read()

def pisi(f, s):
    open(BASE + f, 'w', encoding='utf-8').write(s)

def vstavi_import(s, nov_import):
    """Vstavi import PRED prvo ne-komentarsko/ne-prazno vrstico (import/first)."""
    lines = s.split('\n')
    for i, l in enumerate(lines):
        if l.strip() and not l.strip().startswith('//') and not l.strip().startswith('*') and not l.strip().startswith('/*'):
            lines.insert(i, nov_import)
            return '\n'.join(lines)
    raise AssertionError('ni sidra za import')

def poiskusi_import(s, sidra, nov_import):
    for sidro in sidra:
        if sidro in s:
            return s.replace(sidro, nov_import + '\n' + sidro, 1)
    return vstavi_import(s, nov_import)

# 1) audit-csv (brez importov — vstavi pred prvi stavek)
s = beri('audit-csv.ts')
s = poiskusi_import(s, [], "import { slDatum, slUra } from '@/lib/csv-export'")
star = """  return (
    d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  )"""
assert star in s, 'audit-csv blok'
s = s.replace(star, "  // R294 (issue #1): bajtno ista čista izpeljava namesto ICU klica (slDatum/slUra EN VIR csv-export).\n  return `${slDatum(d)} ${slUra(d)}`", 1)
pisi('audit-csv.ts', s)

# 2) boss-report-pdf
s = beri('boss-report-pdf.ts')
s = poiskusi_import(s, ["import { registerSloPdfFonts } from '@/lib/pdf-sl-font'"], "import { formatSlDecimalno, slDatumKratko, slUra, MESCI_SL } from '@/lib/csv-export'")
star = """const eur = (n: number) =>
  n.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const eur0 = (n: number) =>
  n.toLocaleString('sl-SI', { maximumFractionDigits: 0 }) + ' €'

function slDatum(d: Date | string): string {
  return new Date(d).toLocaleDateString('sl-SI')
}"""
nov = """// R294 (issue #1): bajtno iste čiste izpeljave namesto ICU klicev (EN VIR csv-export).
const eur = (n: number) => formatSlDecimalno(n, 2, 2) + ' €'
const eur0 = (n: number) => formatSlDecimalno(n, 0, 0) + ' €'

function slDatum(d: Date | string): string {
  return slDatumKratko(new Date(d))
}"""
assert star in s, 'boss-report eur/slDatum blok'
s = s.replace(star, nov, 1)
star = "  return capitalize(new Date(year, month, 1).toLocaleDateString('sl-SI', { month: 'long' }))"
assert star in s, 'boss-report mesecIme'
s = s.replace(star, "  // R294: fiksni slovenski seznam (NIKOLI locale-odvisen izpis meseca).\n  return capitalize(MESCI_SL[month])", 1)
star = "${data.generatedAt.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}"
assert star in s, 'boss-report noge ura'
s = s.replace(star, "${slUra(data.generatedAt)}", 1)
pisi('boss-report-pdf.ts', s)

# 3) document-pdf — glava datuma (byte-determinizem ključen — SHA-256 storage)
s = beri('document-pdf.ts')
s = poiskusi_import(s, ["import { registerSloPdfFonts } from '@/lib/pdf-sl-font'"], "import { slDatum } from '@/lib/csv-export'")
star = "  return d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })"
assert star in s, 'document-pdf datum'
s = s.replace(star, "  // R294 (issue #1): bajtno ista čista izpeljava — renderer MORA biti bajtno determinističen (SHA-256 storage).\n  return slDatum(d)", 1)
pisi('document-pdf.ts', s)

# 4) ekipa-csv (brez importov)
s = beri('ekipa-csv.ts')
s = poiskusi_import(s, [], "import { slDatumKratko } from '@/lib/csv-export'")
star = "  return d.toLocaleDateString('sl-SI')"
assert star in s, 'ekipa datum'
s = s.replace(star, "  // R294 (issue #1): bajtno ista čista izpeljava (privzeti sl-SI format 'D. M. YYYY').\n  return slDatumKratko(d)", 1)
pisi('ekipa-csv.ts', s)

# 5) nagibi-csv (brez importov)
s = beri('nagibi-csv.ts')
s = poiskusi_import(s, [], "import { slDatumKratko, slUra } from '@/lib/csv-export'")
star = """    const datum = d.toLocaleDateString('sl-SI')
    const ura = d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })"""
assert star in s, 'nagibi datum/ura'
s = s.replace(star, "    // R294 (issue #1): bajtno isti čisti izpisi (EN VIR csv-export).\n    const datum = slDatumKratko(d)\n    const ura = slUra(d)", 1)
pisi('nagibi-csv.ts', s)

# 6) punch-csv (brez importov)
s = beri('punch-csv.ts')
s = poiskusi_import(s, [], "import { slDatumKratko } from '@/lib/csv-export'")
star = "    const datum = d.toLocaleDateString('sl-SI')"
assert star in s, 'punch datum'
s = s.replace(star, "    // R294 (issue #1): bajtno ista čista izpeljava (privzeti sl-SI format).\n    const datum = slDatumKratko(d)", 1)
pisi('punch-csv.ts', s)

# 7) termini-csv
s = beri('termini-csv.ts')
star = "import { toCsv, type CsvValue } from '@/lib/csv-export'"
assert star in s
s = s.replace(star, "import { toCsv, slDatum, type CsvValue } from '@/lib/csv-export'", 1)
star = "  return d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })"
assert star in s, 'termini absolutniDatum'
s = s.replace(star, "  // R294 (issue #1): bajtno ista čista izpeljava (EN VIR csv-export).\n  return slDatum(d)", 1)
pisi('termini-csv.ts', s)

# 8) survey-pdf
s = beri('survey-pdf.ts')
s = poiskusi_import(s, ["import { registerSloPdfFonts } from '@/lib/pdf-sl-font'"], "import { slDatumKratko } from '@/lib/csv-export'")
star = "    `Datum montaže: ${input.datumMontaze ? new Date(input.datumMontaze).toLocaleDateString('sl-SI') : '—'}`,"
assert star in s, 'survey datumMontaze'
s = s.replace(star, "    // R294 (issue #1): bajtno ista čista izpeljava (privzeti sl-SI format).\n    `Datum montaže: ${input.datumMontaze ? slDatumKratko(new Date(input.datumMontaze)) : '—'}`,", 1)
pisi('survey-pdf.ts', s)

print('OK — 8 datotek mehansko popravljenih (output-identično)')
