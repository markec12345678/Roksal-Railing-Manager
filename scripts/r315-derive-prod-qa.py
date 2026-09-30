#!/usr/bin/env python3
# R315 — derive r315-prod-qa.sh iz r314-prod-qa.sh (UNION harvest dedovan;
# generacijski vzorec r305→…→r314). VSAKA zamenjava je NATANKO
# ena-n-točkovna (fail-closed: napačno število zadetkov → izpisek + exit 1;
# štetja na POJAVITVE — LEKCIJA R312).
# Transformacije:
#   1. Glava: R315 kontekst (45. člen končna verifikacija + STIL val 6;
#      ✅ ESKALACIJA R314 ZAPRTA med R315 Task 1 — deploy 13:36:47.518Z >
#      meja 13:36:22; LIVE veja EXIT=0, 353 OK, 54 čankov, ZERO miss;
#      2 popravka QA orodja: vodja PRIME [hladen edge čank za MONTER sejo] +
#      calculator/photos dispatcha [pokritost sledi needle pokritosti —
#      R314 lekcija 1 ponovitev; aplikacija zdrava: vir + build + DOM dokaz])
#   2. EPOCH meja: R314_* → R315_* (self-contained awk + git log)
#   3. Samoidentifikacijski razred: R31[3] → R31[4] (R307 lekcija 3)
#   4. Z2: R315 needle blok (verifikacija ×10 + STIL ×11 + must_miss ×6) —
#      PO R314 bloku (TODO-R314 sidro)
#   5. TODO veriga: + TODO-R315
#   6. Generacijske poti: /tmp/r314- → /tmp/r315-, __r314val → __r315val
# LEKCIJA R310/R311/R312: splice mora OHRANITI 'set -u' + izhodna-stran
# asercija + štetja = POJAVITVE (str.count), ne vrstice (grep -c).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r314-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r315-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')
lines = text.split('\n')

# ── 1. Glava: vrstice 1-41 (indeksi 0-40) zamenjane; 'set -u' (indeks 41) ostane ──
assert lines[0] == '#!/bin/bash', f'vrstica 1 ni shebang: {lines[0]!r}'
assert 'samozadetek' in lines[40], f'vrstica 41 ni konec glave: {lines[40]!r}'
assert lines[41] == 'set -u', f'vrstica 42 ni set -u: {lines[41]!r} (R310 LEKCIJA)'
NOVA_GLAVA = '''#!/bin/bash
# R315 — PRVA naloga (worklog R315): potrditi R290+…+R314+R315 SKUPAJ na produ.
#   ✅ ESKALACIJA R314 ZAPRTA (med R315 Task 1): R314 deploy uspešen
#      13:36:47.518Z > meja 13:36:22 (EPOCH guard) — polna LIVE veja EXIT=0
#      (353 OK, 54 čankov, ZERO MISS/HIT; R290+…+R314 SKUPAJ — kanon UNION
#      harvest).
#   ⚠️ 2 POPRAVKA QA ORODJJA (R315 Task 1, aplikacija ZDRAVA — vir + build
#      čanke + DOM aria dokaz vsi zeleni):
#      (a) vodja PRIME v OBEH vejah — vodja čank je HLADEN na Vercel edge za
#          spot/MONTER sejo (redna raba samo VODJA vloga) → prvi harvest ga
#          lahko zgreši (47/50 URL-jev; R293 needleja MISS brez string-regrese;
#          repro: posamezen dispatch vodja = čank ŽIVO [DOM csvGumb+marzaStrip
#          true, chunk-25 nosi oba needleja]) — dispatch NE reloada, vnosi
#          akumulirajo (kanon R297);
#      (b) calculator + photos dispatcha DODANA v harvest zanko OBEH vej —
#          R314 STIL val 5 needleji (calculator-tab + photo-tab čanki) so
#          bili 5× MISS na prvem LIVE teku r314-prod-qa.sh: pokritost NI
#          sledila needle pokritosti (LEKCIJA R314 1 ponovitev — prvi LIVE
#          tek nove generacije je prvi tek novih needlejev).
#   R315 = 45. člen issue #1 «KONČNA VERIFIKACIJA PROTI HEAD» (Deliverable 7
#      NA ZASLONU + DOKUMENTIRANO): NOV lib koncna-verifikacija (ČISTA
#      projekcija EN VIR resnic — vsako območje audita §1–§11 z IZRECNO vezavo
#      na verifikacijske plasti [vitest · build-needleji · E2E ŽIVO · prod-qa
#      · smoke] + 8 sprejemnih kriterijev z mehanično izpeljavo in konkretnim
#      dokazom; totalen fail-closed join ×8; docs/koncna-verifikacija-head.md);
#      blok na vodji [koncna-verifikacija-dokaz/vrstica/kriterij/sklep].
#      + MANDATORY STIL val 6: inclinometer-tab ×5 + site-survey-tab ×4 +
#      ar-scanner ×3 + pwa-status ×3 + password-change-banner ×3 (+2 ikona
#      žetoni) = 19 dotikov — surove amber → roksal žetoni (0 novih hex);
#      2 novi izjemi ZAKLENJENI (inclinometer senzorjska lestvica
#      denied=red/unsupported=amber; site-survey PODLAGA kategorija barv z
#      rdečim bratom — R308/R311 precedens; r315-stil-val6 STRAŽAR).
#   Z0  build-guard (EPOCH): health build > R315 commit čas (git log —
#       self-contained meja) → R315 deploy potrjen (nosi R290+…+R315 — kanon
#       R280/R284), polni LIVE needle teki (R315 verifikacija ×10 + STIL ×11 +
#       R314 audit ×18 + STIL ×11 + R313 PDF ×4 + STIL ×3 + R312 zmogljivost
#       ×5 + STIL ×3 + R311 AI raba ×5 + STIL ×2 + R310 STIL ×5 + R309 ×4 +
#       R308 ×7 + R307 ×11 + … + R295 ×9 + regresije).
#       build ≤ meja → **ESKALACIJA veja** (kanon R258) — iskren stale-dokaz +
#       Z1b + Z3 (ZERO-MUTACIJA). ZERO must_miss v stale veji (lekcija R294).
#   Z1  meritve tab ŽIVO — sync žig POGOJNO (kanon r277).
#   Z1b verzije ruta 404 + 'Meritev ne obstaja' (R276+ regresa). ZERO-MUTACIJA.
#   Z1c zvonček POGOJNI DOM probe + Z1d presežek note POGOJNI (R287/R289).
#   Z2  čanki needleji: R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 +
#       R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7 + R307 ×11 + R306 ×11 +
#       R295 ×8 + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije.
#   Z2b ŽIČNI EN VIR probei: val-1 ×4 + val-3 ×9 × pokvarjen JSON → 400 z ISTO
#       ovojnico + users 403 deny-first POZITIVNI dokaz (lekcija R311 1).
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R31[4]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).'''

