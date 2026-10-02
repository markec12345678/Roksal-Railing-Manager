#!/usr/bin/env python3
# r373-era-clone.py — klonira r372-era-harvest.sh → r373-era-harvest.sh
# (ŠESTINDVJSETIJNA era preverba: 26 registrov r347–r372, ≥109 need_static
# = 105 + 4). Fail-closed: preveri vhodni rep + izhodne žige pred pisanjem;
# vsota need_static IZ DISKA (LEKCIJA R364 (4)); klon-kanon loči PRED-pogoje
# (vhodni rep) od POST-pogojev (novi žigi) — LEKCIJA R371 (1). Glava:
# zaostanek ere-besede popravljen, ne podedovan (LEKCIJA R372 (6), 4. ponovitev
# vzorca — dvostranska preverba).
import pathlib, sys

SRC = pathlib.Path("/home/z/my-project/scripts/r372-era-harvest.sh")
DST = pathlib.Path("/home/z/my-project/scripts/r373-era-harvest.sh")

src = SRC.read_text(encoding="utf-8")
# --- PRED-pogoji: vse v vhodnem repu r372-era-harvest.sh (še pred transformacijo)
must = [
    "REG_Y=\"scripts/qa-needles/r371.tsv\"",
    "preberi_register \"$REG_Y\" \"R371 val 54\"",
    "PETINDVJSETIJNA",
    "TODO-R371|R371",
    "r372-resolucija-",
    "/tmp/r372-prod-chunks",
    "[ \"$need_n\" -lt 105 ]",
]
for m in must:
    if m not in src:
        sys.exit(f"FAILOVEDANO: vhodni rep manjka: {m}")

out = src
# 1) glava komentar: runda + era ime + register veriga + kanon
out = out.replace(
    "# r372-era-harvest.sh — R372 PETINDVJSETIJNA era preverba: r347.tsv val 30",
    "# r373-era-harvest.sh — R373 ŠESTINDVJSETIJNA era preverba: r347.tsv val 30",
)
out = out.replace(
    "×4 IN r371.tsv val 54 ×4 na\n# produkcijskih čankih (R372 pride na produ SAM — R347–R371 so ŽE ŽIVI od\n# petindvajsete preverbe R372, del prek hash rezolucije). Kanon R345–R372\n# (r372-era-harvest.sh)",
    "×4 IN r371.tsv val 54 ×4 IN r372.tsv val 55 ×4 na\n# produkcijskih čankih (R373 pride na produ SAM — R347–R372 so ŽE ŽIVI od\n# šestindvajsete preverbe R373, del prek hash rezolucije). Kanon R345–R373\n# (r373-era-harvest.sh)",
)
# 2) poti + začasne datoteke
out = out.replace("/tmp/r372-prod-chunks", "/tmp/r373-prod-chunks")
out = out.replace("r372-resolucija-", "r373-resolucija-")
# 3) REG_Z + klic
out = out.replace(
    'REG_Y="scripts/qa-needles/r371.tsv"\n',
    'REG_Y="scripts/qa-needles/r371.tsv"\nREG_Z="scripts/qa-needles/r372.tsv"\n',
)
out = out.replace(
    'preberi_register "$REG_Y" "R371 val 54"\n',
    'preberi_register "$REG_Y" "R371 val 54"\npreberi_register "$REG_Z" "R372 val 55"\n',
)
# 4) prag 105 → 109 + vsota
out = out.replace(
    "[ \"$need_n\" -lt 105 ] && { echo \"FAILOVEDANO: VSI petindvajset registrov SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 105 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4)\"; exit 1; }",
    "[ \"$need_n\" -lt 109 ] && { echo \"FAILOVEDANO: VSI šestindvajset registrov SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ 109 = 4 + 5 + 8 + 9 + 3 + 8 + 4 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4)\"; exit 1; }",
)
# 5) must_miss + TODO-R372
out = out.replace(
    "'TODO-R370|R370' 'TODO-R371|R371'; do",
    "'TODO-R370|R370' 'TODO-R371|R371' 'TODO-R372|R372'; do",
)
# 6) komentar sekcij
out = out.replace(
    "# 2) need_static po VSEH PETINDVJSETIH registrov",
    "# 2) need_static po VSEH ŠESTINDVJSETIH registrov",
)
out = out.replace(
    "# 3) must_miss — TODO-R347 … TODO-R371 NE SMEJO biti prisotni",
    "# 3) must_miss — TODO-R347 … TODO-R372 NE SMEJO biti prisotni",
)
# 7) zaključni bannerji
out = out.replace(
    "IN R371 val 54 (×4) ŽIVO NA PRODU",
    "IN R371 val 54 (×4) IN R372 val 55 (×4) ŽIVO NA PRODU",
)
out = out.replace("=== R372 PETINDVJSETIJNA ERA PREVERBA", "=== R373 ŠESTINDVJSETIJNA ERA PREVERBA")

checks = [
    ("REG_Z=\"scripts/qa-needles/r372.tsv\"", 1),
    ("preberi_register \"$REG_Z\" \"R372 val 55\"", 1),
    ("ŠESTINDVJSETIJNA", 4),
    ("TODO-R372|R372", 1),
    ("[ \"$need_n\" -lt 109 ]", 1),
    ("IN R372 val 55 (×4) ŽIVO NA PRODU", 1),
    ("/tmp/r373-prod-chunks", 1),
    ("r373-resolucija-", 2),  # -o izhod + grep vhod (isti blok) — disk resnica
    ("šestindvajsete preverbe R373", 1),  # NOVA glava — zaostanek popravljen
    ("petindvajsete preverbe R372", 0),  # zaostanek glave NE sme preživeti (4. vzorec)
    ("R372 pride na produ SAM", 0),  # stara glava mora biti zamenjana (R373)
    ("šestindvajset registrov", 1),  # novi prag-opis
    ("petindvajset registrov", 0),  # stari prag-opis zamenjan
    ("PETINDVJSETIJNA", 0),
    ("PETINDVJSETIH", 0),
    ("ŠESTINDVJSETIH", 1),
    ("Kanon R345–R372", 0),  # stari kanon žig zamenjan
    ("Kanon R345–R373", 1),
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
for r in range(347, 373):
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
if tot != 109:
    sys.exit(f"FAILOVEDANO: disk vsota {tot} ≠ 109")

DST.write_text(out, encoding="utf-8")
print(f"OK: {DST} zapisan ({len(out)} bajtov)")
