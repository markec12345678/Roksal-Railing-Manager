#!/usr/bin/env python3
"""R295 — measurements-tab.tsx preostali locale popravki (EN VIR žičenje).
Vsaka zamenjava je bajtno identična (R294/R295 ICU paritetni testi):
  toLocaleDateString('sl-SI')                        → slDatumKratko(...)
  toLocaleString('sl-SI')                            → slDatumKratko + ', ' + slCasDolgo
  toLocaleDateString('sl-SI',{day:'2-digit',month:'2-digit'}) → slDatumOkrajsava(...)
Plus popravilo poškodovane MESCI_SL vrstice (2625)."""
import re

P = '/home/z/my-project/src/components/roksal/measurements-tab.tsx'
s = open(P, encoding='utf-8').read()
orig = s

# 0. MESCI_SL vrstica je PRAVILNA (prejšnja 'poškodba' = napačna interpretacija
#    repr izpisa — MESCI_SL[mDate je cel; nič za popraviti).
slomljena = 'MESCI_SLDate.getMonth()]'
assert slomljena not in s, 'nepričakovana poškodba prisotna'

def zam(pat, repl, n=1):
    global s
    m = re.findall(pat, s)
    assert len(m) == n, f'pričakovano {n}, najdeno {len(m)}: {pat}'
    s = re.sub(pat, repl, s)

# 1. PDF autoTable body datum (3497)
zam(r"new Date\(m\.createdAt\)\.toLocaleDateString\('sl-SI'\),",
    "slDatumKratko(new Date(m.createdAt)),", 1)

# 2. PDF noga (3517)
zam(r"`Izvozeno \$\{new Date\(\)\.toLocaleString\('sl-SI'\)} • Roksal Kranj`,",
    "`Izvozeno ${slDatumKratko(new Date())}, ${slCasDolgo(new Date())} • Roksal Kranj`,", 1)

# 3. audit CSV cas (3890)
zam(r"const cas = new Date\(e\.timestamp\)\.toLocaleString\('sl-SI'\)",
    "const cas = `${slDatumKratko(new Date(e.timestamp))}, ${slCasDolgo(new Date(e.timestamp))}`", 1)

# 4. verzije td (4937)
zam(r"\{new Date\(v\.createdAt\)\.toLocaleDateString\('sl-SI'\)\}",
    "{slDatumKratko(new Date(v.createdAt))}", 1)

# 5. meritev pill (4993)
zam(r"\{new Date\(m\.createdAt\)\.toLocaleDateString\('sl-SI'\)\}",
    "{slDatumKratko(new Date(m.createdAt))}", 1)

# 6. prejeto pill (7152)
zam(r"prejeto \{new Date\(strankaPrimerjava\.zadnja\)\.toLocaleDateString\('sl-SI', \{ day: '2-digit', month: '2-digit' \}\)\}",
    "prejeto {slDatumOkrajsava(new Date(strankaPrimerjava.zadnja))}", 1)

# 7. lokalni osnutek (7224)
zam(r"\{new Date\(d\.createdAt\)\.toLocaleString\('sl-SI'\)} · lokalni osnutek",
    "{`${slDatumKratko(new Date(d.createdAt))}, ${slCasDolgo(new Date(d.createdAt))}`} · lokalni osnutek", 1)

# 8. entry.timestamp (7400)
zam(r"\{new Date\(entry\.timestamp\)\.toLocaleString\('sl-SI'\)\}",
    "{`${slDatumKratko(new Date(entry.timestamp))}, ${slCasDolgo(new Date(entry.timestamp))}`}", 1)

# 9. snap.createdAt (7634)
zam(r"\{new Date\(snap\.createdAt\)\.toLocaleString\('sl-SI'\)\}",
    "{`${slDatumKratko(new Date(snap.createdAt))}, ${slCasDolgo(new Date(snap.createdAt))}`}", 1)

ostanek = len(re.findall(r"toLocale", s))
open(P, 'w', encoding='utf-8').write(s)
print(f'OK — popravljenih 10 + 1 popravek; toLocale ostanka v datoteki: {ostanek}')
