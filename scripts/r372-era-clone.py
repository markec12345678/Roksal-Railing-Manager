#!/usr/bin/env python3
# r372-era-clone.py — klonira r371-era-harvest.sh → r372-era-harvest.sh
# (PETINDVJSETIJNA era preverba: 25 registrov r347–r371, ≥105 need_static
# = 101 + 4). Fail-closed: preveri vhodni rep + izhodne žige pred pisanjem;
# vsota need_static IZ DISKA (LEKCIJA R364 (4)); klon-kanon loči PRED-pogoje
# (vhodni rep) od POST-pogojev (novi žigi) — LEKCIJA R371 (1).
import pathlib, sys

SRC = pathlib.Path("/home/z/my-project/scripts/r371-era-harvest.sh")
DST = pathlib.Path("/home/z/my-project/scripts/r372-era-harvest.sh")

src = SRC.read_text(encoding="utf-8")
# --- PRED-pogoji: vse v vhodnem repu r371-era-harvest.sh (še pred transformacijo)
must = [
    "REG_W=\"scripts/qa-needles/r369.tsv\"",
    "preberi_register \"$REG_W\" \"R369 val 52\"",
    "REG_X=\"scripts/qa-needles/r370.tsv\"",
    "preberi_register \"$REG_X\" \"R370 val 53\"",
    "STIRIINDVJSETIJNA",
    "TODO-R370|R370",
    "r371-resolucija-",
    "/tmp/r371-prod-chunks",
    "[ \"$need_n\" -lt 101 ]",
]
for m in must:
    if m not in src:
        sys.exit(f"FAILOVEDANO: vhodni rep manjka: {m}")

out = src
# 1) glava komentar: runda + era ime + register veriga + kanon
out = out.replace(
    "# r371-era-harvest.sh — R371 STIRIINDVJSETIJNA era preverba: r347.tsv val 30",
    "# r372-era-harvest.sh — R372 PETINDVJSETIJNA era preverba: r347.tsv val 30",
)
out = out.replace(
    "×4 IN r370.tsv val 53 ×4 na\n# produkcijskih čankih (R370 pride na produ SAM — R347–R369 so ŽE ŽIVI od\n# triindvajsete preverbe R370, del prek hash rezolucije). Kanon R345–R370\n# (r370-era-harvest.sh)",
    "×4 IN r370.tsv val 53 ×4 IN r371.tsv val 54 ×4 na\n# produkcijskih čankih (R372 pride na produ SAM — R347–R371 so ŽE ŽIVI od\n# petindvajsete preverbe R372, del prek hash rezolucije). Kanon R345–R372\n# (r372-era-harvest.sh)",
)
# 2) poti + začasne datoteke
out = out.replace("/tmp/r371-prod-chunks", "/tmp/r372-prod-chunks")
out = out.replace("r371-resolucija-", "r372-resolucija-")
# 3) REG_Y + klic
out = out.replace(
    'REG_X="scripts/qa-needles/r370.tsv"\n',
    'REG_X="scripts/qa-needles/r370.tsv"\nREG_Y="scripts/qa-needles/r371.tsv"\n',
)
out = out.replace(
    'preberi_register "$REG_X" "R370 val 53"\n',
    'preberi_register "$REG_X" "R370 val 53"\npreberi_register "$REG_Y" "R371 val 54"\n',
)
# 4) prag 101 → 105 + vsota
out = out.replace(
    "[ \"$need_n\" -lt 101 ] && { echo \"FAILOVEDANO: VSI štiriindvajset registrov SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 101 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4)\"; exit 1; }",
    "[ \"$need_n\" -lt 105 ] && { echo \"FAILOVEDANO: VSI petindvajset registrov SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 105 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4)\"; exit 1; }",
)
# 5) must_miss + TODO-R371
out = out.replace(
    "'TODO-R370|R370'; do",
    "'TODO-R370|R370' 'TODO-R371|R371'; do",
)
# 6) komentar sekcij
out = out.replace(
    "# 2) need_static po VSEH STIRIINDVJSETIH registrov",
    "# 2) need_static po VSEH PETINDVJSETIH registrov",
)
out = out.replace(
    "# 3) must_miss — TODO-R347 … TODO-R370 NE SMEJO biti prisotni",
    "# 3) must_miss — TODO-R347 … TODO-R371 NE SMEJO biti prisotni",
)
# 7) zaključni bannerji
out = out.replace(
    "IN R370 val 53 (×4) ŽIVO NA PRODU",
    "IN R370 val 53 (×4) IN R371 val 54 (×4) ŽIVO NA PRODU",
)
out = out.replace("=== R371 STIRIINDVJSETIJNA ERA PREVERBA", "=== R372 PETINDVJSETIJNA ERA PREVERBA")
# 8) žig kanona v glavi
out = out.replace("(kanon R340–R370)", "(kanon R340–R371)")

checks = [
    ("REG_Y=\"scripts/qa-needles/r371.tsv\"", 1),
    ("preberi_register \"$REG_Y\" \"R371 val 54\"", 1),
    ("PETINDVJSETIJNA", 4),
    ("TODO-R371|R371", 1),
    ("[ \"$need_n\" -lt 105 ]", 1),
    ("IN R371 val 54 (×4) ŽIVO NA PRODU", 1),
    ("/tmp/r372-prod-chunks", 1),
    ("r372-resolucija-", 2),  # -o izhod + grep vhod (isti blok) — disk resnica
    ("petindvajsete preverbe R372", 1),  # NOVA glava — disk resnica, zaostanek popravljen
    ("triindvajsete preverbe R370", 0),  # zaostanek glave NE sme preživeti (3. vzorec → popravljen)
    ("R370 pride na produ SAM", 0),  # stara glava mora biti zamenjana (R372)
    ("štiriindvajset registrov", 0),  # stari prag-opis mora biti zamenjan (petindvajset)
    ("petindvajset registrov", 1),
    ("STIRIINDVJSETIJNA", 0),
    ("STIRIINDVJSETIJNA ERA PREVERBA", 0),
    ("R371 STIRIINDVJSETIJNA", 0),
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
for r in range(347, 372):
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
if tot != 105:
    sys.exit(f"FAILOVEDANO: disk vsota {tot} ≠ 105")

DST.write_text(out, encoding="utf-8")
print(f"OK: {DST} zapisan ({len(out)} bajtov)")
