#!/usr/bin/env python3
# r382-evolucija.py — R382 GLASNA evolucija DVEH register vrstic
# (REGISTER EVOLUCIJA kanon r371 N3 / R377, 4.+5. uporaba):
# val 61 INS ' focus-visible:border-roksal-navy/40' TIK ZA
# 'focus-visible:ring-offset-2' je prelomil DVA stara needleja, ki
# SPANATA ČEZ O2:
#   (1) r363.tsv (val 46) — '...ring-offset-2 active:scale-[0.96]'
#   (2) r364.tsv (val 47) — '...ring-offset-2"' (z zaključnim navedkom)
# MEHANIZEM (kanon validate_registry): stara need_static vrstica
# KOMENTIRANA dobesedno ('EVOLVED R383 val 61') + NASLEDNICA podatkovna
# vrstica z evoluiranim nizom; need_static števca r363/r364 = 4/4
# NESPREMENJENA (era vsote veljavne); NASLEDNICA ŽIVO v src takoj (border
# INS že apliciran) in na produ OB TEM pushu.
# Fail-closed: žigi PRED (točno ×1), žigi PO (točno ×1), NF=3 validacija,
# NASLEDNICA mora biti ŽE ŽIVA v src (apply je bil pred tem).
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")

PRIMERI = [
    {
        "reg": REPO / "scripts/qa-needles/r363.tsv",
        "runda": "r363",
        "staro": "h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 active:scale-[0.96]",
        "novo": "h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 active:scale-[0.96]",
        "ns_pričakovano": 4,
    },
    {
        "reg": REPO / "scripts/qa-needles/r364.tsv",
        "runda": "r364",
        "staro": 'h-8 px-3 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"',
        "novo": 'h-8 px-3 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40"',
        "ns_pričakovano": 4,
    },
]

# NASLEDNICA mora biti ŽE ŽIVA v src (apply je bil pred tem)
drevo = {str(p): p.read_text(encoding="utf-8", errors="replace") for p in sorted((REPO / "src").rglob("*.ts*"))}
for p in PRIMERI:
    if not any(p["novo"].rstrip('"') in v for v in drevo.values()):
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
    for l in podatki:
        if len(l.split("\t")) != 3:
            sys.exit(f"FAILOVEDANO: {p['runda']} NF≠3: {l[:60]!r}")

    opis_orig = vrstice[i].split("\t")[1]
    evolved = (
        "# " + vrstice[i]
        + " — EVOLVED R383 val 61: INS ' focus-visible:border-roksal-navy/40' TIK ZA 'focus-visible:ring-offset-2' NA ISTI vrstici (val 57 border-pariteta kanon)"
        + " — vrstica KOMENTIRANA (zgodovina dobesedno; validate_registry/preberi_register/era-clone/window-scan je preskočijo),"
        + " naslednica = naslednja podatkovna vrstica"
    )
    naslednica_v = (
        f"{p['novo']}\tR383 val 61 evolucija {p['runda']} needleja — NASLEDNICA komentirane vrstice zgoraj"
        f" (NASLEDNICA ŽIVO ob R382 pushu; opis izvirnika: {opis_orig})\tneed_static"
    )
    vrstice[i] = evolved + "\n" + naslednica_v
    out = "\n".join(vrstice)

    podatki_po = [l for l in out.split("\n") if l and not l.startswith("#")]
    ns_po = sum(1 for l in podatki_po if l.split("\t")[-1] == "need_static")
    if ns_po != p["ns_pričakovano"]:
        sys.exit(f"FAILOVEDANO: PO need_static {p['runda']} = {ns_po} ≠ {p['ns_pričakovano']}")
    stari_pod = sum(1 for l in podatki_po if l.startswith(p["staro"] + "\t"))
    if stari_pod != 0:
        sys.exit(f"FAILOVEDANO: {p['runda']} stari needle še podatkovna vrstica")
    nov_pod = sum(1 for l in podatki_po if l.startswith(p["novo"] + "\t"))
    if nov_pod != 1:
        sys.exit(f"FAILOVEDANO: {p['runda']} NASLEDNICA ×{nov_pod} ≠ ×1")
    for l in podatki_po:
        if len(l.split("\t")) != 3:
            sys.exit(f"FAILOVEDANO: {p['runda']} PO NF≠3")
    reg.write_text(out, encoding="utf-8")
    print(f"OK: {p['runda']}.tsv needle EVOLVED R383 val 61 + NASLEDNICA; need_static = {p['ns_pričakovano']} NESPREMENJEN")
