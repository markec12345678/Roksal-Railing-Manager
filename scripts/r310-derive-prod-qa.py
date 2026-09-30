#!/usr/bin/env python3
# R310 — derive r310-prod-qa.sh iz r309-prod-qa.sh (UNION harvest dedovan;
# vzorec r305→r306→…→r309 generacij). VSAKA zamenjava je NATANKO ena
# n-točkovna (exact-match, fail-closed: manjkajoča točna vrstica → izpisek +
# exit 1 — NIČ tihih no-op, kanon migriraj-val3).
# Transformacije:
#   1. Glava (vrstice 1-30): R310 kontekst (3. val + STIL punch/team + val-3 žica)
#   2. EPOCH meja: R309_COMMIT_ISO/^R309 —/R309_PUSH → R310_* (self-contained)
#   3. Samoidentifikacijski razred: R30[8]_PUSH preverba → R30[9]_PUSH (R307 lekcija 3)
#   4. Z2: R310 STIL needle blok (5 pozitivnih + 1 must_miss — enolično
#      pripisljivi; deljene surove sekvene → SOURCE nivo r310 val3 test, R308 lekcija 3)
#   5. Z2b: val-1 ×4 + val-3 ×10 = 14 žičnih probeov (val-3 podmnožica brez
#      deny-first vrat — equipment IZVZET, verificirano v viru R310)
#   6. TODO veriga: + must_miss TODO-R309 (R309 ni pustil ostankov)
#   7. Generacijske poti: /tmp/r309-* → /tmp/r310-*, __r309val → __r310val
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r309-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r310-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')
lines = text.split('\n')

# ── 1. Glava: vrstice 1-36 zamenjane (preverba: 1 = shebang, 37 = set -u) ──
assert lines[0] == '#!/bin/bash', f'vrstica 1 ni shebang: {lines[0]!r}'
assert 'samozadetek' in lines[35], f'vrstica 36 ni konec glave: {lines[35]!r}'
assert lines[36] == 'set -u', f'vrstica 37 ni set -u: {lines[36]!r}'
NOVA_GLAVA = '''#!/bin/bash
# R310 — PRVA naloga (worklog R311): potrditi R290+…+R309+R310 SKUPAJ na produ.
#   R310 = ZAKLJUČEK «stene ure» (issue #1 38./39./40. člen): 3. val unifikacije
#   I/O meje — 22 handlerjev s surovim .catch(() => null) → EN VIR
#   preberiJsonTelo (vzorec R309; R308 calculator izviren) — tiha degradacija
#   v null je IZKORENINJENA; izjeme z izrecnim razlogom (r310 val3 test):
#   sync (kontrakt NIČ), auth/logout (toleranca), scene/detect/measure (413).
#   + MANDATORY STIL: punch-list + team-tab surove amber → roksal žetoni
#   (0 novih hex; r162/r308 lekcija: besedilo ink, žeton na vsebniku/ikoni).
#   Z0  build-guard (EPOCH): health build > R310 commit čas (git log —
#       self-contained meja; push sledi commitu v sekundah, zato je commit-čas
#       STROŽJA in pravilna meja: med commitom in pushom ni Vercel builda)
#       → R310 deploy potrjen (nosi R290+…+R310 — kanon R280/R284),
#       polni LIVE needle teki (R310 STIL punch/team ×5 + ŽIČNI EN VIR probei
#       val-1 ×4 + val-3 ×10 + R309 STIL harmonizacija ×4 + R308 API I/O meja ×7 +
#       R307 Konflikti dokaz ×11 + R306 Oprema cikel dokaz ×11 + R305 Tedenski pregled po dnevih ×11 +
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
#   Z2  čanki needleji: R310 ×5+1 + R309 ×4+3 + R308 ×7 + R307 ×11 + R306 ×11 +
#       R295 ×8 + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije.
#   Z2b ŽIČNI EN VIR probei: val-1 ×4 + val-3 ×10 = 14 (podmnožica brez
#       deny-first vrat — verificirano v viru R310).
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R30[9]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).'''
lines[:36] = NOVA_GLAVA.split('\n')  # set -u (index 36) ostane
text = '\n'.join(lines)

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 2. EPOCH meja (R309 → R310; self-contained) ──
zam('R309_COMMIT_ISO', 'R310_COMMIT_ISO', 3)
zam("$2 ~ /^R309 —/ {", "$2 ~ /^R310 —/ {", 1)
zam('R309_PUSH', 'R310_PUSH', 5)
zam('R309 commita ni v git zgodovini', 'R310 commita ni v git zgodovini', 1)
zam('echo "R309 meja (commit čas, UTC):', 'echo "R310 meja (commit čas, UTC):', 1)
zam('≤ R309 commit meja', '≤ R310 commit meja', 1)
zam('R309 deploy potrjen', 'R310 deploy potrjen', 1)
zam('R309 deploy detekcija', 'R310 deploy detekcija', 1)

