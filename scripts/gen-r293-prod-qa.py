#!/usr/bin/env python3
# R294 — zgeneriraj r293-prod-qa.sh iz r292-prod-qa.sh vzorca (PRVA naloga
# R294: potrditi R293 na produ — LIVE needleji R293 ×8 + R292/R291/R290 ×8
# regresije). LEKCIJE R292/R293 (blind-rename past): global rename R292→R293
# zmoti (a) oznake 8 needlejev R292 regresijskega bloka (needle STRINGI so
# R292 literali), (b) stale-dokaz must_miss oznake R292, (c) ESKALACIJA
# banner vrstico, (d) TODO must_miss verigo (regresijski TODO-R292 izgine) —
# vse pozicijsko popravljeno + strukturirano preverjeno spodaj.
SRC = '/home/z/my-project/scripts/r292-prod-qa.sh'
DST = '/home/z/my-project/scripts/r293-prod-qa.sh'

src = open(SRC, encoding='utf-8').read()
src = src.replace('r292', 'r293').replace('R292', 'R293')

# ---------- 1) glava (komentar blok) — ročno prevedena resnica ----------
slaba_glava = '''# R293 — PRVA naloga (worklog R293): potrditi R290+R291+R293 SKUPAJ na produ.'''
dobra_glava = '''# R293 — PRVA naloga (worklog R294): potrditi R290+R291+R292+R293 SKUPAJ na produ.'''
assert slaba_glava in src, 'glava 1 ni najdena'
src = src.replace(slaba_glava, dobra_glava, 1)

slaba = '#   Z0  build-guard (EPOCH): health build > R293 push (2026-09-29T19:54:53Z)'
dobra = '#   Z0  build-guard (EPOCH): health build > R293 push (2026-09-29T20:46:30Z)'
assert slaba in src, 'glava 2 ni najdena'
src = src.replace(slaba, dobra, 1)

slaba = '#       → R293 deploy potrjen (nosi R290+R291+R293 — kanon R280/R284),'
dobra = '#       → R293 deploy potrjen (nosi R290+R291+R292+R293 — kanon R280/R284),'
assert slaba in src, 'glava 3 ni najdena'
src = src.replace(slaba, dobra, 1)

slaba = '#       R290/R291/R293 pilli must-MISS (dokaz, da prod NE nosi novih generacij) +'
dobra = "#       R293 pilli must-MISS + R290/R291/R292 pilli LIVE (stale zdrav — kanon"
dobra2 = "#       'vsak deploy nosi vse generacije') +"
assert slaba in src, 'glava 4 ni najdena'
src = src.replace(slaba, dobra + '\n' + dobra2, 1)

slaba = '#   Z2  čanki needleji: R293 ×8 + R291 ×8 + R290 ×8 + R289/R288/… regresije.'
dobra = '#   Z2  čanki needleji: R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + R289/R288/… regresije.'
assert slaba in src, 'glava 5 ni najdena'
src = src.replace(slaba, dobra, 1)

# ---------- 2) EPOCH guard vrednost ----------
slaba = 'R293_PUSH="2026-09-29T19:54:53"'
dobra = 'R293_PUSH="2026-09-29T20:46:30"'
assert slaba in src, 'PUSH vrednost ni najdena'
src = src.replace(slaba, dobra, 1)

# ---------- 3) ESKALACIJA banner ----------
slaba = '''  echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R293 push 19:54:53Z."
  echo "██ R290 (18:48:57Z) + R291 (19:18:09Z) + R293 (19:54:53Z) NE DEPLOYANA."'''
dobra = '''  echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R293 push 20:46:30Z."
  echo "██ R290 (18:48:57Z) + R291 (19:18:09Z) + R292 (19:54:53Z) + R293 (20:46:30Z) NE DEPLOYANA."'''
assert slaba in src, 'ESKALACIJA banner ni najden'
src = src.replace(slaba, dobra, 1)

slaba = 'echo "██ (needleji + Z1b + Z3 ŽIVO), R290/R291/R293 pilli DOKAZANO MISS."'
dobra = 'echo "██ (needleji + Z1b + Z3 ŽIVO), R293 pilli DOKAZANO MISS (R290/R291/R292 = stale zdrav LIVE)."'
assert slaba in src, 'ESKALACIJA zaključni banner ni najden'
src = src.replace(slaba, dobra, 1)

slaba = '''  echo "██ R293 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"'''
dobra = '''  echo "██ R293 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"'''
assert slaba in src  # sama se poimenuje pravilno po renameu

slaba = '''  echo "██ Runda nadaljuje LOKALNO (kanon R280/R284: naslednji push nosi"
  echo "██ vse generacije — needleji pokrijejo R290+R291+R293+R293)."'''
