#!/usr/bin/env python3
# R311 — derive r311-prod-qa.sh iz r310-prod-qa.sh (UNION harvest dedovan;
# generacijski vzorec r305→…→r310). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed: napačno število zadetkov → izpisek + exit 1).
# Transformacije:
#   1. Glava: R311 kontekst (41. člen AI raba + STIL val 2 + Z2b resnica)
#   2. EPOCH meja: R310_* → R311_* (self-contained awk + git log)
#   3. Samoidentifikacijski razred: R30[9] → R31[0] (R307 lekcija 3)
#   4. Z2: R311 needle blok (AI raba ×5 + STIL ×2 + must_miss dashed unikaten)
#   5. TODO veriga: + TODO-R310
#   6. Generacijske poti: /tmp/r310- → /tmp/r311-, __r310val → __r311val
# LEKCIJA R311 (popravek R310 napake): splice mora OHRANITI 'set -u' +
# izhodna-stran asercija (vnosne asercije NE pokrijejo rezultata splice).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r310-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r311-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')
lines = text.split('\n')

# ── 1. Glava: vrstice 1-37 (indeksi 0-36) zamenjane; 'set -u' (indeks 37) ostane ──
assert lines[0] == '#!/bin/bash', f'vrstica 1 ni shebang: {lines[0]!r}'
assert 'samozadetek' in lines[37], f'vrstica 38 ni konec glave: {lines[37]!r}'
assert lines[38] == 'set -u', f'vrstica 39 ni set -u: {lines[38]!r} (R310 LEKCIJA — splice ne sme pogoltniti)'
NOVA_GLAVA = '''#!/bin/bash
# R311 — PRVA naloga (worklog R312): potrditi R290+…+R310+R311 SKUPAJ na produ.
#   R311 = 41. člen issue #1 «AI raba — iskrena resnica» (Deliverable 5 NA
#   ZASLONU): lib ai-raba-pregled — ČISTA projekcija katalog ('ai' vnosi z
#   IZREČENIM nadomestkom) × AI_KANDIDATI (3 × NE-IMPLEMENTIRANO — iskreni,
#   nič povezano); vodja blok WYSIWYG [ai-raba-dokaz]; fail-closed
#   (AI-brez-nadomestka / nadomestek-ne-obstaja / kandidat-brez-zakaj →
#   TypeError). + MANDATORY STIL val 2: measurements-tab ×13 mest +
#   material-intelligence-tab ×10 + deal-pipeline spomnik ×2 — surove amber →
#   roksal žetoni (0 novih hex); 6 izrecnih izjem (kategorije barv / gola-text
#   lestvice — R308 lekcija) zaklenjene na SOURCE nivoju (r311 STRAŽAR).
#   Z0  build-guard (EPOCH): health build > R311 commit čas (git log —
#       self-contained meja; push sledi commitu v sekundah, zato je commit-čas
#       STROŽJA in pravilna meja: med commitom in pushom ni Vercel builda)
#       → R311 deploy potrjen (nosi R290+…+R311 — kanon R280/R284),
#       polni LIVE needle teki (R311 AI raba ×5 + STIL ×2 + R310 STIL punch/team ×5 +
#       R309 STIL harmonizacija ×4 + R308 API I/O meja ×7 + R307 Konflikti dokaz ×11 +
#       R306 Oprema cikel dokaz ×11 + R305 Tedenski pregled po dnevih ×11 +
#       R304 Vodja tedenski CSV ×11 + R303 Vodja tedenski PDF ×11 + R302 Konflikti PDF ×11 +
#       R301 Konflikti CSV ×11 + R300 mini ×11 + R299 ICS po ekipah ×16 + R298 ICS ×13 +
#       R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).
#       build ≤ meja → **ESKALACIJA veja** (kanon R258: prod stale ni koda-bug
#       — lokalni buildi ✓; needleji bi lažno FAILali). Izvede se ISKREN
#       stale-dokaz: R289/R288/R287/R227 LIVE needleji (zdrav vzorec stale
#       builda) + R290/R291/R292/R293/R294 pilli LIVE (pogojno po EPOCH) +
#       Z1b + Z3 (ZERO-MUTACIJA). ZERO must_miss v stale veji —
#       skew protection lekcija R294: pill-level must_miss je vrstno ranljivo
#       po pushu; avtoritativni detektor = EPOCH build-guard.
#       EXIT=0 z ESKALACIJA žigom — runda nadaljuje lokalno, eskalacija gre
#       LASTNIKU (Vercel dashboard — stuck/limit).
#   Z1  meritve tab ŽIVO — sync žig POGOJNO (kanon r277).
#   Z1b verzije ruta 404 + 'Meritev ne obstaja' (R276+ regresa). ZERO-MUTACIJA.
#   Z1c zvonček POGOJNI DOM probe + Z1d presežek note POGOJNI (R287/R289).
#   Z2  čanki needleji: R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7 + R307 ×11 +
#       R306 ×11 + R295 ×8 + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije.
#   Z2b ŽIČNI EN VIR probei: val-1 ×4 + val-3 ×9 × pokvarjen JSON → 400 z ISTO
#       ovojnico + users 403 deny-first POZITIVNI dokaz (lekcija R311 1).
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R31[0]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).'''
lines[:38] = NOVA_GLAVA.split('\n')
text = '\n'.join(lines)
assert '\nset -u\n' in text, "'set -u' izgubljen pri splice (R310 LEKCIJA)"

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 2. EPOCH meja (R310 → R311; self-contained) ──
zam('R310_COMMIT_ISO', 'R311_COMMIT_ISO', 3)
zam("$2 ~ /^R310 —/ {", "$2 ~ /^R311 —/ {", 1)
zam('R310_PUSH', 'R311_PUSH', 5)
zam('R310 commita ni v git zgodovini', 'R311 commita ni v git zgodovini', 1)
zam('R310 deploy potrjen (build $BUILD > R309 commit meja', 'R311 deploy potrjen (build $BUILD > R311 commit meja', 1)  # LEKCIJA: label v telesu (stale R309 ostank ujet šele zdaj)
zam('R310 deploy detekcija', 'R311 deploy detekcija', 1)
zam('echo "R310 meja (commit čas, UTC):', 'echo "R311 meja (commit čas, UTC):', 1)
zam('≤ R310 commit meja', '≤ R311 commit meja', 1)
zam('R309 pričakuje SKUPNI deploy', 'R311 pričakuje SKUPNI deploy', 1)
zam('needleji pokrijejo R290+…+R308', 'needleji pokrijejo R290+…+R311', 1)
zam('deploy je nosil VSE generacije (R290+…+R309', 'deploy je nosil VSE generacije (R290+…+R311', 1)

