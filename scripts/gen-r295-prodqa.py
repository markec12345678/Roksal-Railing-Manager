#!/usr/bin/env python3
# R295 — generira scripts/r295-prod-qa.sh iz r294-prod-qa.sh vzorca
# (kanon gen-r293-prodqa.py). Ključne razlike:
#  1. EPOCH guard: R295 meja = čas R295 commita (git log, self-contained —
#     push sledi commitu v sekundah; build > commit-čas = deploy nosi R295;
#     STROŽJE kot push-čas, ker med commitom in pushom ni Vercel builda);
#  2. Z2: NOV R295 LIVE blok (koledar pregledov CSV + F2 mini-vrstica),
#     R294 katalog blok postane regresija;
#  3. must_miss veriga: + TODO-R295;
#  4. probe id-ji in tmp poti r294 → r295.
SRC = '/home/z/my-project/scripts/r294-prod-qa.sh'
DST = '/home/z/my-project/scripts/r295-prod-qa.sh'

s = open(SRC).read()

# --- 1. glava ---
s = s.replace(
    """#!/bin/bash
# R294 — PRVA naloga (worklog R295): potrditi R290+R291+R292+R293+R294 SKUPAJ na produ.
#   Z0  build-guard (EPOCH): health build > R294 push (2026-09-29T21:53:17Z)
#       → R294 deploy potrjen (nosi R290+R291+R292+R293+R294 — kanon R280/R284),
#       polni LIVE needle teki (R294 katalog kartica ×8 + strip števci + R293 ×8 + regresije).""",
    """#!/bin/bash
# R295 — PRVA naloga (worklog R296): potrditi R290+R291+R292+R293+R294+R295 SKUPAJ na produ.
#   Z0  build-guard (EPOCH): health build > R295 commit čas (git log —
#       self-contained meja; push sledi commitu v sekundah, zato je commit-čas
#       STROŽJA in pravilna meja: med commitom in pushom ni Vercel builda)
#       → R295 deploy potrjen (nosi R290+…+R295 — kanon R280/R284),
#       polni LIVE needle teki (R295 koledar CSV + mini-vrstica ×9 + R294 ×9 + regresije).""",
)
s = s.replace(
    """#       build ≤ push → **ESKALACIJA veja** (kanon R258: prod stale ni koda-bug
#       — lokalni buildi ✓; needleji bi lažno FAILali). Izvede se ISKREN
#       stale-dokaz: R289/R288/R287/R227 LIVE needleji (zdrav vzorec stale
#       builda) + R290/R291/R292 pilli LIVE + pogojno R293 pilli (če build >
#       R293 push) + Z1b + Z3 (ZERO-MUTACIJA). ZERO must_miss v stale veji —
#       skew protection lekcija R294: pill-level must_miss je vrstno ranljivo
#       po pushu; avtoritativni detektor = EPOCH build-guard.""",
    """#       build ≤ meja → **ESKALACIJA veja** (kanon R258: prod stale ni koda-bug
#       — lokalni buildi ✓; needleji bi lažno FAILali). Izvede se ISKREN
#       stale-dokaz: R289/R288/R287/R227 LIVE needleji (zdrav vzorec stale
#       builda) + R290/R291/R292/R293/R294 pilli LIVE (pogojno po EPOCH) +
#       Z1b + Z3 (ZERO-MUTACIJA). ZERO must_miss v stale veji —
#       skew protection lekcija R294: pill-level must_miss je vrstno ranljivo
#       po pushu; avtoritativni detektor = EPOCH build-guard.""",
)

# --- 2. EPOCH guard — git-izpeljana meja ---
s = s.replace(
    '''PROD="https://roksal-railing-manager.vercel.app"
R294_PUSH="2026-09-29T21:53:17"

echo "=== Z0: prod build-guard — R294 deploy detekcija (EPOCH primerjava) ==="''',
    '''PROD="https://roksal-railing-manager.vercel.app"
R295_COMMIT_ISO="$(git log --format='%cI ::: %s' 2>/dev/null | awk -F' ::: ' '$2 ~ /^R295 —/ {print $1; exit}')"
[ -n "$R295_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R295 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }
R295_PUSH="$(date -u -d "$R295_COMMIT_ISO" +%Y-%m-%dT%H:%M:%S)"
echo "R295 meja (commit čas, UTC): $R295_PUSH"

echo "=== Z0: prod build-guard — R295 deploy detekcija (EPOCH primerjava) ==="''',
)
s = s.replace('python3 - "$BUILD" "$R294_PUSH" <<\'PYEOF\'', 'python3 - "$BUILD" "$R295_PUSH" <<\'PYEOF\'')

