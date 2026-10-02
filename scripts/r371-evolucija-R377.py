#!/usr/bin/env python3
# r371-evolucija-R377.py — R377 GLASNA evolucija r371 register vrstice:
# val 58 INS ' transition-colors' na dashboard L1628 = ISTA vrstica, ki jo
# je val 54 (R371) prijel kot era diskriminator N3. Dvojni zadetek:
#   (1) r371.tsv L50 need_static needle (stari niz) — po R377 buildu MRTEV
#       (bi prelomil qa-round needles verigo + prihodnje era žetve);
#   (2) r371-stil-val54.test.ts N3 pin (×1 dashboard).
# MEHANIZEM (kanon validate_registry: samo need_static|must_miss sta znani
# vrsti → evolucija = KOMENTIRANA vrstica [zgodovina dobesedno ohranjena,
# AWK/era-clone/preberi_register je preskočijo] + NASLEDNICA podatkovna
# vrstica z evoluiranim nizom; need_static disk števec r371 ostane 4 —
# vsote era žetev (≥121 za r347–r375) NESPREMENJENE).
# Fail-closed: žigi PRED (točno ×1), žigi PO (točno ×1), NF=3 validacija.
import pathlib, sys

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r371.tsv")
STARI = "top-1/2 -translate-y-1/2 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
NASLEDNICA = "top-1/2 -translate-y-1/2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"

src = REG.read_text(encoding="utf-8")
vrstice = src.split("\n")

# PRED žigi
podatki = [l for l in vrstice if l and not l.startswith("#")]
podatki_n = len(podatki)
ns_pred = sum(1 for l in podatki if l.split("\t")[-1] == "need_static")
if ns_pred != 4:
    sys.exit(f"FAILOVEDANO: PRED need_static r371 = {ns_pred} ≠ 4")
stari_i = [i for i, l in enumerate(vrstice) if l.startswith(STARI + "\t")]
if len(stari_i) != 1:
    sys.exit(f"FAILOVEDANO: stari N3 needle ×{len(stari_i)} ≠ ×1")
i = stari_i[0]
if not vrstice[i].endswith("\tneed_static"):
    sys.exit("FAILOVEDANO: stari needle ni need_static vrsta — nenavadna struktura, abort")
if NASLEDNICA in src:
    sys.exit("FAILOVEDANO: naslednica ŽE prisotna (idempotenca) — abort")

opis_orig = vrstice[i].split("\t")[1]
evolved = "# " + vrstice[i] + " — EVOLVED R377: val 58 INS ' transition-colors' NA ISTI vrstici (dashboard 'Počisti iskanje projektov') — vrstica KOMENTIRANA (zgodovina dobesedno; validate_registry/preberi_register/era-clone je preskočijo), naslednica = naslednja podatkovna vrstica; era žetve do R375 ostanejo ZELENE (stari niz ŽIVO na produ R375)"
naslednica_v = f"{NASLEDNICA}\tR377 val 58 evolucija r371 N3 dashboard vrstice — NASLEDNICA komentirane 'need_static_evolved' vrstice zgoraj (x1 pojavitev v dashboard-tab; disk resnica; opis izvirnika: {opis_orig})\tneed_static"

vrstice[i] = evolved + "\n" + naslednica_v
out = "\n".join(vrstice)

# PO žigi
podatki_po = [l for l in out.split("\n") if l and not l.startswith("#")]
ns_po = sum(1 for l in podatki_po if l.split("\t")[-1] == "need_static")
if ns_po != 4:
    sys.exit(f"FAILOVEDANO: PO need_static r371 = {ns_po} ≠ 4 (komment ne sme spreminjati števca)")
for z in (STARI + "\t", NASLEDNICA + "\t"):
    c = out.count(z)
    if c != 1:
        sys.exit(f"FAILOVEDANO: PO '{z[:50]} …' = {c} ≠ 1")
for l in podatki_po:
    if len(l.split("\t")) != 3:
        sys.exit(f"FAILOVEDANO: NF≠3 vrstica: {l[:70]} …")
if out.count("EVOLVED R377") != 1:
    sys.exit("FAILOVEDANO: EVOLVED žig ≠ ×1")
REG.write_text(out, encoding="utf-8")
print(f"OK: r371.tsv — stari N3 komentiran (EVOLVED R377) + naslednica need_static (ns=4 nespremenjen, NF=3 čisto)")