# ── 3. Samoidentifikacijski razred (R307 lekcija 3 — self-avoiding) ──
zam("grep -qE 'R30[8]_PUSH|R308[_]COMMIT_ISO' \"$0\"", "grep -qE 'R30[9]_PUSH|R309[_]COMMIT_ISO' \"$0\"", 1)
zam('derive ostanki R308 PUSH/COMMIT meje v r309-prod-qa.sh', 'derive ostanki R309 PUSH/COMMIT meje v r310-prod-qa.sh', 1)

# ── 4. Z2 glava + R310 STIL needle blok (za R309 blokom) ──
zam(
  'echo "=== Z2: čanki — klient needleji (R309 ×4+3 + R308 ×7',
  'echo "=== Z2: čanki — klient needleji (R310 ×5+1 + R309 ×4+3 + R308 ×7', 1)
R309_KPI_MM = 'must_miss "border-emerald-200 dark:border-emerald-800 bg-emerald-50" "R309 surova KPI kartica (izginila) — LIVE"'
R310_BLOK = R309_KPI_MM + '''

echo "--- R310 MANDATORY — 3. VAL I/O MEJE + STIL punch-list/team-tab (LIVE) ---"
# LEKCIJA R310 1: EN VIR sporočilo/preberiJsonTelo sta SERVERSKI plasti —
# client chunki jih NIKOLI ne nosijo → žični probe Z2b (spodaj). Tu SAMO
# STIL žetoni (klient plast) + enolično pripisljivi must_miss (R308 lekcija 3:
# deljene surove sekvene značke/banerja živijo še v measurements-tab — izrecno
# izven R310 obsega → pripisljivost na SOURCE nivoju: r310 val3 test).
need "bg-roksal-amber/10 text-roksal-ink border-roksal-amber/40" "R310 punch Napaka značka (žeton + ink — PLACAN R309 oblika) — LIVE"
need "border-roksal-amber bg-roksal-amber text-roksal-navy" "R310 punch Napaka krog (žeton par) — LIVE"
need "bg-roksal-amber/10 text-roksal-amber" "R310 team chips (žeton — družina Zaklenjen/Aktiven oblika) — LIVE"
need "rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 px-3.5 py-3" "R310 team baner (žetoni + ink besedilo — r162 lekcija) — LIVE"
need "inline-flex items-center gap-1 font-medium text-roksal-ink" "R310 team mora-zamenjati-geslo inline (ink + žeton ikona) — LIVE"
must_miss "border-amber-500 bg-amber-100 dark:bg-amber-500/15 text-amber-600" "R310 punch surov krog par (izginil) — LIVE"'''
zam(R309_KPI_MM, R310_BLOK, 1)

# ── 5. Z2b: val-1 ×4 + val-3 ×10 = 14 ──
zam(
  'echo "=== Z2b: R309 EN VIR ŽIVO NA ŽICI (4 MONTER-dosegljivi migrirani handlerji × pokvarjen JSON → 400 z ISTO ovojnico; ZERO-MUTACIJA — guard strelja PRED db zapisom) ==="',
  'echo "=== Z2b: EN VIR ŽIVO NA ŽICI (val-1 ×4 + val-3 ×10 = 14 MONTER-dosegljivih migriranih handlerjev × pokvarjen JSON → 400 z ISTO ovojnico; ZERO-MUTACIJA — guard strelja PRED db zapisom) ==="', 1)
