#!/usr/bin/env python3
# R321 — derive r321-build-needles.sh iz r320-build-needles.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; LEKCIJA
# R312: štetje na POJAVITVE). Transformacije: glava (50. člen + STIL val 10),
# OUT pot, R321 needle blok (PDF aria + filename + must_miss), delegacija
# r318 → r320 (r319 generacije ni — vzporedna seja je ustvarila teste, ne
# verige; kanon R320).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r320-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r321-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── glava ──
zam('# R320 — build needleji: 49. člen issue #1 «IZVOZ POROČILA KONČNE\n# VERIFIKACIJE KOT PDF» (IZVOZI družina: PDF brat JSON R316 — vzorec R318\n# audit-pdf: LOČEN lib; NOV lib buildKoncnaVerifikacijaPdfDoc = ČISTA\n# projekcija koncnaVerifikacija validacije — EN VIR: sklep = PETI potrošnik\n# ENEGA niza; kriteriji verbatim; determinističen PDF [fiksni formatni žig\n# KONCNA_PDF_ZIG_FIKSNI + FNV soli 0xc5–0xc8; brez časa v vsebini — isti\n# HEAD = bajtno identična datoteka, kanon 46./47./48. člen]; vodja\n# končna-verifikacija blok dobi gumb PDF [a11y izvozne družine R291/R293;\n# amber/50 register ×4→×5; press-scale val9 register 11→12; fail-verbose\n# toast]; vitest r320-koncna-verifikacija-pdf ×9; E2E Z0aq DETERMINIZEM ŽIVO\n# NA BAJTIH: dva izvoza bajtno enaka + %PDF- magija + MIME application/pdf)',
    '# R321 — build needleji: 50. člen issue #1 «IZVOZ MERITEV ZMOGLJIVOSTI KOT\n# PDF» (IZVOZI družina: brat zaslona R312 — vzorec R318/R320: LOČEN lib; NOV\n# lib buildZmogljivostPdfDoc = ČISTA projekcija POSREDOVANEGA pregleda —\n# meritev se izvede ENKRAT v brskalniku, PDF NE meri znova; EN VIR:\n# formatirajMs zaslon + PDF iz brata; sklep = TRETJI potrošnik ENEGA niza;\n# determinističen PDF [fiksni formatni žig ZMOGLJIVOST_PDF_ZIG_FIKSNI + FNV\n# soli 0xc9–0xcc; brez časa v vsebini — isti HEAD + ista meritev = bajtno\n# identična datoteka, kanon 46.–49. člen]; vodja zmogljivost-dokaz blok dobi\n# gumb PDF [a11y izvozne družine R291/R293; amber/50 register ×5→×6;\n# press-scale val9 register 12→13; fail-verbose toast + iskrena ničelna\n# veja]; vitest r321-zmogljivost-pregled-pdf ×10; E2E Z0ar DETERMINIZEM ŽIVO\n# NA BAJTIH: dva izvoza bajtno enaka + %PDF- magija + MIME application/pdf;\n# STIL val 10: dokazni bloki vrstični hover ×3 — r321-stil-val10 STRAŽAR)')

# ── pozitivni/must_miss komentar ──
zam('#   POZITIVNI needleji (build): PDF izvoz aria + filename (vodja chunk).\n#   MUST_MISS (build): TODO-R320 + stari brez-PDF-gumba ni pripisljiv\n#   (dodajanje gumba je aditivno — NI must_miss kandidata za gumb; stari\n#   r318 vzorci ostanejo ŽIVO — regresijski pokritost prek delegacije).\n#   + (1) regresije: r318-build-needles.sh (R318 + R317 + … polna veriga do\n#   R227 — DELEGACIJA; red: r318 → r317 → …).',
    '#   POZITIVNI needleji (build): PDF izvoz aria + filename (vodja chunk).\n#   MUST_MISS (build): TODO-R321 + stari brez-PDF-gumba ni pripisljiv\n#   (dodajanje gumba je aditivno — NI must_miss kandidata za gumb; stari\n#   r320 vzorci ostanejo ŽIVO — regresijska pokritost prek delegacije).\n#   + (1) regresije: r320-build-needles.sh (R320 + R318 + R317 + … polna\n#   veriga do R227 — DELEGACIJA; r319 generacije ni — vzporedna seja je\n#   ustvarila teste, ne verige; red: r320 → r318 → r317 → …).')

# ── OUT pot ──
zam('OUT=/tmp/r320-build-chunks', 'OUT=/tmp/r321-build-chunks', 1)

# ── R321 needle blok ──
zam('echo "--- R320 MANDATORY — 49. člen: izvoz poročila končne verifikacije kot PDF (IZVOZI družina) ---"\nneed_static "Izvozi poročilo končne verifikacije kot PDF" "R320 PDF izvoz gumb aria (vodja chunk)"\nneed_static "koncna-verifikacija.pdf" "R320 PDF izvoz filename (vodja handler)"\necho "--- R320 must_miss (negativni) ---"\nmust_miss "TODO-R320" "R320 — brez razvojnih ostankov"\necho "R320 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"\necho "=== REGRESIJE: polna veriga prek r318-build-needles.sh (R318+R317+…+R227) ==="\nREG=0\nbash scripts/r318-build-needles.sh || REG=1',
    'echo "--- R321 MANDATORY — 50. člen: izvoz meritev zmogljivosti kot PDF (IZVOZI družina) ---"\nneed_static "Izvozi meritve zmogljivosti kot PDF" "R321 PDF izvoz gumb aria (vodja chunk)"\nneed_static "zmogljivost-pregled.pdf" "R321 PDF izvoz filename (vodja handler)"\necho "--- R321 must_miss (negativni) ---"\nmust_miss "TODO-R321" "R321 — brez razvojnih ostankov"\necho "R321 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"\necho "=== REGRESIJE: polna veriga prek r320-build-needles.sh (R320+R318+R317+…+R227) ==="\nREG=0\nbash scripts/r320-build-needles.sh || REG=1')

# ── konec ──
zam('echo "=== R320 BUILD NEEDLES VSE OK ==="', 'echo "=== R321 BUILD NEEDLES VSE OK ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r321-build-needles.sh zapisan ({len(text)} znakov)')