# --- 3. stale veja ---
s = s.replace(
    'echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R294 push 21:53:17Z."',
    'echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R295 commit meja ($R295_PUSH)."',
)
s = s.replace(
    'echo "██ R293 (20:46:30Z) + R294 (21:53:17Z) pričakujeta SKUPNI deploy (stale od 20:46:30Z — 4. zapis eskalacije)."',
    'echo "██ R294 (21:53:39Z ŽIVO) + R295 pričakujeta SKUPNI deploy (kanon R280/R284)."',
)
s = s.replace(
    'echo "██ eskalacija LASTNIKU (Vercel dashboard — deploy stuck/limit; 4. zapis)."',
    'echo "██ eskalacija LASTNIKU (Vercel dashboard — deploy stuck/limit)."',
)
s = s.replace(
    'echo "██ Runda nadaljuje LOKALNO (kanon R280/R284: naslednji push nosi"\n  echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294)."',
    'echo "██ Runda nadaljuje LOKALNO (kanon R280/R284: naslednji push nosi"\n  echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295)."',
)

# --- 4. poti + probe id-ji ---
s = s.replace('/tmp/r294-', '/tmp/r295-')
s = s.replace('r294-ne-obstojeci-id-probe', 'r295-ne-obstojeci-id-probe')
s = s.replace("id:'r294-prod-v99-probe-'+Date.now(),customerName:'r293 probe v99'", "id:'r295-prod-v99-probe-'+Date.now(),customerName:'r295 probe v99'")

# --- 5. LIVE veja glava ---
s = s.replace(
    'echo "R294 deploy potrjen (build $BUILD > R294 push 21:53:17Z) — polni LIVE teki"\necho "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294 — kanon R280/R284)"',
    'echo "R295 deploy potrjen (build $BUILD > R295 commit meja $R295_PUSH) — polni LIVE teki"\necho "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295 — kanon R280/R284)"',
)
s = s.replace(
    'echo "=== Z2: čanki — klient needleji (R294 ×8 LIVE + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="',
    'echo "=== Z2: čanki — klient needleji (R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="',
)

# --- 6. R295 LIVE blok + R294 blok → regresija ---
s = s.replace(
    'echo "--- R294 MANDATORY — AVTOMATIZACIJA KATALOG KARTICA + STRIP ŠTEVCI (LIVE — PRVA naloga R295) ---"',
    '''echo "--- R295 MANDATORY — KOLEDAR PREGLEDOV CSV + F2 MINI-VRSTICA (LIVE — PRVA naloga R296) ---"
need "Izvozi koledar pregledov kot CSV" "R295 gumb aria — LIVE"
need "Koledar pregledov kot CSV (isti stolpci kot PDF — za Excel/računovodstvo)" "R295 gumb title — LIVE"
need "koledarPregledovCsvVrstice" "R295 lib EN VIR graditelj (čanek) — LIVE"
need "Koledar-pregledov-" "R295 ime datoteke predpona (čanek) — LIVE"
need "Vse stranke z vpisanim datumom pregleda (AKTIVEN + POTEKEL) — koledarski red" "R295 meta Obseg (čanek) — LIVE"
need "CSV se izvozi, ko je vpisan prvi datum pregleda." "R295 fail-closed toast — LIVE"
need "Koledar pregledov prenešen v CSV" "R295 uspeh toast (WYSIWYG) — LIVE"
need "Pregledi: " "R295 F2 mini-vrstica glava — LIVE"
need " vpisanih · " "R295 F2 mini-vrstica trikot ločilo — LIVE"
echo "--- R294 MANDATORY — AVTOMATIZACIJA KATALOG KARTICA + STRIP ŠTEVCI (LIVE — regresija) ---"''',
)

# --- 7. must_miss veriga + sklep ---
s = s.replace(
    'must_miss "TODO-R294" "R294 — brez razvojnih ostankov (izginil)"',
    'must_miss "TODO-R295" "R295 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R294" "R294 — brez razvojnih ostankov (izginil)"',
)
s = s.replace(
    'echo "=== R294 PROD QA — R290+R291+R292+R293+R294 ŽIVO SKUPAJ ==="',
    'echo "=== R295 PROD QA — R290+R291+R292+R293+R294+R295 ŽIVO SKUPAJ ==="',
)
# Z1 labeli ostanejo generični (R294 labeli so opisi dokazov, ne runda)

open(DST, 'w').write(s)
print('r295-prod-qa.sh zgeneriran:', len(s), 'znakov')
