#!/usr/bin/env python3
# R312 — derive r312-prod-qa.sh iz r311-prod-qa.sh (UNION harvest dedovan;
# generacijski vzorec r305→…→r311). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed: napačno število zadetkov → izpisek + exit 1).
# Transformacije:
#   1. Glava: R312 kontekst (42. člen meritve zmogljivosti + STIL val 3)
#   2. EPOCH meja: R311_* → R312_* (self-contained awk + git log)
#   3. Samoidentifikacijski razred: R31[0] → R31[1] (R307 lekcija 3)
#   4. Z2: R312 needle blok (zmogljivost ×5 + STIL ×3 + must_miss /70 unikaten)
#   5. TODO veriga: + TODO-R311
#   6. Generacijske poti: /tmp/r311- → /tmp/r312-, __r311val → __r312val
# LEKCIJA R310/R311: splice mora OHRANITI 'set -u' + izhodna-stran asercija
# (vnosne asercije NE pokrijejo rezultata splice) + štetja = OCCURRENCES ne
# vrstice (grep -c šteje vrstice — LEKCIJA R312 derive-e2e).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r311-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r312-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')
lines = text.split('\n')

# ── 1. Glava: vrstice 1-37 (indeksi 0-36) zamenjane; 'set -u' (indeks 37) ostane ──
assert lines[0] == '#!/bin/bash', f'vrstica 1 ni shebang: {lines[0]!r}'
assert 'samozadetek' in lines[39], f'vrstica 40 ni konec glave: {lines[39]!r}'
assert lines[40] == 'set -u', f'vrstica 41 ni set -u: {lines[40]!r} (R310 LEKCIJA — splice ne sme pogoltniti)'
NOVA_GLAVA = '''#!/bin/bash
# R312 — PRVA naloga (worklog R313): potrditi R290+…+R311+R312 SKUPAJ na produ.
#   R312 = 42. člen issue #1 «MERITVE ZMOGLJIVOSTI» (Deliverable 6): lib
#   zmogljivost-pregled — realne meritve pomembnih determinističnih operacij
#   jedra (kalkulator ×2, konfliktni pregled/dokaz/CSV, termini urAgregat/CSV,
#   AI raba projekcija) na FIKSNIH vhodih; vsak izhod vsake iteracije PREVERJEN
#   (merjenje pokvare funkcije = lažna resnica → TypeError); DI ura za
#   determinizem strukture; časi strojno odvisni (iskrena resnica 'na tej
#   napravi'); vodja blok WYSIWYG [zmogljivost-dokaz], izris ŠELE v
#   brskalniku (nič SSR laži). + MANDATORY STIL val 3: dashboard-tab ×16 +
#   logistics-tab ×7 + webxr-scanner ×8 — surove amber → roksal žetoni (0
#   novih hex); 2 izrecni izjemi (STATUS_COLORS.V_TEKU +
#   EQUIPMENT_STATUS_COLORS.V_SERVISU — kategorije barv med sorodniki, R308
#   lekcija + R234 komentar) zaklenjeni na SOURCE nivoju (r312 STRAŽAR).
#   Z0  build-guard (EPOCH): health build > R312 commit čas (git log —
#       self-contained meja; push sledi commitu v sekundah, zato je commit-čas
#       STROŽJA in pravilna meja: med commitom in pushom ni Vercel builda)
#       → R312 deploy potrjen (nosi R290+…+R312 — kanon R280/R284),
#       polni LIVE needle teki (R312 zmogljivost ×5 + STIL ×3 + R311 AI raba ×5 +
#       STIL ×2 + R310 STIL punch/team ×5 + R309 STIL harmonizacija ×4 +
#       R308 API I/O meja ×7 + R307 Konflikti dokaz ×11 + R306 Oprema cikel dokaz ×11 +
#       R305 Tedenski pregled po dnevih ×11 + R304 Vodja tedenski CSV ×11 +
#       R303 Vodja tedenski PDF ×11 + R302 Konflikti PDF ×11 + R301 Konflikti CSV ×11 +
#       R300 mini ×11 + R299 ICS po ekipah ×16 + R298 ICS ×13 + R297 Oprema CSV ×10 +
#       R296 ICS ×11 + R295 ×9 + regresije).
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
#   Z2  čanki needleji: R312 ×5+3 + R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7 +
#       R307 ×11 + R306 ×11 + R295 ×8 + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 +
#       R290 ×8 + regresije.
#   Z2b ŽIČNI EN VIR probei: val-1 ×4 + val-3 ×9 × pokvarjen JSON → 400 z ISTO
#       ovojnico + users 403 deny-first POZITIVNI dokaz (lekcija R311 1).
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R31[1]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).'''
lines[:40] = NOVA_GLAVA.split('\n')
text = '\n'.join(lines)
assert '\nset -u\n' in text, "'set -u' izgubljen pri splice (R310 LEKCIJA)"

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 2. EPOCH meja (R311 → R312; self-contained) ──
zam('R311_COMMIT_ISO', 'R312_COMMIT_ISO', 3)
zam("$2 ~ /^R311 —/ {", "$2 ~ /^R312 —/ {", 1)
zam('R311_PUSH', 'R312_PUSH', 5)
zam('R311 commita ni v git zgodovini', 'R312 commita ni v git zgodovini', 1)
zam('R311 deploy potrjen (build $BUILD > R311 commit meja', 'R312 deploy potrjen (build $BUILD > R312 commit meja', 1)
zam('R311 deploy detekcija', 'R312 deploy detekcija', 1)
zam('echo "R311 meja (commit čas, UTC):', 'echo "R312 meja (commit čas, UTC):', 1)
zam('≤ R311 commit meja', '≤ R312 commit meja', 1)
zam('R311 pričakuje SKUPNI deploy', 'R312 pričakuje SKUPNI deploy', 1)
zam('needleji pokrijejo R290+…+R311', 'needleji pokrijejo R290+…+R312', 1)
zam('deploy je nosil VSE generacije (R290+…+R311', 'deploy je nosil VSE generacije (R290+…+R312', 1)

