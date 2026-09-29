#!/usr/bin/env python3
"""R295 — calculator-tab.tsx locale popravki (EN VIR, bajtno identično).
toLocaleDateString('sl-SI')             → slDatumKratko(...)
toLocaleString('sl-SI')                 → slDatumKratko + ', ' + slCasDolgo
toLocaleString('sl-SI') številka        → formatSlDecimalno(n, 0, 3)
{day:'numeric',month:'short',year:'2-digit'} → MESCI_SL_KRATKO kombinacija
{day:'numeric',month:'short'}           → MESCI_SL_KRATKO kombinacija
{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'} → MESCI_SL_KRATKO + slUra"""
import re

P = '/home/z/my-project/src/components/roksal/calculator-tab.tsx'
s = open(P, encoding='utf-8').read()

def zam(pat, repl, n=1):
    global s
    m = re.findall(pat, s)
    assert len(m) == n, f'pričakovano {n}, najdeno {len(m)}: {pat}'
    s = re.sub(pat, repl, s)

# 0. import — EN VIR pomožniki
zam(r"import jsPDF from 'jspdf'\nimport autoTable from 'jspdf-autotable'",
    "import jsPDF from 'jspdf'\n"
    "import autoTable from 'jspdf-autotable'\n"
    "import { slDatumKratko, slCasDolgo, slUra, formatSlDecimalno, MESCI_SL_KRATKO } from '@/lib/csv-export'")

# 1. prompt privzeti naziv (657 — naziv gre v bazo)
zam(r"`Predloga \$\{templateModeLabels\[mode as TemplateMode\]\} \$\{new Date\(\)\.toLocaleDateString\('sl-SI'\)\}`",
    "`Predloga ${templateModeLabels[mode as TemplateMode]} ${slDatumKratko(new Date())}`")

# 2. CSV zgodovina (777)
zam(r"      new Date\(h\.timestamp\)\.toLocaleString\('sl-SI'\),",
    "      `${slDatumKratko(new Date(h.timestamp))}, ${slCasDolgo(new Date(h.timestamp))}`,")

# 3. PDF noga 1136
zam(r"`Datum: \$\{new Date\(\)\.toLocaleDateString\('sl-SI'\)} — Roksal Railing Manager`,",
    "`Datum: ${slDatumKratko(new Date())} — Roksal Railing Manager`,")

# 4. doc.text 1174
zam(r"doc\.text\(`Datum: \$\{new Date\(\)\.toLocaleDateString\('sl-SI'\)\}`, 14, y\)",
    "doc.text(`Datum: ${slDatumKratko(new Date())}`, 14, y)")

# 5. placiloDatum 1254 (PDF body)
zam(r"const placiloDatum = new Date\(Date\.now\(\) \+ 7 \* 24 \* 60 \* 60 \* 1000\)\.toLocaleDateString\('sl-SI'\)",
    "const placiloDatum = slDatumKratko(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))")

# 6. doc.text 1308
zam(r"doc\.text\(`Datum: \$\{new Date\(\)\.toLocaleDateString\('sl-SI'\)\}`, 14, y\)",
    "doc.text(`Datum: ${slDatumKratko(new Date())}`, 14, y)")

# 7. 1462 EN 1991
zam(r"`Datum: \$\{new Date\(\)\.toLocaleDateString\('sl-SI'\)} — Roksal Railing Manager \(SIST EN 1991-1-",
    "`Datum: ${slDatumKratko(new Date())} — Roksal Railing Manager (SIST EN 1991-1-")

# 8. 1586 poenostavljena
zam(r"`Datum: \$\{new Date\(\)\.toLocaleDateString\('sl-SI'\)} — Roksal Railing Manager \(poenostavljena",
    "`Datum: ${slDatumKratko(new Date())} — Roksal Railing Manager (poenostavljena")

# 9. 1917 predloga {day numeric, month short, year 2-digit}
zam(r"\{new Date\(tpl\.createdAt\)\.toLocaleDateString\('sl-SI', \{ day: 'numeric', month: 'short', year: '2-digit' \}\)\}",
    "{(() => { const t = new Date(tpl.createdAt); return `${t.getDate()}. ${MESCI_SL_KRATKO[t.getMonth()]} ${String(t.getFullYear()).slice(-2)}`; })()}")

# 10. 3901 totalL številka
zam(r"\{totalL\.toLocaleString\('sl-SI'\)\}",
    "{formatSlDecimalno(totalL, 0, 3)}")

# 11. 4115 JSX datum + 7 dni
zam(r"\{new Date\(Date\.now\(\) \+ 7 \* 24 \* 60 \* 60 \* 1000\)\.toLocaleDateString\('sl-SI'\)\}",
    "{slDatumKratko(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}")

# 12. 5387 {day numeric, month short}
zam(r"\{new Date\(calc\.date\)\.toLocaleDateString\('sl-SI', \{ day: 'numeric', month: 'short' \}\)\}",
    "{(() => { const d = new Date(calc.date); return `${d.getDate()}. ${MESCI_SL_KRATKO[d.getMonth()]}`; })()}")

# 13. 5474 {day numeric, month short, hour 2-digit, minute 2-digit}
zam(r"\{new Date\(entry\.timestamp\)\.toLocaleString\('sl-SI', \{ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' \}\)\}",
    "{(() => { const d = new Date(entry.timestamp); return `${d.getDate()}. ${MESCI_SL_KRATKO[d.getMonth()]}, ${slUra(d)}`; })()}")

ostanek = len(re.findall(r"toLocale", s))
open(P, 'w', encoding='utf-8').write(s)
print(f'OK — calculator-tab: 13 popravkov; toLocale ostanka: {ostanek}')