# ── 3. Samoidentifikacijski razled (R307 lekcija 3 — self-avoiding) ──
zam("grep -qE 'R30[9]_PUSH|R309[_]COMMIT_ISO' \"$0\"", "grep -qE 'R31[0]_PUSH|R310[_]COMMIT_ISO' \"$0\"", 1)
zam('derive ostanki R309 PUSH/COMMIT meje v r310-prod-qa.sh', 'derive ostanki R310 PUSH/COMMIT meje v r311-prod-qa.sh', 1)

# ── 4. Z2 glava + R311 needle blok (za R310 blokom, po njegovem must_miss) ──
zam(
  'echo "=== Z2: čanki — klient needleji (R310 ×5+1 + R309 ×4+3 + R308 ×7',
  'echo "=== Z2: čanki — klient needleji (R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7', 1)
R310_MM = 'must_miss "border-amber-500 bg-amber-100 dark:bg-amber-500/15 text-amber-600" "R310 punch surov krog par (izginil) — LIVE"'
R311_BLOK = R310_MM + '''

echo "--- R311 MANDATORY — 41. člen: AI raba dokaz na zaslonu + STIL val 2 (LIVE) ---"
# Vodja chunk (dispatch more:'vodja' ŽE v harvestu) nosi lib ai-raba-pregled
# (EN VIR projekcija — kandidati status + sklep fragmenti so lib template
# literali, preživijo minifikacijo kot string literali — kanon ASCII).
need "ai-raba-dokaz" "R311 blok testid (vodja chunk) — LIVE"
need "AI raba — iskrena resnica" "R311 naslov (aria + glava) — LIVE"
need "→ nadomestek (brez AI): " "R311 nadomestek literal — LIVE"
need "NE-IMPLEMENTIRANO — kandidat (nič povezano)" "R311 kandidati status verbatim — LIVE"
need "AI-obveznih: 0 — jedro deluje brez AI" "R311 sklep ničla (lib template) — LIVE"
need "border-dashed border-roksal-amber/50" "R311 measurements dashed zona (žetoni) — LIVE"
need "bg-roksal-amber text-roksal-navy" "R311 WPC ikona vsebnik (žeton par) — LIVE"
must_miss "border-amber-400/50 dark:border-amber-700/50" "R311 measurements surova dashed zona (izginila — unikatna sekvenca) — LIVE"'''
zam(R310_MM, R311_BLOK, 1)

# ── 5. TODO veriga: + TODO-R310 ──
zam('must_miss "TODO-R309" "R309 — brez razvojnih ostankov (izginil)"',
    'must_miss "TODO-R310" "R310 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R309" "R309 — brez razvojnih ostankov (izginil)"', 1)

# ── 6. Generacijske poti + zaključek ──
zam('/tmp/r310-', '/tmp/r311-', 30)
zam('__r310val', '__r311val', 4)
zam('=== R310 PROD QA — R290+…+R310 ŽIVO SKUPAJ ===', '=== R311 PROD QA — R290+…+R311 ŽIVO SKUPAJ ===', 1)

# ── Samoidentifikacija + ostanki + IZHODNA STRAN (R310 LEKCIJA) ──
assert 'R31[0]_PUSH|R310[_]COMMIT_ISO' in text, 'samoidentifikacijski razred manjka'
for ostanek in ('R310_COMMIT_ISO', 'R310_PUSH', '/tmp/r310-', '__r310val', 'r310-prod-chunks'):
    assert ostanek not in text, f'ostanek stare generacije: {ostanek}'
# Zgodovinske omembe R310 (needle blok labeli R310 STIL) ostanejo NAMERNO.
assert '\nset -u\n' in text, "'set -u' izgubljen (R310 LEKCIJA)"

DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
