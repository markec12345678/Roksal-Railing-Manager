#!/usr/bin/env python3
# R314 — derive r314-prod-qa.sh iz r313-prod-qa.sh (UNION harvest dedovan;
# generacijski vzorec r305→…→r313). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed: napačno število zadetkov → izpisek + exit 1; štetja na
# POJAVITVE — LEKCIJA R312).
# Transformacije:
#   1. Glava: R314 kontekst (44. člen audit tabela + STIL val 5; ESKALACIJA
#      R313 ZAPRTA — Vercel kvota potečena, R313 LIVE 12:38:52Z; opomba:
#      cvstudio dispatch fix R314 — Z2b pokritost sledi needle pokritosti)
#   2. EPOCH meja: R313_* → R314_* (self-contained awk + git log)
#   3. Samoidentifikacijski razred: R31[2] → R31[3] (R307 lekcija 3)
#   4. Z2: R314 needle blok (audit ×7 + STIL ×11 + must_miss ×6) — PO R313 bloku
#   5. TODO veriga: + TODO-R314
#   6. Generacijske poti: /tmp/r313- → /tmp/r314-, __r313val → __r314val
# LEKCIJA R310/R311/R312: splice mora OHRANITI 'set -u' + izhodna-stran
# asercija + štetja = POJAVITVE (str.count), ne vrstice (grep -c).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r313-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r314-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')
lines = text.split('\n')

# ── 1. Glava: vrstice 1-35 (indeksi 0-34) zamenjane; 'set -u' (indeks 35) ostane ──
assert lines[0] == '#!/bin/bash', f'vrstica 1 ni shebang: {lines[0]!r}'
assert 'samozadetek' in lines[34], f'vrstica 35 ni konec glave: {lines[34]!r}'
assert lines[35] == 'set -u', f'vrstica 36 ni set -u: {lines[35]!r} (R310 LEKCIJA)'
NOVA_GLAVA = '''#!/bin/bash
# R314 — PRVA naloga (worklog R315): potrditi R290+…+R313+R314 SKUPAJ na produ.
#   ✅ ESKALACIJA R313 ZAPRTA (R314): Vercel Hobby kvota potečena — R313
#      deploy uspešen 12:38:52Z (GitHub commit status; build 12:37:05.813Z >
#      R313 meja 12:36:43). Produ nosi R313 (R312+R313 SKUPAJ — kanon
#      UNION harvest); r313-prod-qa.sh polna LIVE veja EXIT=0 (329 OK,
#      Z2b 13×400 + users 403, ZERO must_miss).
#   ⚠️ POPRAVEK R314 (Z2 harvest): cvstudio dispatch DODAN v OBE veji —
#      R313 cv-studio STIL needleja sta bila 2× MISS na prvem LIVE teku
#      (chunk ni bil naložen — dispatch pokritost NI sledila needle
#      pokritosti; LEKCIJA R309 1 ponovitev). Popravek je v QA orodju;
#      aplikacija je bila zdrava (vir + build dokazana).
#   R314 = 44. člen issue #1 «AUDIT TABELA NA ZASLONU» (Deliverable 4):
#      feature-by-feature audit §1–§11 — NOV lib avtomatizacija-pregled
#      (ČISTA projekcija EN VIR audita AVTOMATIZACIJA_AUDIT; števec
#      izračunani, sklep verbatim, fail-closed ×6); blok na vodji
#      [avtomatizacija-dokaz/vrstica/sklep]; značke 100 % roksal žetoni
#      (R225/R226 čisto). + MANDATORY STIL val 5: calculator-tab ×8 +
#      post-signature-panel ×7 + photo-tab ×5 = 20 mest — surove amber →
#      roksal žetoni (0 novih hex); 2 izrecni izjemi (photo-tab KATEGORIJE
#      MED značka + stats.med KPI — barvno kodirana kategorija faze
#      PRED blue / MED amber / PO green, R308/R312 precedens).
#   Z0  build-guard (EPOCH): health build > R314 commit čas (git log —
#       self-contained meja) → R314 deploy potrjen (nosi R290+…+R314 — kanon
#       R280/R284), polni LIVE needle teki (R314 audit ×7 + STIL ×11 + R313
#       PDF ×4 + STIL ×3 + R312 zmogljivost ×5 + STIL ×3 + R311 AI raba ×5 +
#       STIL ×2 + R310 STIL ×5 + R309 ×4 + R308 ×7 + R307 ×11 + … + R295 ×9
#       + regresije).
#       build ≤ meja → **ESKALACIJA veja** (kanon R258) — iskren stale-dokaz +
#       Z1b + Z3 (ZERO-MUTACIJA). ZERO must_miss v stale veji (lekcija R294).
#   Z1  meritve tab ŽIVO — sync žig POGOJNO (kanon r277).
#   Z1b verzije ruta 404 + 'Meritev ne obstaja' (R276+ regresa). ZERO-MUTACIJA.
#   Z1c zvonček POGOJNI DOM probe + Z1d presežek note POGOJNI (R287/R289).
#   Z2  čanki needleji: R314 ×18+6 + R313 ×4+6 + R312 ×5+3 + R311 ×7+1 +
#       R310 ×5+1 + R309 ×4+3 + R308 ×7 + R307 ×11 + R306 ×11 + R295 ×8 +
#       R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije.
#   Z2b ŽIČNI EN VIR probei: val-1 ×4 + val-3 ×9 × pokvarjen JSON → 400 z ISTO
#       ovojnico + users 403 deny-first POZITIVNI dokaz (lekcija R311 1).
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R31[3]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).'''
lines[:35] = NOVA_GLAVA.split('\n')
text = '\n'.join(lines)
assert '\nset -u\n' in text, "'set -u' izgubljen pri splice (R310 LEKCIJA)"

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 2. EPOCH meja (R313 → R314; self-contained) ──
zam('R313_COMMIT_ISO', 'R314_COMMIT_ISO', 3)
zam("$2 ~ /^R313 —/ {", "$2 ~ /^R314 —/ {", 1)
zam('R313_PUSH', 'R314_PUSH', 5)
zam('R313 commita ni v git zgodovini', 'R314 commita ni v git zgodovini', 1)
zam('R313 deploy potrjen (build $BUILD > R313 commit meja', 'R314 deploy potrjen (build $BUILD > R314 commit meja', 1)
zam('R313 deploy detekcija', 'R314 deploy detekcija', 1)
zam('echo "R313 meja (commit čas, UTC):', 'echo "R314 meja (commit čas, UTC):', 1)
zam('≤ R313 commit meja', '≤ R314 commit meja', 1)
zam('R313 pričakuje SKUPNI deploy', 'R314 pričakuje SKUPNI deploy', 1)
zam('needleji pokrijejo R290+…+R313', 'needleji pokrijejo R290+…+R314', 1)
zam('deploy je nosil VSE generacije (R290+…+R313', 'deploy je nosil VSE generacije (R290+…+R314', 1)

