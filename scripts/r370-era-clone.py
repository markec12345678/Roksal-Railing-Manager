#!/usr/bin/env python3
# r370-era-clone.py — klonira r369-era-harvest.sh → r370-era-harvest.sh
# (TRIINDVJSETIJNA era preverba: 23 registrov r347–r369, ≥97 need_static
# = 93 + 4). Fail-closed: preveri vhodni rep + izhodne žige pred pisanjem.
import pathlib, re, sys

SRC = pathlib.Path("/home/z/my-project/scripts/r369-era-harvest.sh")
DST = pathlib.Path("/home/z/my-project/scripts/r370-era-harvest.sh")

src = SRC.read_text(encoding="utf-8")
must = [
    "REG_V=\"scripts/qa-needles/r368.tsv\"",
    "preberi_register \"$REG_V\" \"R368 val 51\"",
    "DVAINDVJSETIJNA",
    "TODO-R368|R368",
    "r369-resolucija",
    "/tmp/r369-prod-chunks",
    "[ \"$need_n\" -lt 93 ]",
]
for m in must:
    if m not in src:
        sys.exit(f"FAILOVEDANO: vhodni rep manjka: {m}")

out = src
# 1) glava komentar: runda + era ime + register veriga
out = out.replace(
    "# r369-era-harvest.sh — R369 DVAINDVJSETIJNA era preverba: r347.tsv val 30",
    "# r370-era-harvest.sh — R370 TRIINDVJSETIJNA era preverba: r347.tsv val 30",
)
out = out.replace(
    "×4 na\n# produkcijskih čankih (R368 pride na produ SAM — R347–R367 so ŽE ŽIVI od\n# enaindvajsete preverbe R368, del prek hash rezolucije). Kanon R345–R368\n# (r368-era-harvest.sh)",
    "×4 IN r369.tsv val 52 ×4 na\n# produkcijskih čankih (R369 pride na produ SAM — R347–R368 so ŽE ŽIVI od\n# dvaindvajsete preverbe R369, del prek hash rezolucije). Kanon R345–R369\n# (r369-era-harvest.sh)",
)
# 2) poti + začasne datoteke
out = out.replace("/tmp/r369-prod-chunks", "/tmp/r370-prod-chunks")
out = out.replace("r369-resolucija-", "r370-resolucija-")
# 3) REG_W + klic
out = out.replace(
    'REG_V="scripts/qa-needles/r368.tsv"\n',
    'REG_V="scripts/qa-needles/r368.tsv"\nREG_W="scripts/qa-needles/r369.tsv"\n',
)
out = out.replace(
    'preberi_register "$REG_V" "R368 val 51"\n',
    'preberi_register "$REG_V" "R368 val 51"\npreberi_register "$REG_W" "R369 val 52"\n',
)
# 4) prag 93 → 97 + vsota
out = out.replace(
    "[ \"$need_n\" -lt 93 ] && { echo \"FAILOVEDANO: VSI dvaindvajset registrov SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 93 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4)\"; exit 1; }",
    "[ \"$need_n\" -lt 97 ] && { echo \"FAILOVEDANO: VSI triindvajset registrov SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 97 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4)\"; exit 1; }",
)
# 5) must_miss + TODO-R369
out = out.replace(
    "'TODO-R368|R368'; do",
    "'TODO-R368|R368' 'TODO-R369|R369'; do",
)
# 6) komentar sekcije 2
out = out.replace(
    "# 2) need_static po VSEH DVAINDVJSETIH registrov",
    "# 2) need_static po VSEH TRIINDVJSETIH registrov",
)
# 7) must_miss komentar
out = out.replace(
    "# 3) must_miss — TODO-R347 … TODO-R368 NE SMEJO biti prisotni",
    "# 3) must_miss — TODO-R347 … TODO-R369 NE SMEJO biti prisotni",
)
# 8) zaključni bannerji
out = out.replace(
    "IN R368 val 51 (×4) ŽIVO NA PRODU",
    "IN R368 val 51 (×4) IN R369 val 52 (×4) ŽIVO NA PRODU",
)
out = out.replace("=== R369 DVAINDVJSETIJNA ERA PREVERBA", "=== R370 TRIINDVJSETIJNA ERA PREVERBA")
# 9) žig kanona v glavi (runda številka)
out = out.replace("(kanon R340–R368)", "(kanon R340–R369)")

checks = [
    ("REG_W=\"scripts/qa-needles/r369.tsv\"", 1),
    ("preberi_register \"$REG_W\" \"R369 val 52\"", 1),
    ("TRIINDVJSETIJNA", 4),
    ("TODO-R369|R369", 1),
    ("[ \"$need_n\" -lt 97 ]", 1),
    ("IN R369 val 52 (×4) ŽIVO NA PRODU", 1),
    ("/tmp/r370-prod-chunks", 1),
    ("r370-resolucija-", 2),  # -o izhod + grep vhod (isti blok) — disk resnica
    ("enaindvajsete", 0),  # stara era referenca ne sme ostati
    ("DVAINDVJSETIJNA", 0),
    ("R369 DVAINDVJSETIJNA", 0),
]
ok = True
for pat, n in checks:
    c = out.count(pat)
    if c != n:
        print(f"FAILOVEDANO: '{pat}' = {c} (pričakovano {n})")
        ok = False
if not ok:
    sys.exit(1)

# vsota need_static potrjena IZ DISKA (LEKCIJA R364 (4) — vedno iz diska)
import csv
tot = 0
per = []
for r in range(347, 370):
    reg = pathlib.Path(f"/home/z/my-project/scripts/qa-needles/r{r}.tsv")
    n = 0
    for line in reg.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) >= 3 and parts[2].strip() == "need_static":
            n += 1
    per.append((r, n))
    tot += n
print("per-registr need_static:", per)
print("SKUPAJ:", tot)
if tot != 97:
    sys.exit(f"FAILOVEDANO: disk vsota {tot} ≠ 97")

DST.write_text(out, encoding="utf-8")
print(f"OK: {DST} zapisan ({len(out)} bajtov)")