zam(
  "# Vzorec lokalnega Z0ah (r309-e2e-browser.sh), tu podmnožica 4: spot seja je\n# MONTER (precedens R127/R165) — 7 vrat ima denyWithoutPermission PRED\n# preberiJsonTelo (crews, inventory, material-orders, material-prices, profili,\n# schedules, suppliers → tam bi MONTER videl 403, ne 400); izbrani 4 JIH NIMAJO\n# (verificirano v viru R310: measurements, punch, ar-snapshots, photos —\n# vrstni red: rate-limit → authenticate → preberiJsonTelo). Dvojni podpis\n# (R194/R309 lekcija 4): roksal_csrf iz document.cookie → x-csrf-token.",
  "# Vzorec lokalnega Z0ah/Z0ai (r309/r310-e2e-browser.sh), tu podmnožica 14:\n# spot seja je MONTER (precedens R127/R165) — 7 vrat ima\n# denyWithoutPermission PRED preberiJsonTelo (crews, inventory, material-orders,\n# material-prices, profili, schedules, suppliers → tam bi MONTER videl 403, ne\n# 400); val-1 izbrani 4 + val-3 izbrani 10 VSI BREH deny-first (verificirano v\n# viru R310: measurements, punch, ar-snapshots, photos; quote, railing-layout,\n# users, crm, qc, evidence, viz/render, measurements/[id], ar/analyze,\n# measure/photo — equipment IZVZET: deny-first na vrstici 18 — vrstni red:\n# rate-limit → authenticate → preberiJsonTelo). Dvojni podpis\n# (R194/R309 lekcija 4): roksal_csrf iz document.cookie → x-csrf-token.", 1)
zam(
  "const rute=[['measurements','/api/measurements','POST'],['punch','/api/punch','POST'],['ar-snapshots','/api/ar-snapshots','POST'],['photos','/api/photos','POST']]",
  "const rute=[['measurements','/api/measurements','POST'],['punch','/api/punch','POST'],['ar-snapshots','/api/ar-snapshots','POST'],['photos','/api/photos','POST'],['quote','/api/quote','POST'],['railing-layout','/api/railing-layout','POST'],['users','/api/users','POST'],['crm','/api/crm','PATCH'],['qc','/api/qc','POST'],['evidence','/api/evidence','POST'],['viz-render','/api/viz/render','POST'],['measurements-id','/api/measurements/e2e-r310-ne-obstojeci-id','PATCH'],['ar-analyze','/api/ar/analyze','POST'],['measure-photo','/api/measure/photo','POST']]", 1)
zam("assert isinstance(d, list) and len(d) == 4, 'Z2b oblika: pričakovano 4 zapise, dobljeno ' + json.dumps(d if not isinstance(d, list) else len(d))",
    "assert isinstance(d, list) and len(d) == 14, 'Z2b oblika: pričakovano 14 zapisov, dobljeno ' + json.dumps(d if not isinstance(d, list) else len(d))", 1)
zam("print('Z2b OK — R309 EN VIR ŽIVO NA ŽICI: 4/4 pokvarjeni vhodi → 400 z ISTO ovojnico (NIČ 500, NIČ 403, NIČ podvojenih sporočil — EN VIR dokazan na produ)')",
    "print('Z2b OK — EN VIR ŽIVO NA ŽICI val-1+val-3: 14/14 pokvarjenih vhodov → 400 z ISTO ovojnico (NIČ 500, NIČ 403, NIČ podvojenih sporočil — stena nepropustna čez obe generaciji na produ)')", 1)

# ── 6. TODO veriga: + TODO-R309 ──
zam('must_miss "TODO-R308" "R308 — brez razvojnih ostankov (izginil)"',
    'must_miss "TODO-R309" "R309 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R308" "R308 — brez razvojnih ostankov (izginil)"', 1)

# ── 7. Generacijske poti + zaključek ──
zam('/tmp/r309-', '/tmp/r310-', 30)
zam('__r309val', '__r310val', 4)
zam('=== R309 PROD QA — R290+…+R309 ŽIVO SKUPAJ ===', '=== R310 PROD QA — R290+…+R310 ŽIVO SKUPAJ ===', 1)

# ── Samoidentifikacija + ostanki (kanon) ──
assert 'R30[9]_PUSH|R309[_]COMMIT_ISO' in text, 'samoidentifikacijski razred manjka'
for ostanek in ('R309_COMMIT_ISO', 'R309_PUSH', 'r309-prod-chunks', '/tmp/r309-'):
    'r309-prod-chunks',
    assert ostanek not in text, f'ostanek stare generacije: {ostanek}'
# Zgodovinske omembe R309 (needle blok labeli) ostanejo NAMERNO — to so LIVE
# regresijski needleji prejšnje generacije, ne meje/mehanizmi.

# IZHODNA STRAN preverba (LEKCIJA R311: vnosne asercije NE pokrijejo rezultata —
# splice je v R310 tiho pogoltnil 'set -u' [sed z $ sidrom se ni ujel]; struktura
# cilja se preveri NACH)
assert text.split('\n')[37] == 'set -u' or '\nset -u\n' in text, "'set -u' izgubljen pri splice"
DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
