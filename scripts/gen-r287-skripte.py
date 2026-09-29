#!/usr/bin/env python3
# R287 — izpelja skript iz r286 vzorca (kanon: gen-* piše NOVE datoteke).
# r287-build-needles.sh: r286 kopija + R287 MANDATORY sekcija (zvonček
# opomnik + portal akcija) + TODO-R287 must_miss + posodobljen final echo.
# r287-run-smoke.sh: r286 dimni test s R287 žigom.
import re, pathlib

root = pathlib.Path('/home/z/my-project/scripts')

# ---------- 1) build-needles ----------
src = (root / 'r286-build-needles.sh').read_text(encoding='utf-8')

# header: zamenjaj prvi komentar blok (prve 3 vrstice)
src = src.replace(
    "# R286 — build needleji: (0) INVENTURA — PREMOŽENJSKI PREGLED CSV (P1-f\n"
    "# (f), 30. člen 'izvozi' družine: ISTA resnica kot R270 PDF, drug medij —\n"
    "# Excel/računovodski uvoz; EN VIR inventuraPregled — pariteta PO\n"
    "# KONSTRUKCIJI, 8 R270 tabelnih + id/Premiki/Izvoženo = 11; F1–F6);",
    "# R287 — build needleji: (0) ZVONČEK OPOMNIK + PORTAL AKCIJA ((k) —\n"
    "# ZAPRTJE evalvacije od R251: signal 7 iz ISTEGA /api/crm odgovora —\n"
    "# opomnikStatus VERBATIM; POTEKEL prioriteta; klik → CRM R182 protokol;\n"
    "# PhoneCall amber/red — 0 novih tokenov; lib opomnik-zvonek client-safe);",
    1,
)

# R287 sekcija: vstavi PRED R283 sekcijo (r286 uspeh toast je zadnji R286 needle)
r287_section = '''echo "--- R287 MANDATORY — ZVONČEK OPOMNIK + PORTAL AKCIJA ((k), signal 7) ---"
need_static "opomnikZvonekVrstice" "R287 lib graditelj (EN VIR /api/crm — status VERBATIM)"
need_static "R287: vhodi mora biti seznam strank" "R287 lib fail-verbose (TypeError — vzorec R228)"
need_static "POTEKEL · zapadlo " "R287 meta POTEKEL (koledarsko iskreno — polnočna sidra)"
need_static "opomnik-" "R287 id protokol (dedup zvončka kompatibilen)"
need_static "Opomnik · " "R287 iskren fallback opis (brez opisa = datum)"
echo "--- R287 MANDATORY STIL — zvonček vrstica + aria + copy (kanon R280–R286) ---"
need_static "— odpre CRM (opomnik)" "R287 aria-label (R217 vzorec — cilj izrečen)"
need_static "CRM opomniki" "R287 fail-verbose vir label (R182)"
need_static "Nizka zaloga, današnje montaže, naročila, vreme, računi, CRM opomniki in poslana obvestila." "R287 SheetDescription copy (r212 pin)"
need_static "ni aktivnih naročil, ni opomnikov in vreme ne povzroča skrbi." "R287 empty state copy (r222 pin)"
need_static "opomnikPotekel" "R287 kind literal (KIND_STYLE + meta alarm pogoj)"
echo "--- R283 MANDATORY — F3 vir pokritost mini-vrstica (issue #15 §3) ---"'''
assert 'need_static "Inventurni pregled premoženja prenešen v CSV" "R286 uspeh toast (WYSIWYG)"' in src
src = src.replace(
    'echo "--- R283 MANDATORY — F3 vir pokritost mini-vrstica (issue #15 §3) ---"',
    r287_section,
    1,
)

# must_miss: dodaj TODO-R287
src = src.replace(
    'must_miss "TODO-R286" "R286 — brez razvojnih ostankov"',
    'must_miss "TODO-R287" "R287 — brez razvojnih ostankov"\nmust_miss "TODO-R286" "R286 — brez razvojnih ostankov"',
    1,
)

# final echo: R287 ×10 novih
src = src.replace(
    'echo "NEEDLE FAIL=$FAIL (R286 ×8 novih;',
    'echo "NEEDLE FAIL=$FAIL (R287 ×10 novih; R286 ×8 novih;',
    1,
)

# ostale r286-reference v komentarjih → r287 (samo naslovna vrstica AWK ni potrebna — brez 'r286' literalov v logiki)
(root / 'r287-build-needles.sh').write_text(src, encoding='utf-8')

# ---------- 2) run-smoke ----------
smoke = (root / 'r286-run-smoke.sh').read_text(encoding='utf-8')
smoke = smoke.replace('R286', 'R287')
smoke = smoke.replace(
    "# R287 dimni test (vzorec r273) — standalone :3100 + javni health + prijavna\n"
    "# rute + PWA manifest (brez DB mutacij — samo bralni pepperji). Potrjuje, da\n"
    "# build z R287 spremembami (INVENTURA PREGLED CSV — P1-f (f), 30. člen:\n"
    "# ISTA resnica kot R270 PDF v Excelu + ISSUE #15 §12 dokaz — vitest pin;\n"
    "# kontrakt in core NIČ)\n",
    "# R287 dimni test (vzorec r273) — standalone :3100 + javni health + prijavna\n"
    "# rute + PWA manifest (brez DB mutacij — samo bralni pepperji). Potrjuje, da\n"
    "# build z R287 spremembami (ZVONČEK OPOMNIK + PORTAL AKCIJA — (k) ZAPRTJE\n"
    "# evalvacije od R251: signal 7 iz /api/crm, status VERBATIM, klik → CRM;\n"
    "# kontrakt in core NIČ)\n",
    1,
)
(root / 'r287-run-smoke.sh').write_text(smoke, encoding='utf-8')

print("OK — r287-build-needles.sh + r287-run-smoke.sh zapisana")