dobra = '''  echo "██ Runda nadaljuje LOKALNO (kanon R280/R284: naslednji push nosi"
  echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293)."'''
assert slaba in src, 'ESKALACIja tail ni najden'
src = src.replace(slaba, dobra, 1)

# ---------- 4) stale-dokaz: stale build (R292) = ZDRAV — R290/R291/R292
# pilli so V stale buildu PRISOTNI (kanon: vsak deploy nosi vse generacije),
# torej dokaz z `need`; DOKAZ stale = samo R293 pilli (must_miss).
slaba = '''  must_miss "Prihodki po mesecih — po mesecu plačila" "R290 aria regija — DOKAZ stale (build NE nosi R290)"
  must_miss "Izvozi prihodke po mesecih kot CSV" "R291 gumb aria — DOKAZ stale (build NE nosi R291)"
  must_miss "% največjega meseca" "R291 mini stolpci title — DOKAZ stale"
  must_miss "Tedenski razgled — naslednjih 7 dni" "R293 strip aria — DOKAZ stale (build NE nosi R293)"
  must_miss "% najbolj obremenjenega dne" "R293 mini tir title — DOKAZ stale"'''
dobra = '''  need "Prihodki po mesecih — po mesecu plačila" "R290 aria regija — LIVE (stale zdrav: build NOSI R290)"
  need "Izvozi prihodke po mesecih kot CSV" "R291 gumb aria — LIVE (stale zdrav: build NOSI R291)"
  need "% največjega meseca" "R291 mini stolpci title — LIVE (stale zdrav: build NOSI R291)"
  need "Tedenski razgled — naslednjih 7 dni" "R292 strip aria — LIVE (stale zdrav: build NOSI R292)"
  need "% najbolj obremenjenega dne" "R292 mini tir title — LIVE (stale zdrav: build NOSI R292)"
  must_miss "Izvozi dobičkonosnost projektov kot CSV" "R293 gumb aria — DOKAZ stale (build NE nosi R293)"
  must_miss "Maržni razgled — marža po projektih" "R293 strip aria — DOKAZ stale (build NE nosi R293)"'''
assert slaba in src, 'stale must_miss blok ni najden'
src = src.replace(slaba, dobra, 1)

# stale blok glava + banner besedilo
slaba = '''  echo "--- STALE DOKAZ: R290/R291/R293 pilli NE SMEJO obstajati ---"'''
dobra = '''  echo "--- STALE DOKAZ: stale build (R292) zdrav — R290/R291/R292 pilli LIVE; R293 NE SME obstajati ---"'''
assert slaba in src, 'stale blok glava ni najdena'
src = src.replace(slaba, dobra, 1)

# LEKCIJA R294 (prod-qa tek 1): stale branch tab set MORA pokriti domove
# needlejev — R292 tedenski vozni red živi v LOGISTICS chunku, R290/R291 v
# INVOICES; brez dispatcha = lažni MISS (vzorcevalna vrzel, NI prod bug).
stale_loop_slaba = '''  for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'; do'''
stale_loop_dobra = '''  for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"invoices","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'; do'''
assert stale_loop_slaba in src, 'stale branch tab zanka ni najdena'
src = src.replace(stale_loop_slaba, stale_loop_dobra, 1)

# ---------- 5) deploy-potrjen uvod ----------
slaba = '''echo "R293 deploy potrjen (build $BUILD > R293 push 19:54:53Z) — polni LIVE teki"
echo "OPOMBA: deploy je nosil VSE tri generacije (R290+R291+R293 — kanon R280/R284)"'''
dobra = '''echo "R293 deploy potrjen (build $BUILD > R293 push 20:46:30Z) — polni LIVE teki"
echo "OPOMBA: deploy je nosil VSE štiri generacije (R290+R291+R292+R293 — kanon R280/R284)"'''
assert slaba in src, 'deploy uvod ni najden'
src = src.replace(slaba, dobra, 1)

# ---------- 6) Z2 glava + R293 LIVE blok + pozicijski popravek R292 oznak ----------
slaba = '''echo "=== Z2: čanki — klient needleji (R293 ×8 LIVE + R291 ×8 + R290 ×8 + regresije + must_miss) ==="'''
dobra = '''echo "=== Z2: čanki — klient needleji (R293 ×8 LIVE + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="'''
assert slaba in src, 'Z2 glava ni najdena'
src = src.replace(slaba, dobra, 1)

