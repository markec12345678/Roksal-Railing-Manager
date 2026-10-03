#!/usr/bin/env python3
# r385-evolucija.py — R385 GLASNA evolucija ENE register vrstice
# (REGISTER EVOLUCIJA kanon r371 N3 / R377, 7. uporaba: 1.–3. r371/R377,
# 4.+5. R383, 6. R384 implicitno prek dark-fix korekcije):
# val 63 INS ' focus-visible:border-roksal-amber/50
# dark:focus-visible:border-roksal-amber/30' TIK ZA
# 'focus-visible:ring-offset-2' je prelomil EN stari needle, ki SPANA ČEZ
# O2 do outline-none:
#   (1) r368.tsv (val 51) — '...ring-offset-2 focus-visible:outline-none'
#       (photo L740 kategorija gumb)
# MEHANIZEM (kanon validate_registry): stara need_static vrstica
# KOMENTIRANA dobesedno ('EVOLVED R385 val 63') + NASLEDNICA podatkovna
# vrstica z evoluiranim nizom; need_static števec r368 = 4 NESPREMENJEN
# (era vsote veljavne); NASLEDNICA ŽIVO v src takoj (val 63 INS že
# apliciran) in na produ OB TEM pushu.
# ⭐ LEKCIJA R385 (1): pre-skan (r383-window-scan) pokriva okenske regexe
# + register pine + slice-okna, NE pa POJAVITVENE (grep -o) era-diskriminator
# pine v STAREJŠIH stil testih — r368-stil-val51.test.ts (B) N1 adjacency
# pin ujet šele v FULL vitest teku 1; PIN SHIFT v ISTI rundi + evolucija
# registra = kanon (amber-družinska dela MORAJO pre-skaniati tudi stare
# amber stil teste — val 51 = amber runda).
# Fail-closed: žigi PRED (točno ×1), žigi PO (točno ×1), NF=3 validacija,
# NASLEDNICA mora biti ŽE ŽIVA v src (apply je bil pred tem).
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")

PRIMERI = [
    {
        "reg": REPO / "scripts/qa-needles/r368.tsv",
        "runda": "r368",
        "staro": "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 focus-visible:outline-none",
        "novo": "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 focus-visible:border-roksal-amber/50 dark:focus-visible:border-roksal-amber/30 focus-visible:outline-none",
        "ns_pričakovano": 4,
    },
]

# NASLEDNICA mora biti ŽE ŽIVA v src (apply je bil pred tem)
drevo = {str(p): p.read_text(encoding="utf-8", errors="replace") for p in sorted((REPO / "src").rglob("*.ts*"))}
for p in PRIMERI:
    if not any(p["novo"] in v for v in drevo.values()):
        sys.exit(f"FAILOVEDANO: NASLEDNICA NI ŽIVA v src za {p['runda']}: {p['novo'][:60]!r}")

for p in PRIMERI:
    reg = p["reg"]
    src = reg.read_text(encoding="utf-8")
    vrstice = src.split("\n")
    podatki = [l for l in vrstice if l and not l.startswith("#")]
    ns_pred = sum(1 for l in podatki if l.split("\t")[-1] == "need_static")
    if ns_pred != p["ns_pričakovano"]:
        sys.exit(f"FAILOVEDANO: PRED need_static {p['runda']} = {ns_pred} ≠ {p['ns_pričakovano']}")
    stari_i = [i for i, l in enumerate(vrstice) if l.startswith(p["staro"] + "\t")]
    if len(stari_i) != 1:
        sys.exit(f"FAILOVEDANO: stari needle ({p['runda']}) ×{len(stari_i)} ≠ ×1")
    i = stari_i[0]
    if not vrstice[i].endswith("\tneed_static"):
        sys.exit(f"FAILOVEDANO: {p['runda']} stari needle ni need_static")
    if p["novo"] in src:
        sys.exit(f"FAILOVEDANO: {p['runda']} NASLEDNICA ŽE prisotna (idempotenca) — abort")
    # KOMENTIRAJ staro (zgodovina dobesedno) + NASLEDNICA podatkovna vrstica
    staro_opis = vrstice[i].split("\t")[1]
    nova_vrstica = f"{p['novo']}\tR385 val 63 evolucija {p['runda']} N1 — NASLEDNICA komentirane vrstice zgoraj (opis izvirnika: {staro_opis})\tneed_static"
    vrstice[i] = "# " + vrstice[i] + " — EVOLVED R385 val 63: val 63 INS FB amber+dark TIK ZA O2 prelomil adjacency (span čez O2 do outline-none); NASLEDNICA = naslednja podatkovna vrstica (zgodovina dobesedno; validate_registry/era-clone/window-scan jo preskočijo)"
    vrstice.insert(i + 1, nova_vrstica)
    nov_src = "\n".join(vrstice)
    podatki_nov = [l for l in nov_src.split("\n") if l and not l.startswith("#")]
    ns_nov = sum(1 for l in podatki_nov if l.split("\t")[-1] == "need_static")
    if ns_nov != p["ns_pričakovano"]:
        sys.exit(f"FAILOVEDANO: PO need_static {p['runda']} = {ns_nov} ≠ {p['ns_pričakovano']} (števec mora ostati)")
    for l in podatki_nov:
        if len(l.split("\t")) != 3:
            sys.exit(f"FAILOVEDANO: NF≠3 PO evoluciji ({p['runda']}): {l[:60]}")
    reg.write_text(nov_src, encoding="utf-8")
    print(f"OK: {reg.name} — N1 EVOLVED R385 val 63 + NASLEDNICA podatkovna (need_static {ns_nov}/{p['ns_pričakovano']} nespremenjen)")

print("=== r385-evolucija KONEC (7. uporaba kanona) ===")
