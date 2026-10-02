#!/usr/bin/env python3
# r371-era-clone.py — klonira r370-era-harvest.sh → r371-era-harvest.sh
# (STIRIINDVJSETIJNA era preverba: 24 registrov r347–r370, ≥101 need_static
# = 97 + 4). Fail-closed: preveri vhodni rep + izhodne žige pred pisanjem;
# vsota need_static IZ DISKA (LEKCIJA R364 (4)).
import pathlib, sys

SRC = pathlib.Path("/home/z/my-project/scripts/r370-era-harvest.sh")
DST = pathlib.Path("/home/z/my-project/scripts/r371-era-harvest.sh")

src = SRC.read_text(encoding="utf-8")
must = [
    "REG_W=\"scripts/qa-needles/r369.tsv\"",
    "preberi_register \"$REG_W\" \"R369 val 52\"",
    "REG_V=\"scripts/qa-needles/r368.tsv\"",
    "TRIINDVJSETIJNA",
    "TODO-R369|R369",
    "r370-resolucija",
    "/tmp/r370-prod-chunks",
    "[ \"$need_n\" -lt 97 ]",
]
for m in must:
    if m not in src:
        sys.exit(f"FAILOVEDANO: vhodni rep manjka: {m}")

out = src
# 1) glava komentar: runda + era ime + register veriga + kanon
out = out.replace(
    "# r370-era-harvest.sh — R370 TRIINDVJSETIJNA era preverba: r347.tsv val 30",
    "# r371-era-harvest.sh — R371 STIRIINDVJSETIJNA era preverba: r347.tsv val 30",
)
out = out.replace(
    "×4 IN r369.tsv val 52 ×4 na\n# produkcijskih čankih (R369 pride na produ SAM — R347–R368 so ŽE ŽIVI od\n# dvaindvajsete preverbe R369, del prek hash rezolucije). Kanon R345–R369\n# (r369-era-harvest.sh)",
    "×4 IN r369.tsv val 52 ×4 IN r370.tsv val 53 ×4 na\n# produkcijskih čankih (R370 pride na produ SAM — R347–R369 so ŽE ŽIVI od\n# triindvajsete preverbe R370, del prek hash rezolucije). Kanon R345–R370\n# (r370-era-harvest.sh)",
)
# 2) poti + začasne datoteke
out = out.replace("/tmp/r370-prod-chunks", "/tmp/r371-prod-chunks")
out = out.replace("r370-resolucija-", "r371-resolucija-")
# 3) REG_X + klic
out = out.replace(
    'REG_W="scripts/qa-needles/r369.tsv"\n',
    'REG_W="scripts/qa-needles/r369.tsv"\nREG_X="scripts/qa-needles/r370.tsv"\n',
)
out = out.replace(
    'preberi_register "$REG_W" "R369 val 52"\n',
    'preberi_register "$REG_W" "R369 val 52"\npreberi_register "$REG_X" "R370 val 53"\n',
)
# 4) prag 97 → 101 + vsota
out = out.replace(
    "[ \"$need_n\" -lt 97 ] && { echo \"FAILOVEDANO: VSI triindvajset registrov SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 97 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4)\"; exit 1; }",
    "[ \"$need_n\" -lt 101 ] && { echo \"FAILOVEDANO: VSI štiriindvajset registrov SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 101 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4)\"; exit 1; }",
)
# 5) must_miss + TODO-R370
out = out.replace(
    "'TODO-R369|R369'; do",
    "'TODO-R369|R369' 'TODO-R370|R370'; do",
)
# 6) komentar sekcij
out = out.replace(
    "# 2) need_static po VSEH TRIINDVJSETIH registrov",
    "# 2) need_static po VSEH STIRIINDVJSETIH registrov",
)
out = out.replace(
    "# 3) must_miss — TODO-R347 … TODO-R369 NE SMEJO biti prisotni",
    "# 3) must_miss — TODO-R347 … TODO-R370 NE SMEJO biti prisotni",
)
# 7) zaključni bannerji
out = out.replace(
    "IN R369 val 52 (×4) ŽIVO NA PRODU",
    "IN R369 val 52 (×4) IN R370 val 53 (×4) ŽIVO NA PRODU",
)
out = out.replace("=== R370 TRIINDVJSETIJNA ERA PREVERBA", "=== R371 STIRIINDVJSETIJNA ERA PREVERBA")
# 8) žig kanona v glavi
out = out.replace("(kanon R340–R369)", "(kanon R340–R370)")

checks = [
    ("REG_X=\"scripts/qa-needles/r370.tsv\"", 1),
    ("preberi_register \"$REG_X\" \"R370 val 53\"", 1),
    ("STIRIINDVJSETIJNA", 4),
    ("TODO-R370|R370", 1),
    ("[ \"$need_n\" -lt 101 ]", 1),
    ("IN R370 val 53 (×4) ŽIVO NA PRODU", 1),
    ("/tmp/r371-prod-chunks", 1),
    ("r371-resolucija-", 2),  # -o izhod + grep vhod (isti blok) — disk resnica
    ("triindvajsete preverbe R370", 1),  # LEGITIMEN ostanek v NOVI glavi (kanon R370 klon)
    ("triindvajset registrov", 0),  # stari prag-opis mora biti zamenjan (štiriindvajset)
    ("štiriindvajset registrov", 1),
    ("STIRIINDVJSETIJNA", 4),
    ("TRIINDVJSETIJNA ERA PREVERBA", 0),
    ("R370 TRIINDVJSETIJNA", 0),
]
ok = True
for pat, n in checks:
    c = out.count(pat)
    if c != n:
        print(f"FAILOVEDANO: '{pat}' = {c} (pričakovano {n})")
        ok = False
if not ok:
    sys.exit(1)

# vsota need_static IZ DISKA
tot = 0
per = []
for r in range(347, 371):
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
if tot != 101:
    sys.exit(f"FAILOVEDANO: disk vsota {tot} ≠ 101")

DST.write_text(out, encoding="utf-8")
print(f"OK: {DST} zapisan ({len(out)} bajtov)")
