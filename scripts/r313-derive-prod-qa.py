#!/usr/bin/env python3
# R313 — derive r313-prod-qa.sh iz r312-prod-qa.sh (UNION harvest dedovan;
# generacijski vzorec r305→…→r312). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed: napačno število zadetkov → izpisek + exit 1; štetja na
# POJAVITVE — LEKCIJA R312).
# Transformacije:
#   1. Glava: R313 kontekst (43. člen PDF meritve + STIL val 4 + ESKALACIJA
#      opomba: R312 deploy čaka na Vercel rate limit — retry 24h)
#   2. EPOCH meja: R312_* → R313_* (self-contained awk + git log)
#   3. Samoidentifikacijski razred: R31[1] → R31[2] (R307 lekcija 3)
#   4. Z2: R313 needle blok (PDF ×4 + STIL ×3 + must_miss ×2)
#   5. TODO veriga: + TODO-R312
#   6. Generacijske poti: /tmp/r312- → /tmp/r313-, __r312val → __r313val
# LEKCIJA R310/R311/R312: splice mora OHRANITI 'set -u' + izhodna-stran
# asercija + štetja = POJAVITVE (str.count), ne vrstice (grep -c).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r312-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r313-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')
lines = text.split('\n')

# ── 1. Glava: vrstice 1-45 (indeksi 0-44) zamenjane; 'set -u' (indeks 45) ostane ──
assert lines[0] == '#!/bin/bash', f'vrstica 1 ni shebang: {lines[0]!r}'
assert 'samozadetek' in lines[44], f'vrstica 45 ni konec glave: {lines[44]!r}'
assert lines[45] == 'set -u', f'vrstica 46 ni set -u: {lines[45]!r} (R310 LEKCIJA)'
NOVA_GLAVA = '''#!/bin/bash
# R313 — PRVA naloga (worklog R314): potrditi R290+…+R312+R313 SKUPAJ na produ.
#   ⚠️ ESKALACIJA R313: R312 deploy je NA VERCEL RATE LIMITU («Deployment rate
#      limited — retry in 24 hours», GitHub commit status — Hobby kvota).
#      Produ lahko ŠE VEDNO nosi R311 (build 10:56:03Z) tudi potem, ko ta
#      skripta pričakuje R313 — v tem primeru je ISKREN izid spet ESKALACIJA
#      (kanon R258: stale ni koda-bug; lokalna veriga R313 je polno zelena).
#      Ta skripta se teče ŠE ENKRAT po lastniškem deploy posredovanju.
#   R313 = 43. člen issue #1 «MERITVE ZMOGLJIVOSTI — PDF RAZŠIRITEV»
#      (Deliverable 6 dopolnitev): 2 realni PDF meritvi v bench —
#      konflikti.pdf (fonts + autoTable + bajti, ×4) + racuni-projekti.pdf
#      (12 računov × 4 projekti, ×4); ops 8 → 10, 1800 → 1808 iteracij; vsak
#      izhod preverjen z %PDF- magijo. + MANDATORY STIL val 4: cv-studio ×26 +
#      measurement-studio ×5 + crm-tab ×7 = 38 mest — surove amber → roksal
#      žetoni (0 novih hex); 5 izrecnih izjem (legend beseda, barvno kodirani
#      stanji kakovosti ×3 [red/amber/green lestvica], POTENCIALEN status —
#      R308/R234 lekcije) zaklenjene na SOURCE nivoju (r313 STRAŽAR blok).
#   Z0  build-guard (EPOCH): health build > R313 commit čas (git log —
#       self-contained meja) → R313 deploy potrjen (nosi R290+…+R313 — kanon
#       R280/R284), polni LIVE needle teki (R313 PDF ×4 + STIL ×3 + R312
#       zmogljivost ×5 + STIL ×3 + R311 AI raba ×5 + STIL ×2 + R310 STIL ×5 +
#       R309 ×4 + R308 ×7 + R307 ×11 + … + R295 ×9 + regresije).
#       build ≤ meja → **ESKALACIJA veja** (kanon R258) — iskren stale-dokaz +
#       Z1b + Z3 (ZERO-MUTACIJA). ZERO must_miss v stale veji (lekcija R294).
#   Z1  meritve tab ŽIVO — sync žig POGOJNO (kanon r277).
#   Z1b verzije ruta 404 + 'Meritev ne obstaja' (R276+ regresa). ZERO-MUTACIJA.
#   Z1c zvonček POGOJNI DOM probe + Z1d presežek note POGOJNI (R287/R289).
#   Z2  čanki needleji: R313 ×4+6 + R312 ×5+3 + R311 ×7+1 + R310 ×5+1 + R309 ×4+3 +
#       R308 ×7 + R307 ×11 + R306 ×11 + R295 ×8 + R294 ×9 + R293 ×8 + R292 ×8 +
#       R291 ×8 + R290 ×8 + regresije.
#   Z2b ŽIČNI EN VIR probei: val-1 ×4 + val-3 ×9 × pokvarjen JSON → 400 z ISTO
#       ovojnico + users 403 deny-first POZITIVNI dokaz (lekcija R311 1).
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R31[2]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).'''
lines[:45] = NOVA_GLAVA.split('\n')
text = '\n'.join(lines)
assert '\nset -u\n' in text, "'set -u' izgubljen pri splice (R310 LEKCIJA)"

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 2. EPOCH meja (R312 → R313; self-contained) ──
zam('R312_COMMIT_ISO', 'R313_COMMIT_ISO', 3)
zam("$2 ~ /^R312 —/ {", "$2 ~ /^R313 —/ {", 1)
zam('R312_PUSH', 'R313_PUSH', 5)
zam('R312 commita ni v git zgodovini', 'R313 commita ni v git zgodovini', 1)
zam('R312 deploy potrjen (build $BUILD > R312 commit meja', 'R313 deploy potrjen (build $BUILD > R313 commit meja', 1)
zam('R312 deploy detekcija', 'R313 deploy detekcija', 1)
zam('echo "R312 meja (commit čas, UTC):', 'echo "R313 meja (commit čas, UTC):', 1)
zam('≤ R312 commit meja', '≤ R313 commit meja', 1)
zam('R312 pričakuje SKUPNI deploy', 'R313 pričakuje SKUPNI deploy', 1)
zam('needleji pokrijejo R290+…+R312', 'needleji pokrijejo R290+…+R313', 1)
zam('deploy je nosil VSE generacije (R290+…+R312', 'deploy je nosil VSE generacije (R290+…+R313', 1)

