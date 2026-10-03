#!/usr/bin/env python3
# r382-evolucija2.py — R382 druga evolucija (po dark-fix val 61: INS
# ' dark:focus-visible:border-roksal-ink/40' za light polovico je
# prelomil NASLEDNICO r363 (1. evolucija) in 2 lastna needleja r382
# (#2 team, #3 sessions) — vsi trije nosijo light-FB kot ZADNJI token.
# (1) r363: NASLEDNICA(1. evolucija) KOMENTIRANA ('EVOLVED R383 val 61
#     dark-fix') + NASLEDNICA-2 z dark polovico; need_static = 4.
# (2) r382: lastna registerja NI ŠE pushala — needleja #2/#3 se POPRAVITA
#     v živo (končna oblika z dark polovico) + komentar ob r382 glavi
#     dokumentira dark-fix korekcijo; need_static = 4.
# Fail-closed: žigi PRED/PO, NF=3, NASLEDNICA-2 ŽIVA v src.
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
LIGHT = "focus-visible:border-roksal-navy/40"
DARK = "dark:focus-visible:border-roksal-ink/40"

drevo = {str(p): p.read_text(encoding="utf-8", errors="replace") for p in sorted((REPO / "src").rglob("*.ts*"))}

# --- (1) r363: NASLEDNICA(1) → NASLEDNICA(2) ---
reg = REPO / "scripts/qa-needles/r363.tsv"
src = reg.read_text(encoding="utf-8")
vrstice = src.split("\n")
staro = "h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40"
novo = "h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"
if not any(novo in v for v in drevo.values()):
    sys.exit("FAILOVEDANO: r363 NASLEDNICA-2 NI ŽIVA v src")
stari_i = [i for i, l in enumerate(vrstice) if l.startswith(staro + " active:scale-[0.96]\t")]
if len(stari_i) != 1:
    sys.exit(f"FAILOVEDANO: r363 NASLEDNICA(1) ×{len(stari_i)} ≠ ×1")
i = stari_i[0]
opis = vrstice[i].split("\t")[1]
evolved = (
    "# " + vrstice[i]
    + " — EVOLVED R383 val 61 dark-fix: INS ' dark:focus-visible:border-roksal-ink/40' za light (R166 DARK stražar kanon R163–R166)"
    + " — naslednica = naslednja podatkovna vrstica"
)
naslednica2 = (
    f"{novo}\tR383 val 61 dark-fix evolucija r363 NASLEDNICE — NASLEDNICA-2 z dark polovico"
    f" (ŽIVO v src in ob R382 pushu; opis izvirnika: {opis})\tneed_static"
)
vrstice[i] = evolved + "\n" + naslednica2
out = "\n".join(vrstice)
podatki_po = [l for l in out.split("\n") if l and not l.startswith("#")]
ns_po = sum(1 for l in podatki_po if l.split("\t")[-1] == "need_static")
if ns_po != 4:
    sys.exit(f"FAILOVEDANO: r363 PO need_static = {ns_po} ≠ 4")
reg.write_text(out, encoding="utf-8")
print("OK: r363 NASLEDNICA-2 (z dark); need_static = 4")

# --- (2) r382: lastna needleja #2/#3 → končna oblika z dark ---
reg2 = REPO / "scripts/qa-needles/r382.tsv"
src2 = reg2.read_text(encoding="utf-8")
poprave = [
    (
        'className="h-8 px-2.5 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40"',
        'className="h-8 px-2.5 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"',
    ),
    (
        'className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40"',
        'className="press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"',
    ),
]
for staro2, novo2 in poprave:
    if src2.count(staro2 + "\t") != 1:
        sys.exit(f"FAILOVEDANO: r382 needle ×{src2.count(staro2 + chr(9))} ≠ ×1: {staro2[:60]!r}")
    src2 = src2.replace(staro2 + "\t", novo2 + "\t", 1)
# GLASNA dokumentacija dark-fix korekcije v glavi
zig = "# dark-fix korekcija (r382-evolucija2): needleja #2/#3 dopolnjena z dark polovico — register ni bil še pushan.\n"
src2 = src2.replace("# FORMAT (TSV;", zig + "# FORMAT (TSV;", 1)
reg2.write_text(src2, encoding="utf-8")
podatki2 = [l for l in src2.split("\n") if l and not l.startswith("#")]
ns2 = sum(1 for l in podatki2 if l.split("\t")[-1] == "need_static")
if ns2 != 4:
    sys.exit(f"FAILOVEDANO: r382 PO need_static = {ns2} ≠ 4")
print("OK: r382 needleja #2/#3 dopolnjena z dark polovico; need_static = 4")
