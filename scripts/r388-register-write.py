#!/usr/bin/env python3
# r388-register-write.py — R388 fail-closed pisanje registra
# scripts/qa-needles/r388.tsv (kanon r387-register-write.py). Preverbe:
#  (1) idempotenca — abort, če register ŽE obstaja z vsebino;
#  (2) TSV struktura — točno 3 TAB polja na vrstico;
#  (3) needleji BAJTNATO ŽIVO v src/ (.tsx + .ts — LEKCIJA R384 (4));
#  (4) 0 pojavitev v HEAD 30f9864 (needleji so NOVI z val 66);
#  (5) need_static = 4 (usklajeno z era verigo — naslednja runda ≥171).
import pathlib
import subprocess
import sys

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r388.tsv")
SRC = pathlib.Path("/home/z/my-project/src")
HEAD = "30f9864"

# val 66 = HOVER-BARVNA GLADKOST (transition-colors); 21 × INS:
# PRE anchor ×19 (žeton PRED hover) + PO anchor ×2 (dashboard L2941 +
# photo L2081 — PRE span pinan v zamrznjenih prod-qa skriptah).
N1 = "rounded-xl bg-roksal-amber px-5 text-sm font-bold text-white shadow-md transition-colors hover:bg-roksal-amber/90"
N2 = "text-roksal-ink transition-colors hover:bg-roksal-navy/15"
N3 = "hover:bg-roksal-amber/90 transition-colors disabled:opacity-50"
N4 = "text-roksal-red transition-colors hover:bg-roksal-red/20"

VSEBINA = f"""# qa-needles/r388.tsv — REGISTER needlejev runde R388 (STIL val 66:
# HOVER-BARVNA GLADKOST — transition-colors na nativnih interaktivnih
# elementih z roksal hover barvami; 21 × INS, in-place, 0 novih vrstic).
# Disk resnica rundi [r388-triaza*.py, element-točna triaža]: 21 REALnih
# gapov (hover:(bg|text)-roksal-* BREZ transition pokritosti na nivoju
# elementa); ui-kit Button baza 'transition-all' pokrije vse, Badge baza
# 'transition-[color,box-shadow]' NE pokrije bg → Badge vrstice z
# hover:bg rabijo LASTNO transition-colors (dashboard ×11 + termini-card
# ×1); iskrene izključitve: mrtvi hover žetoni (hover:bg == bg ×4,
# pointer-events-none ×2), mrtvi izvozi termini-prikaz ×4, transition-
# transform konflikt notification L811 (NI aditivno rešljiv).
# ANKOR: PRE ×19 + PO ×2 [dashboard L2941 + photo L2081 — PRE span je
# PINAN v zamrznjenih prod-qa skriptah r313–r339 + r315-stil-val6; PO
# vstavljanje ohranja span → brez PIN SHIFTa za zamrznjene skripte;
# LEKCIJA R387 kanon: pre-skan MORA grepati TUDI scripts/*.sh].
# ⭐ LEKCIJA R368 KANON (PIN SHIFT V ISTI RUNDI): r211-fail-verbose-
# detail-strazar.test.ts je pinil celoten className L2459+L2602 — PIN
# SHIFT ×2 V ISTI RUNDI (faza 2 r388-val66-apply.py, žig [PIN SHIFT
# R388 val 66]).
# FEATURE (R388): ČETRTI STRAŽAR — hover gladkost GENERALIZACIJA
# r388-hover-gladkost-generalizacija.test.ts [×10: it.each val 66 tarče +
# globalna kršitev = 0 čez VSE src z element-točno pokritostno logiko +
# ui-kit bazi zamrznjeni]. Komplet varuhov: r385 (dark FB) + r386 (O2)
# + r387 (FB-border) + r388 (transition pokritost).
# Orodja: r388-triaza.py (K1/K2/K3 sveža triaža handover kandidatov —
# plain amber ring 9, mrtev-CSS navy 82, dark-only pari 1 = ZAMRZNJENE
# statistike, disk resnica) + r388-triaza3/4/5.py (transition census,
# element-točno) + r388-val66-apply.py [fail-closed kontrakt ×21 + PIN
# SHIFT r211 ×2 v ENEM atomskem koraku; POST in-place; ponovni tek =
# 0 INS / abort] + r388-window-scan.py [12. generacija; TARGETS +4:
# setup-client, activation-client, viz-tab, product-home; REG_DO 387;
# delta 18 ×9 žetonov: 304 regexov 0 preozkih + 180 pinov 0 mrtvih +
# 133 slice-oknen + 0 odstopanj] + r388-era-harvest.sh [41. preverba
# ENAINŠTIRIDESIJNA, EXIT=0 ×2 — 167/167 ŽIVO; VSEH 12 server-probe
# spec-ov IZRECNO — LEKCIJA R384 (1)] + spot-r167/28 [val 65
# POST-deploy: notification L748 MONTIRANO 10× (20 tokenov LOČENO +
# seam 10×), photo STROKES iskreno 0 (POGOJNA — brez odprte fotografije),
# PAR žeton 10×, sonde čiste, kolektor 0].
# KOLIZIJA: brez (fetch-first origin/main == HEAD 30f9864 == R387 push).
#
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO — presledki
# znotraj needleja so POMENNI, ker grep -F išče dobesedno).
# Vrste: need_static (MORA biti ŽIV v svežem buildu) | must_miss
# (NESME biti v produkcijskih čankih).
{N1}\tR388 val 66 setup L100 + aktivacija L65 (×2, nativni <Link> CTA — PRE anchor; ožji žeton ker m/[token] measure-client L322 nosi ISTI span ŽE v HEAD — obstojec precedens gladkosti) (0 v HEAD 30f9864)\tneed_static
{N2}\tR388 val 66 dashboard L1223+L1319 (×2, Badge navy/10→/15 hover — Badge baza NE pokrije bg; PRE anchor) (0 v HEAD 30f9864)\tneed_static
{N3}\tR388 val 66 photo L2081 (×1, PO anchor dokaz — hover žeton PRED transition-colors; PRE span pinan v prod-qa skriptah) (0 v HEAD 30f9864)\tneed_static
{N4}\tR388 val 66 dashboard red/20 družina (×4: L1238/L2459/L2602/L2936) + r211 PIN SHIFT žig žeton (0 v HEAD 30f9864)\tneed_static
TODO-R388\tmust_miss: razvojni ostanki (nesme biti v produkcijskih cankih)\tmust_miss
"""


