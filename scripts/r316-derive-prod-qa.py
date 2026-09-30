#!/usr/bin/env python3
# R316 — derive r316-prod-qa.sh iz r315-prod-qa.sh (generacijski vzorec
# r305→…→r315). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed:
# napačno število POJAVITEV → izpisek + exit 1; LEKCIJA R312/R314/R315:
# štetje na POJAVITVE, ne grep -c vrstice).
# Transformacije:
#   1. Glava: R316 zapis (46. člen — izvoz končne verifikacije JSON + STIL
#      val 7 zaključni) + Z2 needle števec + R316 harvest lekcija opomba
#   2. EPOCH: R315_COMMIT_ISO/R315_PUSH → R316_*, awk '^R315 —' → '^R316 —',
#      guard R31[4] → R31[5], meja/deploy oznake
#   3. Generacijske poti: /tmp/r315- → /tmp/r316- (36 pojavitev)
#   4. R316 needle blok: splice PRED Z2b (JSON izvoz aria/title + STIL val 7
#      žetoni ×5 + must_miss stari surovi vzorci ×5 + TODO-R316)
#   5. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r315-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r316-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R315 — PRVA naloga (worklog R315): potrditi R290+…+R314+R315 SKUPAJ na produ.',
    '# R316 — PRVA naloga (worklog R316): potrditi R290+…+R315+R316 SKUPAJ na produ.\n'
    '#   🆕 R316 LEKCIJA (tek 1 r315-prod-qa: R292/R293 needleja MISS — aplikacija\n'
    '#   ZDRAVA): SPA modul registar fetcha vsak čank NATANKO ENKRAT na sejo —\n'
    '#   re-dispatch NE fetcha NIČ. Popravki: login-era slika + reset pralna\n'
    '#   10000 PRED PRIME + posvečena slika PO PRIME + 2. prehod reprobe (v\n'
    '#   OBEH vejah) + dispatch \'ar\' (R315 ar-scanner needleji — LEKCIJA R314 1\n'
    '#   ponovitev: pokritost sledi needle pokritosti).')
zam('#       R280/R284), polni LIVE needle teki (R315 verifikacija ×10 + STIL ×11 +',
    '#       R280/R284), polni LIVE needle teki (R316 izvoz JSON ×2 + STIL ×5 +\n'
    '#       must_miss ×5 + R315 verifikacija ×10 + STIL ×11 +')
zam('#   Z2  čanki needleji: R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 +',
    '#   Z2  čanki needleji: R316 ×7+6 + R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 +')