# ── 3. Samoidentifikacijski razred (R307 lekcija 3 — self-avoiding) ──
zam("grep -qE 'R31[2]_PUSH|R312[_]COMMIT_ISO' \"$0\"", "grep -qE 'R31[3]_PUSH|R313[_]COMMIT_ISO' \"$0\"", 1)
zam('derive ostanki R312 PUSH/COMMIT meje v r313-prod-qa.sh', 'derive ostanki R313 PUSH/COMMIT meje v r314-prod-qa.sh', 1)

# ── 4. Z2 glava + R314 needle blok (za R313 blokom, po njegovem must_miss) ──
# (Z2 header komentar je ŽE v NOVA_GLAVA posodobljen na R314 ×18+6 — samo echo tu.)
zam(
  'echo "=== Z2: čanki — klient needleji (R313 ×4+6 + R312 ×5+3 + R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7',
  'echo "=== Z2: čanki — klient needleji (R314 ×18+6 + R313 ×4+6 + R312 ×5+3 + R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7', 1)
R313_MM = 'must_miss "TODO-R313" "R313 — brez razvojnih ostankov"'
R314_BLOK = '''must_miss "TODO-R313" "R313 — brez razvojnih ostankov"

echo "--- R314 MANDATORY — 44. člen: audit tabela na zaslonu + STIL val 5 (LIVE) ---"
# Vodja chunk nosi lib avtomatizacija-pregled (sklep template fragmenti +
# testidi — string literali preživijo minifikacijo; kanon ASCII/UTF-8).
# Značke = roksal žetoni (R225/R226 čisto); tabela = ČISTA projekcija EN VIR
# audita (števec izračunani — tabela ne sme sanjati; strazar R294 dokazuje
# poti na disku).
need "avtomatizacija-dokaz" "R314 blok testid (vodja chunk) — LIVE"
need "Avtomatizacija — audit po območjih" "R314 naslov (aria + glava) — LIVE"
need "Audit območij: " "R314 sklep glava (lib template) — LIVE"
need " — jedro deluje brez AI" "R314 sklep ničelna veja (lib ternara literal) — LIVE"
need " impl · " "R314 vrstica impl števec (izračunan) — LIVE"
need " dokazov" "R314 vrstica dokazi števec — LIVE"
need "strazar R294" "R314 title referenca (poti morajo obstajati) — LIVE"
need "mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" "R314 calculator zamrzovalna ikona (žeton na ikoni) — LIVE"
need "border-roksal-amber/40 bg-background text-roksal-ink hover:border-roksal-amber" "R314 calculator sidra gumb — LIVE"
need "border-roksal-amber/40 bg-roksal-amber/10 p-2 text-2xs text-roksal-ink" "R314 post-signature disclaimer — LIVE"
need "border-roksal-amber/40 bg-roksal-amber/10 p-3 text-xs text-roksal-ink" "R314 photo projekt warn — LIVE"
need "h-10 w-10 text-roksal-amber" "R314 photo camera error ikona — LIVE"
need "border-roksal-amber/40 bg-roksal-amber/10 px-2 py-1.5 text-2xs text-roksal-ink" "R314 photo navodila — LIVE"
need "border-roksal-amber/40 bg-roksal-amber/10 px-3 py-2 text-[11px] text-roksal-ink" "R314 photo priporočilo — LIVE"
need "hover:bg-roksal-amber/25" "R314 photo zapri hover (R312 Badge vzorec) — LIVE"
need "border-roksal-green/40 bg-roksal-green/10 text-roksal-green" "R314 DETERMINISTICNO značka (roksal žeton) — LIVE"
need "border-roksal-red/40 bg-roksal-red/10 text-roksal-red" "R314 AI_ZAHTEVANO značka (roksal žeton) — LIVE"
need "border-roksal-navy/25 bg-roksal-navy/5 text-roksal-ink dark:border-roksal-ink/20" "R314 SKRIPTA značka (r166 dark: obrata) — LIVE"
must_miss "bg-amber-50/60" "R314 calculator estrih surovi par (izginil — unikaten /60 fragment) — LIVE"
must_miss "border-amber-300 bg-white text-amber-800" "R314 calculator stari surovi čip (izginil — unikaten rep) — LIVE"
must_miss "border-amber-300 bg-amber-50 p-3" "R314 photo stari warn vsebnik (izginil — unikaten) — LIVE"
must_miss "h-8 w-8 mx-auto text-amber-500" "R314 post-signature stara Lock ikona (izginil — unikaten rep) — LIVE"
must_miss "hover:bg-amber-100" "R314 photo stari zapri hover (izginil) — LIVE"
must_miss "TODO-R314" "R314 — brez razvojnih ostankov"'''
zam(R313_MM, R314_BLOK, 1)

# ── 5. TODO veriga (R313 blok že nosi TODO-R312/R313; nov blok nosi TODO-R314) ──

# ── 6. Generacijske poti + zaključek ──
zam('/tmp/r313-', '/tmp/r314-', 30)
zam('__r313val', '__r314val', 4)
zam('=== R313 PROD QA — R290+…+R313 ŽIVO SKUPAJ ===', '=== R314 PROD QA — R290+…+R314 ŽIVO SKUPAJ ===', 1)

# ── Samoidentifikacija + ostanki + IZHODNA STRAN (R310 LEKCIJA) ──
assert 'R31[3]_PUSH|R313[_]COMMIT_ISO' in text, 'samoidentifikacijski razred manjka'
for ostanek in ('R313_COMMIT_ISO', 'R313_PUSH', '/tmp/r313-', '__r313val', 'r313-prod-chunks'):
    assert ostanek not in text, f'ostanek stare generacije: {ostanek}'
# Zgodovinske omembe R313 (needle blok labeli R313 PDF/STIL) ostanejo NAMERNO.
assert '\nset -u\n' in text, "'set -u' izgubljen (R310 LEKCIJA)"
assert 'more":"cvstudio' in text, 'cvstudio dispatch fix (R314) izgubljen v derive!'

DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
