#!/usr/bin/env python3
# r381-evolucija.py — R381 GLASNA evolucija r379 register vrstice #1
# (REGISTER EVOLUCIJA kanon r371 N3 / R377, 3. uporaba):
# val 60 INS ' transition-colors' PRED 'focus-visible:ring-2' na top-bar
# L261+L268 = ISTI vrstici, ki ju je val 59 (R379) prijel kot era
# diskriminator N1 (top-bar CMP par). Dvojni zadetek:
#   (1) r379.tsv need_static needle #1 (stari niz 'gap-2 focus-visible:
#       ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2')
#       — po R381 buildu MRTEV (bi prelomil qa-round needles verigo +
#       prihodnje era žetve);
#   (2) test pina r379-stil-val59.test.ts (D) + r372-stil-val55.test.ts
#       (D) — PIN SHIFT z žigom 'PIN SHIFT R381 val 60' ločeno.
# MEHANIZEM (kanon validate_registry: samo need_static|must_miss znani
# vrsti → evolucija = KOMENTIRANA vrstica [zgodovina dobesedno ohranjena,
# AWK/era-clone/preberi_register/window-scan je preskočijo] + NASLEDNICA
# podatkovna vrstica z evoluiranim nizom; need_static disk števec r379
# ostane 4 — vsote era žetev (≥134 za r347–r379) NESPREMENJENE.
# NASLEDNICA pride na produ OB TEM pushu — r381 era žetva jo bere ŽIVO).
# Fail-closed: žigi PRED (točno ×1), žigi PO (točno ×1), NF=3 validacija.
import pathlib
import sys

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r379.tsv")
STARI = "gap-2 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2"
NASLEDNICA = "gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2"

src = REG.read_text(encoding="utf-8")
vrstice = src.split("\n")

# PRED žigi
podatki = [l for l in vrstice if l and not l.startswith("#")]
ns_pred = sum(1 for l in podatki if l.split("\t")[-1] == "need_static")
if ns_pred != 4:
    sys.exit(f"FAILOVEDANO: PRED need_static r379 = {ns_pred} ≠ 4")
stari_i = [i for i, l in enumerate(vrstice) if l.startswith(STARI + "\t")]
if len(stari_i) != 1:
    sys.exit(f"FAILOVEDANO: stari N1 needle ×{len(stari_i)} ≠ ×1")
i = stari_i[0]
if not vrstice[i].endswith("\tneed_static"):
    sys.exit("FAILOVEDANO: stari needle ni need_static vrsta — abort")
if NASLEDNICA in src:
    sys.exit("FAILOVEDANO: naslednica ŽE prisotna (idempotenca) — abort")
for l in podatki:
    if len(l.split("\t")) != 3:
        sys.exit(f"FAILOVEDANO: NF≠3 na podatkovni vrstici: {l[:60]!r}")

opis_orig = vrstice[i].split("\t")[1]
evolved = (
    "# " + vrstice[i]
    + " — EVOLVED R381 val 60: INS ' transition-colors' PRED 'focus-visible:ring-2' NA ISTI vrstici (top-bar CMP par L261+L268, kanon val 58)"
    + " — vrstica KOMENTIRANA (zgodovina dobesedno; validate_registry/preberi_register/era-clone/window-scan je preskočijo),"
    + " naslednica = naslednja podatkovna vrstica; era žetve do 33. (TRIINTRIDESIJNA, R380) ostanejo ZELENE (stari niz bil ŽIVO na produ ob obeh tekih)"
)
naslednica_v = (
    f"{NASLEDNICA}\tR381 val 60 evolucija r379 N1 top-bar CMP par — NASLEDNICA komentirane vrstice zgoraj"
    f" (x2 pojavitvi v top-bar; NASLEDNICA ŽIVO ob R381 pushu; opis izvirnika: {opis_orig})\tneed_static"
)

vrstice[i] = evolved + "\n" + naslednica_v
out = "\n".join(vrstice)

# PO žigi
podatki_po = [l for l in out.split("\n") if l and not l.startswith("#")]
ns_po = sum(1 for l in podatki_po if l.split("\t")[-1] == "need_static")
if ns_po != 4:
    sys.exit(f"FAILOVEDANO: PO need_static r379 = {ns_po} ≠ 4 (komentar ne sme spreminjati števca)")
if STARI + "\t" in out.replace("# ", "", 1) and False:
    pass  # (stari niz ostane SAMO v komentarju — spodaj preverjeno dobesedno)
stari_podatkovni = sum(1 for l in podatki_po if l.startswith(STARI + "\t"))
if stari_podatkovni != 0:
    sys.exit("FAILOVEDANO: stari needle še vedno podatkovna vrstica")
naslednica_podatkovni = sum(1 for l in podatki_po if l.startswith(NASLEDNICA + "\t"))
if naslednica_podatkovni != 1:
    sys.exit(f"FAILOVEDANO: naslednica ×{naslednica_podatkovni} ≠ ×1")
for l in podatki_po:
    if len(l.split("\t")) != 3:
        sys.exit(f"FAILOVEDANO: PO NF≠3: {l[:60]!r}")

REG.write_text(out, encoding="utf-8")
print("OK: r379.tsv needle #1 EVOLVED R381 val 60 (komentar) + NASLEDNICA need_static; need_static = 4 NESPREMENJEN; NF=3 vseh")