zam("#   ('R31[4]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "#   ('R31[5]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).")

# ── 2. EPOCH + guard + oznake ──
zam('R315_TABS', 'R316_TABS', 3)
zam('R315_COMMIT_ISO', 'R316_COMMIT_ISO', 3)
zam('R315_PUSH', 'R316_PUSH', 5)
zam("awk -F' ::: ' '$2 ~ /^R315 —/ {print $1; exit}'", "awk -F' ::: ' '$2 ~ /^R316 —/ {print $1; exit}'", 1)
zam("[ -n \"$R316_COMMIT_ISO\" ] || { echo \"FAIL-CLOSED: R315 commita ni v git zgodovini — EPOCH guard brez meje\"; exit 1; }",
    "[ -n \"$R316_COMMIT_ISO\" ] || { echo \"FAIL-CLOSED: R316 commita ni v git zgodovini — EPOCH guard brez meje\"; exit 1; }", 1)
zam("if grep -qE 'R31[4]_PUSH|R314[_]COMMIT_ISO' \"$0\"; then",
    "if grep -qE 'R31[5]_PUSH|R315[_]COMMIT_ISO' \"$0\"; then", 1)
zam('echo "FAIL-CLOSED: derive ostanki R314 PUSH/COMMIT meje v r315-prod-qa.sh — popravi pred tekom"',
    'echo "FAIL-CLOSED: derive ostanki R315 PUSH/COMMIT meje v r316-prod-qa.sh — popravi pred tekom"', 1)
zam('echo "R314 meja (commit čas, UTC): $R316_PUSH"', 'echo "R316 meja (commit čas, UTC): $R316_PUSH"', 1)
zam('echo "R314 deploy potrjen (build $BUILD > R314 commit meja $R316_PUSH) — polni LIVE teki"',
    'echo "R316 deploy potrjen (build $BUILD > R316 commit meja $R316_PUSH) — polni LIVE teki"', 1)
zam('echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R314 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R316 — kanon R280/R284)"', 1)
zam('echo "=== Z0: prod build-guard — R315 deploy detekcija (EPOCH primerjava) ==="',
    'echo "=== Z0: prod build-guard — R316 deploy detekcija (EPOCH primerjava) ==="', 1)
zam('echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R315 commit meja ($R316_PUSH)."',
    'echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R316 commit meja ($R316_PUSH)."', 1)
zam('echo "██ R315 pričakuje SKUPNI deploy (kanon R280/R284)."',
    'echo "██ R316 pričakuje SKUPNI deploy (kanon R280/R284)."', 1)
zam('echo "=== R315 PROD QA — R290+…+R315 ŽIVO SKUPAJ ==="',
    'echo "=== R316 PROD QA — R290+…+R316 ŽIVO SKUPAJ ==="', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r315-', '/tmp/r316-', 36)

# ── 4. R316 needle blok: splice PRED Z2b ──
SIDRO = 'echo "=== Z2b: EN VIR ŽIVO NA ŽICI (val-1 ×4 + val-3 ×9 × pokvarjen JSON → 400 z ISTO ovojnico + users 403 deny-first POZITIVNI dokaz; ZERO-MUTACIJA — guard strelja PRED db zapisom) ==="'
BLOK = '''echo "--- R316 MANDATORY — 46. člen: izvoz poročila končne verifikacije (JSON) + STIL val 7 zaključni (LIVE) ---"
# IZVOZI družina: gumb v končna-verifikacija bloku (vodja chunk) —
# deterministični JSON izvoz (EN VIR — koncnaVerifikacijaJson; vitest
# r316-koncna-verifikacija-json + E2E Z0an DETERMINIZEM: dva izvoza bajtno
# enaka). STIL val 7 (ZAKLJUČNI): 5 dotikov v 4 datotekah (fence-3d-viewer
# ×2 [ar chunk — dispatch 'ar' ŽE v listi] + notification-center ×1 [shell
# chunk] + signature-quote ×1 [build-nivo SAMO — 'signature' more-tab rabi
# izbran projekt, čank ni v harvestu] + photo-measure ×1 [measurements
# chunk]); GLOBALNI zaklenjeni register = r316-stil-val7 STRAŽAR.
need "Izvozi poročilo končne verifikacije kot JSON" "R316 JSON izvoz gumb aria (vodja chunk) — LIVE"
need "kot deterministični JSON" "R316 JSON izvoz title fragment (vodja chunk) — LIVE"
need "h-8 w-8 text-roksal-amber" "R316 fence loadError ikona (žeton; ar chunk) — LIVE"
need "mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" "R316 fence AR hint ikona (žeton; ar chunk) — LIVE"
need "h-3 w-3 shrink-0 text-roksal-amber" "R316 notification weather ikona (žeton; shell chunk) — LIVE"
need "Oba podpisa (stranka + monter) sta potrebna" "R316 signature hint besedilo (ink; build-nivo needle — čank brez izbranega projekta ni v harvestu) — LIVE"
need "Za shranjevanje izberi projekt." "R316 photo-measure hint besedilo (ink; measurements chunk) — LIVE"
must_miss "h-8 w-8 text-amber-400" "R316 fence stara ikona (izginil — unikaten h-8 par) — LIVE"
must_miss "mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" "R316 fence stara AR hint ikona (izginil — unikaten h-3.5 rep) — LIVE"
must_miss "h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" "R316 notification stara ikona (izginil — unikaten dark-par) — LIVE"
must_miss "text-2xs text-amber-600 dark:text-amber-400" "R316 signature stari hint (izginil — unikaten text-2xs rep) — LIVE"
must_miss "text-[9px] text-amber-600 dark:text-amber-400" "R316 photo-measure stari hint (izginil — unikaten text-[9px] rep) — LIVE"
must_miss "TODO-R316" "R316 — brez razvojnih ostankov"

''' + SIDRO
n = text.count(SIDRO)
if n != 1:
    print(f'FAIL-CLOSED: SIDRO (Z2b echo) — najdeno {n}×, pričakovano 1×')
    sys.exit(1)
text = text.replace(SIDRO, BLOK)

# ── 5. Izhodna asercija ──
assert 'set -u' in text, 'izhodna asercija: set -u izginil'
assert '/tmp/r315-' not in text, 'izhodna asercija: /tmp/r315- ostanki'
assert text.count('TODO-R316') == 1, 'izhodna asercija: TODO-R316 needle ni 1×'
assert text.count('R316_TABS') == 3, 'izhodna asercija: R316_TABS ni 3×'
assert text.count('TODO-R315') == 1, 'izhodna asercija: TODO-R315 regresija mora ostati 1×'
assert "/^R316 —/" in text, 'izhodna asercija: awk R316 meja manjka'
assert text.count('=== Z2b:') == 1, 'izhodna asercija: Z2b ni več unikaten'
assert 'R316 MANDATORY' in text, 'izhodna asercija: R316 needle blok manjka'
assert 'R31[4]' not in text, 'izhodna asercija: R31[4] ostanki (guard mora biti R31[5])'

DOL.write_text(text, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(text.splitlines())} vrstic)')