# ── 3. Samoidentifikacijski razred (R307 lekcija 3 — self-avoiding) ──
zam("grep -qE 'R31[1]_PUSH|R311[_]COMMIT_ISO' \"$0\"", "grep -qE 'R31[2]_PUSH|R312[_]COMMIT_ISO' \"$0\"", 1)
zam('derive ostanki R311 PUSH/COMMIT meje v r312-prod-qa.sh', 'derive ostanki R312 PUSH/COMMIT meje v r313-prod-qa.sh', 1)

# ── 4. Z2 glava + R313 needle blok (za R312 blokom, po njegovem must_miss) ──
zam(
  'echo "=== Z2: čanki — klient needleji (R312 ×5+3 + R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7',
  'echo "=== Z2: čanki — klient needleji (R313 ×4+6 + R312 ×5+3 + R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7', 1)
R312_MM = 'must_miss "TODO-R312" "R312 — brez razvojnih ostankov"'
R313_BLOK = '''must_miss "TODO-R312" "R312 — brez razvojnih ostankov"

echo "--- R313 MANDATORY — 43. člen: PDF meritve + STIL val 4 (LIVE) ---"
# Vodja chunk nosi lib zmogljivost-pregled z PDF ops (id-ji + opisi so
# string literali — preživijo minifikacijo; kanon ASCII). PDF meritve so
# ŠELE po useEffect izrisu — needleji so chunk-level (build resnica).
need "konflikti.pdf" "R313 konflikti.pdf op id (lib) — LIVE"
need "Konflikti PDF dokument (fonts + autoTable + bajti)" "R313 konflikti.pdf opis — LIVE"
need "racuni-projekti.pdf" "R313 racuni-projekti.pdf op id — LIVE"
need "Računi po projektih PDF (12 računov × 4 projekti)" "R313 racuni-projekti.pdf opis — LIVE"
need "border-roksal-amber/40 bg-roksal-amber/10 py-2" "R313 cv-studio Alert vsebniki — LIVE"
need "border-roksal-amber/40 bg-roksal-amber/10 text-roksal-ink" "R313 cv-studio POTRDITEV značka cls — LIVE"
need "text-lg font-bold text-roksal-amber tabular-nums" "R313 crm KPI števec žeton — LIVE"
need "hover:bg-roksal-amber hover:text-roksal-navy" "R313 crm hover solid amber + navy — LIVE"
must_miss "border-amber-300 bg-amber-50 py-2" "R313 cv-studio surovi Alert (izginil — unikatna sekvenca) — LIVE"
must_miss "TODO-R313" "R313 — brez razvojnih ostankov"'''
zam(R312_MM, R313_BLOK, 1)

# ── 5. TODO veriga ostane (R312 blok že nosi TODO-R311/R310; nov blok nosi TODO-R313) ──

# ── 6. Generacijske poti + zaključek ──
zam('/tmp/r312-', '/tmp/r313-', 30)
zam('__r312val', '__r313val', 4)
zam('=== R312 PROD QA — R290+…+R312 ŽIVO SKUPAJ ===', '=== R313 PROD QA — R290+…+R313 ŽIVO SKUPAJ ===', 1)

# ── Samoidentifikacija + ostanki + IZHODNA STRAN (R310 LEKCIJA) ──
assert 'R31[2]_PUSH|R312[_]COMMIT_ISO' in text, 'samoidentifikacijski razred manjka'
for ostanek in ('R312_COMMIT_ISO', 'R312_PUSH', '/tmp/r312-', '__r312val', 'r312-prod-chunks'):
    assert ostanek not in text, f'ostanek stare generacije: {ostanek}'
# Zgodovinske omembe R312 (needle blok labeli R312 zmogljivost/STIL) ostanejo NAMERNO.
assert '\nset -u\n' in text, "'set -u' izgubljen (R310 LEKCIJA)"

DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