def main() -> None:
    if REG.exists() and REG.read_text(encoding="utf-8").strip():
        sys.exit(f"FAILOVEDANO: {REG} ŽE obstaja z vsebino (nikoli prepisuj)")
    vrstice = [l for l in VSEBINA.splitlines() if l and not l.startswith("#")]
    for l in vrstice:
        if len(l.split("\t")) != 3:
            sys.exit(f"FAILOVEDANO: TSV vrstica brez točno 3 TAB polj: {l[:60]}")
    vsa_src = "".join(p.read_text(encoding="utf-8") for p in SRC.rglob("*") if p.suffix in (".tsx", ".ts") and p.is_file())
    for l in vrstice:
        needle = l.split("\t")[0]
        if needle.startswith("TODO-"):
            continue
        if needle not in vsa_src:
            sys.exit(f"FAILOVEDANO: needle NI ŽIVO v src/: {needle[:60]}")
        head_vsebina = subprocess.run(["git", "grep", "-qF", "--", needle, HEAD, "--", "src/"], capture_output=True)
        if head_vsebina.returncode == 0:
            sys.exit(f"FAILOVEDANO: needle ŽE v HEAD {HEAD} (kanon 0-v-HEAD): {needle[:60]}")
    need_static = sum(1 for l in vrstice if l.split("\t")[2] == "need_static")
    if need_static != 4:
        sys.exit(f"FAILOVEDANO: need_static={need_static} (pričakovano 4 — era veriga)")
    REG.write_text(VSEBINA, encoding="utf-8")
    print(f"OK: {REG} zapisan ({need_static} need_static + must_miss; 0-v-HEAD {HEAD}; ŽIVO v src bajtno)")


if __name__ == "__main__":
    main()