# ── 2. EPOCH meja + self-id (PRED potmi — nizi nosijo R315) ──
def zam(staro, novi, pricakuj=1):
    global text
    n = text.count(staro)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {staro[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(staro, novi)

# Glava splice (najprej — potem se nizi/neučitni javljajo v novi glavi)
lines = [NOVA_GLAVA] + lines[41:]
text = '\n'.join(lines)

zam('R314_COMMIT_ISO', 'R315_COMMIT_ISO', 3)   # awk izpis + [ -n ...] + R314_PUSH=...
zam('R314_PUSH', 'R315_PUSH', 5)               # export + echo + python argv + stale banner + LIVE echo
zam("$2 ~ /^R314 —/", "$2 ~ /^R315 —/", 1)     # awk anchor (LEKCIJA R310 2: poševnik z mejo)
zam('R31[3]_PUSH|R313[_]COMMIT_ISO', 'R31[4]_PUSH|R314[_]COMMIT_ISO', 1)  # self-id (razred znakov — R307 3)
zam('derive ostanki R313 PUSH/COMMIT meje v r314-prod-qa.sh', 'derive ostanki R314 PUSH/COMMIT meje v r315-prod-qa.sh', 1)
zam('FAIL-CLOSED: R314 commita ni v git zgodovini', 'FAIL-CLOSED: R315 commita ni v git zgodovini', 1)
# 30 POJAVITEV ≠ 28 vrstic (LEKCIJA R312/R314 4: str.count ≠ grep -c)
zam('/tmp/r314-', '/tmp/r315-', 30)
zam('__r314val', '__r315val', 4)  # 4 POJAVITVE ≠ 2 vrstici (LEKCIJA R312 — r314 derive že zapisal isto)

# ── 4. R315 needle blok: splice PO TODO-R314 must_miss vrstici ──
SIDRO = 'must_miss "TODO-R314" "R314 — brez razvojnih ostankov"\n'
R315_BLOK = SIDRO + '''
echo "--- R315 MANDATORY — 45. člen: končna verifikacija proti HEAD + STIL val 6 (LIVE) ---"
# Vodja chunk nosi lib koncna-verifikacija (sklep template fragmenti +
# testidi — string literali preživijo minifikacijo; kanon ASCII/UTF-8).
# ČISTA projekcija EN VIR (totalen fail-closed join — verifikacija ne sme
# sanjati); STIL val 6 = žetoni (19 dotikov; izjeme na SOURCE nivoju
# r315-stil-val6 STRAŽAR).
need "koncna-verifikacija-dokaz" "R315 blok testid (vodja chunk) — LIVE"
need "koncna-verifikacija-kriterij" "R315 kriterij testid — LIVE"
need "Končna verifikacija — dokazne plasti" "R315 naslov (aria + glava) — LIVE"
need "Končna verifikacija: " "R315 sklep glava (lib template) — LIVE"
need "območij z dokaznimi plastmi" "R315 sklep števec fragment (izračunan) — LIVE"
need "plasti v dokazih: " "R315 sklep plasti fragment — LIVE"
need "Sprejemni kriteriji (issue #1):" "R315 kriteriji podnaslov (JSX literal) — LIVE"
need "Plast: " "R315 plast chip title (WYSIWYG) — LIVE"
need " — jedro deluje brez AI" "R315 sklep ničelna veja (skupna z R314 — EN VIR ternara) — LIVE"
need "izpeljava:" "R315 kriterij izpeljava oznaka (JSX) — LIVE"
need "border-roksal-amber/40 bg-roksal-amber/10 px-3 py-2.5" "R315 inclinometer NAPAKA vsebnik (žeton) — LIVE"
need "mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" "R315 inclinometer ikona (žeton na ikoni — r162) — LIVE"
need "bg-roksal-amber/10 px-2.5 py-2 text-2xs font-medium leading-relaxed text-roksal-ink" "R315 site-survey estrih opomba (vsebnik + ink) — LIVE"
need "mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" "R315 site-survey opomba ikona (žeton na ikoni) — LIVE"
need "bg-roksal-amber/90 text-white border-transparent shadow-md animate-pulse" "R315 ar-scanner lowLight značka (solid žeton + belo) — LIVE"
need "flex-1 accent-roksal-amber" "R315 ar-scanner zoom accent (accent žeton) — LIVE"
need "bg-roksal-amber/15 text-roksal-ink" "R315 ar-scanner zaupanje značka (vsebnik + ink) — LIVE"
need "bg-roksal-amber/10 px-3 py-2 text-roksal-ink shadow-sm" "R315 pwa-status offline baner (vsebnik + ink) — LIVE"
need "bg-roksal-amber px-1.5 text-2xs font-bold text-white" "R315 pwa-status čakalna značka (solid žeton + belo) — LIVE"
need "h-7 bg-roksal-amber text-[11px] text-white hover:bg-roksal-amber/90" "R315 password gumb (solid žeton + hover /90) — LIVE"
need "border-roksal-navy/20 bg-roksal-navy/[0.04] px-1 py-px text-[9px] font-semibold" "R315 plast chip (navy žeton + dark: obrata — r166) — LIVE"
must_miss "bg-amber-50/40" "R315 site-survey estrih surovi par (izginil — unikaten /40 fragment) — LIVE"
must_miss "bg-amber-100 dark:bg-amber-500/15 px-2.5" "R315 site-survey stari opomba vsebnik (izginil — unikaten px-2.5 rep) — LIVE"
must_miss "accent-amber-500" "R315 ar-scanner stari zoom accent (izginil) — LIVE"
must_miss "bg-amber-100 text-amber-700" "R315 ar-scanner stara zaupanje značka (izginil — unikatna sekvenca) — LIVE"
must_miss "hover:bg-amber-700" "R315 password stari gumb hover (izginil) — LIVE"
must_miss "TODO-R315" "R315 — brez razvojnih ostankov"
'''
n = text.count(SIDRO)
if n != 1:
    print(f'FAIL-CLOSED: TODO-R314 sidro — najdeno {n}×, pričakovano 1×')
    sys.exit(1)
text = text.replace(SIDRO, R315_BLOK)

# ── 5. Izhodna asercija (LEKCIJA R310 5: VHOD+IZHOD) ──
assert 'R314_PUSH' not in text, 'IZHOD: R314_PUSH ostanki'
assert 'R314_COMMIT_ISO' not in text, 'IZHOD: R314_COMMIT_ISO ostanki'
assert 'R31[3]_PUSH' not in text, 'IZHOD: self-id ostanki'
assert '/tmp/r314-' not in text, 'IZHOD: /tmp/r314- ostanki'
assert '__r314val' not in text, 'IZHOD: __r314val ostanki'
assert 'R315_BLOK' in text or 'koncna-verifikacija-dokaz' in text, 'IZHOD: R315 blok manjka'
assert 'must_miss "TODO-R315"' in text, 'IZHOD: TODO-R315 manjka'
assert 'must_miss "TODO-R314"' in text, 'IZHOD: TODO-R314 (veriga) manjka'
assert text.split('\n')[NOVA_GLAVA.count('\n') + 1] == 'set -u', 'IZHOD: set -u izgubljen (LEKCIJA R310 5)'
DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
