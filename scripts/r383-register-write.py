#!/usr/bin/env python3
# r383-register-write.py — R382 fail-closed pisanje registra
# scripts/qa-needles/r382.tsv (kanon r381-register-write.py). Žigi PRED /
# PO + idempotenca (abort, če register ŽE obstaja z vsebino).
import pathlib
import sys

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r383.tsv")

VSEBINA = """# qa-needles/r382.tsv — REGISTER needlejev runde R383 (STIL val 61:
# A/OFFSET ZAKLJUČEK + C/BORDER-PARITETA ZAKLJUČEK — dvostopenjsko, 168
# × INS, in-place, 0 novih vrstic; kanon R382 handover kandidat 1 + 2).
# Disk resnica r383-triaza.py [polna triaža po LEKCIJI R381 (1)]: A
# ostanki = 35 navy ring-2 brez O2 (25 bordered + 10 borderless; FROZEN
# izjema #2 kanon R377: roksal-catalog L95 <Input>) → STEP 1 = 34 × INS
# ' focus-visible:ring-offset-2' TIK ZA navy/40 (val 52 pairing kanon);
# C bordered = 134 vrstic [eksplicitni border class 19 + <Button
# variant="outline"> 115 — border iz baze ui/button.tsx] → STEP 2 = 134
# × INS ' focus-visible:border-roksal-navy/40' TIK ZA O2 (val 57 kanon
# R375); 78 N/A (brez borderja). Skupaj 168 INS / ~30 datotek.
# REGISTER EVOLUCIJA (kanon r371 N3/R377, 4.+5. uporaba prek
# r382-evolucija.py fail-closed): val 61 prelomil r363 needle (spana čez
# O2: '…ring-offset-2 active:scale-[0.96]') + r364 needle ('…ring-offset-2"')
# → obe EVOLVED R383 val 61 + NASLEDNICA (števca 4/4 NESPREMENJENA);
# PIN SHIFT žigi: r381 (D) [inventory L2121/L2272 Button outline FB;
# L2226 Input frozen], r372 (C) [szc guard obrnjen + navyO2 census 4→7].
# Orodja: r383-triaza.py + r382-val61-apply.py [fail-closed scan→34+134,
# kontrakt vrstičnih list, POST closure+in-place+needle survival — ujel
# 2 mrtva needleja = EVOLUCIJA] + r382-era-harvest.sh [35. preverba,
# PETINTRIDESIJNA, EXIT=0 ×2 — 142/142 ŽIVO, val 60 needleji VSI 4 ŽIVO
# DIREKTNO chunk_015/028/026/045 → val 60 deploy POTRJEN] +
# r382-era-ruta-map.py [COMPANION AVTOMATSKO generiran prek razširjenega
# era-clone.py — handover kandidat 3 integracija; harvest re-generacija
# BAJTNATO IDENTIČNA = determinizem] + spot-r167/24 [val 60 POST-deploy:
# N1 top-bar navy evolved 3/3 + red evolved 2/2 na PRODU, stara oblika 0;
# N2/N3/N4 iskreno 0 — spot račun ima 0 projektov (CSV '(0 projektov)' +
# prazno stanje — disk resnica); kolektor 0].
# KOLIZIJA: brez (fetch-first origin/main == HEAD 30f856e == R381 push).
#
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO — presledki
# znotraj needleja so POMENNI, ker grep -F išče dobesedno).
# Vrste: need_static (MORA biti ŽIV v svežem buildu) | must_miss
# (NESME biti v produkcijskih čankih).
hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2	R383 val 61 STEP 1 calculator-tab L4396 (×1) — A/offset zaključek: O2 TIK ZA navy/40 (0 v HEAD 7a92097)	need_static
className="h-8 px-2.5 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40"	R383 val 61 STEP 2 team-tab L497 (×1) — Button outline border-pariteta: FB TIK ZA O2 (0 v HEAD 7a92097)	need_static
className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40"	R383 val 61 STEP 2 sessions-dialog L363 (×1) — Button outline border-pariteta (0 v HEAD 7a92097)	need_static
rounded-full border px-3 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40	R383 val 61 STEP 2 material-intelligence L456 (×1, template-literal) — border-class + O2 + FB (0 v HEAD 7a92097)	need_static
TODO-R383	must_miss: razvojni ostanki (nesme biti v produkcijskih cankih)	must_miss
"""

if REG.exists() and REG.read_text(encoding="utf-8").strip():
    sys.exit(f"FAILOVEDANO: register ŽE obstaja z vsebino (nikoli prepisuj): {REG}")

podatki = [l for l in VSEBINA.splitlines() if l and not l.startswith("#")]
ns = sum(1 for l in podatki if l.split("\t")[-1] == "need_static")
mm = sum(1 for l in podatki if l.split("\t")[-1] == "must_miss")
if ns != 4 or mm != 1:
    sys.exit(f"FAILOVEDANO: need_static={ns} (pričakovano 4), must_miss={mm} (pričakovano 1)")
for l in podatki:
    if len(l.split("\t")) != 3:
        sys.exit(f"FAILOVEDANO: NF≠3: {l[:60]!r}")
if "TODO-R383" not in VSEBINA:
    sys.exit("FAILOVEDANO: must_miss manjka")

REG.write_text(VSEBINA, encoding="utf-8")
out = REG.read_text(encoding="utf-8")
ns_po = sum(1 for l in out.splitlines() if l and not l.startswith("#") and l.split("\t")[-1] == "need_static")
if ns_po != 4:
    sys.exit(f"FAILOVEDANO: PO need_static = {ns_po} ≠ 4")
print(f"OK: {REG} zapisan ({len(out)} bajtov; need_static ×4 + must_miss ×1; NF=3 vseh)")