# ── 3. Samoidentifikacijski razred (R307 lekcija 3 — self-avoiding) ──
zam("grep -qE 'R31[0]_PUSH|R310[_]COMMIT_ISO' \"$0\"", "grep -qE 'R31[1]_PUSH|R311[_]COMMIT_ISO' \"$0\"", 1)
zam('derive ostanki R310 PUSH/COMMIT meje v r311-prod-qa.sh', 'derive ostanki R311 PUSH/COMMIT meje v r312-prod-qa.sh', 1)

# ── 4. Z2 glava + R312 needle blok (za R311 blokom, po njegovem must_miss) ──
zam(
  'echo "=== Z2: čanki — klient needleji (R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7',
  'echo "=== Z2: čanki — klient needleji (R312 ×5+3 + R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7', 1)
R311_MM = 'must_miss "border-amber-400/50 dark:border-amber-700/50" "R311 measurements surova dashed zona (izginila — unikatna sekvenca) — LIVE"'
R312_BLOK = R311_MM + '''

echo "--- R312 MANDATORY — 42. člen: meritve zmogljivosti jedra + STIL val 3 (LIVE) ---"
# Vodja chunk (dispatch more:'vodja' ŽE v harvestu) nosi lib
# zmogljivost-pregled (EN VIR — sklep template literali preživijo
# minifikacijo kot string literali — kanon ASCII); blok izris ŠELE v
# brskalniku → na produ se meri prava naprava (iskrena resnica).
need "zmogljivost-dokaz" "R312 blok testid (vodja chunk) — LIVE"
need "Meritve zmogljivosti jedra" "R312 naslov (aria + glava) — LIVE"
need "Merjeno na tej napravi: " "R312 sklep fragment (lib template) — LIVE"
need "vsi izhodi preverjeni — časi so resnična meritev" "R312 sklep iskrenost (lib template) — LIVE"
need "brez izvedene meritve ni izmišljenih števil" "R312 fail-closed izris — LIVE"
need "border border-roksal-amber/40 bg-roksal-amber/10 px-2.5 py-2" "R312 dashboard baner žeton (×2) — LIVE"
need "bg-roksal-amber/15 text-roksal-amber hover:bg-roksal-amber/25" "R312 Badge žeton besedilo — LIVE"
need "border-roksal-amber/40 bg-roksal-amber/10 px-1.5 py-0.5 text-roksal-ink" "R312 logistics kalibracijska pilona — LIVE"
must_miss "bg-amber-50/70" "R312 dashboard surovi baner (izginil — unikatni /70 fragment) — LIVE"
must_miss "text-amber-700/90" "R312 dashboard surovo telo (izginilo — unikaten fragment) — LIVE"
must_miss "TODO-R312" "R312 — brez razvojnih ostankov"'''
zam(R311_MM, R312_BLOK, 1)

# ── 5. TODO veriga: + TODO-R311 ──
zam('must_miss "TODO-R310" "R310 — brez razvojnih ostankov (izginil)"',
    'must_miss "TODO-R311" "R311 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R310" "R310 — brez razvojnih ostankov (izginil)"', 1)

# ── 6. Generacijske poti + zaključek ──
zam('/tmp/r311-', '/tmp/r312-', 30)
zam('__r311val', '__r312val', 4)
zam('=== R311 PROD QA — R290+…+R311 ŽIVO SKUPAJ ===', '=== R312 PROD QA — R290+…+R312 ŽIVO SKUPAJ ===', 1)

# ── Samoidentifikacija + ostanki + IZHODNA STRAN (R310/R311 LEKCIJA) ──
assert 'R31[1]_PUSH|R311[_]COMMIT_ISO' in text, 'samoidentifikacijski razred manjka'
for ostanek in ('R311_COMMIT_ISO', 'R311_PUSH', '/tmp/r311-', '__r311val', 'r311-prod-chunks'):
    assert ostanek not in text, f'ostanek stare generacije: {ostanek}'
# Zgodovinske omembe R311 (needle blok labeli R311 AI raba/STIL) ostanejo NAMERNO.
assert '\nset -u\n' in text, "'set -u' izgubljen (R310 LEKCIJA)"

DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