slaba = '''echo "--- R293 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED (LIVE — PRVA naloga R293) ---"'''
dobra = '''echo "--- R293 MANDATORY — DOBIČKONOST PO PROJEKTIH CSV + RAZGLED (LIVE — PRVA naloga R294) ---"
need "Izvozi dobičkonosnost projektov kot CSV" "R293 gumb aria (JSX attr literal) — LIVE"
need "Dobičkonosnost po projektih kot CSV — ista resnica kot PDF (prihodki · stroški · marža)" "R293 gumb title (JSX attr literal) — LIVE"
need "CSV se izvozi, ko je vpisan prvi račun ali naročilo." "R293 fail-closed toast pri 0/0 (ISTI gate kot brat R258) — LIVE"
need "Dobičkonost prenešena v CSV (" "R293 uspešni toast (WYSIWYG sklep) — LIVE"
need "Maržni razgled — marža po projektih" "R293 MANDATORY STIL — strip aria regija — LIVE"
need "% najvišje marže" "R293 MANDATORY STIL — mini tir hover title izpeljava — LIVE"
need "Ni projektov v preseku — dobičkonost se izriše ob prvem računu ali naročilu." "R293 iskrena praznina (JSX literal) — LIVE"
need "Vsi projekti — presek računov (prihodki) in naročil (stroški materiala)" "R293 meta Obseg vrstica (lib čanek) — LIVE"
echo "--- R292 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED (LIVE — regresija; oznake pozicijsko popravljene, blind-rename lekcija) ---"'''
assert slaba in src, 'R292 blokovna glava ni najdena'
src = src.replace(slaba, dobra, 1)

# pozicijski popravek: 8 need oznak za glavo R292 bloka — '"R293 ' → '"R292 '
lines = src.split('\n')
hdr_idx = lines.index('echo "--- R292 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED (LIVE — regresija; oznake pozicijsko popravljene, blind-rename lekcija) ---"')
popravljeno = 0
k = hdr_idx + 1
while k < len(lines) and popravljeno < 8:
    if lines[k].startswith('need ') and '"R293 ' in lines[k]:
        lines[k] = lines[k].replace('"R293 ', '"R292 ', 1)
        popravljeno += 1
    k += 1
assert popravljeno == 8, 'R292 oznake popravljene ' + str(popravljeno) + '/8 (pozicijska popravka)'
src = '\n'.join(lines)

# ---------- 7) TODO must_miss veriga: regresijski TODO-R292 nazaj ----------
slaba = 'must_miss "TODO-R293" "R293 — brez razvojnih ostankov (izginil)"'
dobra = slaba + '\nmust_miss "TODO-R292" "R292 — brez razvojnih ostankov (izginil)"'
assert slaba in src, 'TODO-R293 must_miss ni najden'
src = src.replace(slaba, dobra, 1)

# ---------- 8) zaključni banner ----------
slaba = 'echo "=== R293 PROD QA — R290+R291+R293 ŽIVO SKUPAJ (deploy zaostanek IZČERPAN) ==="'
dobra = 'echo "=== R293 PROD QA — R290+R291+R292+R293 ŽIVO SKUPAJ ==="'
assert slaba in src, 'zaključni banner ni najden'
src = src.replace(slaba, dobra, 1)

# ---------- 9) strukturna preverba (blokovni vrstni red) ----------
r293_idx = src.index('--- R293 MANDATORY — DOBIČKONOST PO PROJEKTIH CSV')
r292_idx = src.index('--- R292 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED')
r291_idx = src.index('--- R291 MANDATORY — PRIHODKI MESECI CSV')
r290_idx = src.index('--- R290 MANDATORY — PRIHODKI PO MESECIH')
assert r293_idx < r292_idx < r291_idx < r290_idx, 'blokovni vrstni red pokvarjen'
assert src.count('must_miss "TODO-R293"') == 1 and src.count('must_miss "TODO-R292"') == 1, 'TODO veriga napačna (R293 lastni + R292 obnovljen regresijski)'
assert all(src.count(f'must_miss "TODO-R{g}"') == 1 for g in range(284, 292)), 'TODO-R284..R291 veriga nepopolna'
assert 'R293_PUSH="2026-09-29T20:46:30"' in src
slaba = '''  echo "██ stale build (R289, $BUILD) sam po sebi ZDRAV"'''
dobra = '''  echo "██ stale build (R292, $BUILD) sam po sebi ZDRAV"'''
assert slaba in src, 'stale banner R289 ni najden'
src = src.replace(slaba, dobra, 1)

open(DST, 'w', encoding='utf-8').write(src)
print('written r293-prod-qa.sh — struktura OK (R293→R292→R291→R290; TODO veriga; EPOCH 20:46:30Z)')
