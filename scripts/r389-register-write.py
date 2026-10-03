#!/usr/bin/env python3
# r389-register-write.py — R389 fail-closed pisanje registra
# scripts/qa-needles/r389.tsv (kanon r388-register-write.py). Preverbe:
#  (1) idempotenca — abort, če register ŽE obstaja z vsebino;
#  (2) TSV struktura — točno 3 TAB polja na vrstico;
#  (3) needleji BAJTNATO ŽIVO v src/ (.tsx + .ts — LEKCIJA R384 (4));
#  (4) 0 pojavitev v HEAD 2ccba6c (needleji so NOVI z val 67);
#  (5) need_static = 2 (usklajeno z era verigo — naslednja runda ≥173).
import pathlib
import subprocess
import sys

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r389.tsv")
SRC = pathlib.Path("/home/z/my-project/src")
HEAD = "2ccba6c"

# val 67 = LASTNA-PREHOD GLADKOST (property-list nadgradnja); 2 × REPL:
# konflikt transition-transform + hover barvni žeton na istem elementu
# (r389-triaza.py element-točna; kaskadna disk resnica r389 stil/feature testi).
N1 = "transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-roksal-amber"
N2 = "transition-[transform,background-color,box-shadow] duration-200"

VSEBINA = f"""# qa-needles/r389.tsv — REGISTER needlejev runde R389 (STIL val 67:
# LASTNA-PREHOD GLADKOST — property-list nadgradnja; 2 × REPL in-place,
# 0 novih vrstic). Disk resnica rundi [r389-triaza.py element-točna +
# kaskadna analiza zgrajenega CSS]: konfliktna družina (transition-transform
# + hover barvni žeton na istem elementu) = TOČNO 2: notification L811
# (nativni ChevronRight — group-hover:text SNAP; aditivni transition-colors
# bi OVERIL transform: .transition-colors @117441 < .transition-transform
# @118190) + safety-tab L254 (ui-kit Button — baza transition-all OVERRIDANA
# s strani elementa @118190 > @117243; LEKCIJA R389 (3): cva baza pokritost
# je NIČNA, če element sam nosi ožjo transition-* utility).
# ANKOR: REPL in-place (star ožji token IZGINIL z tarčne vrstice — needle
# = NOVI najdaljši span); pre-skan r389-window-scan.py [13. generacija;
# REG_DO 388; delta +8/+30 ×transition-transform: 304 regexov 0 preozkih
# + 184 pinov 0 mrtvih + 150 slice-oknen + 0 vrstičnih odstopanj].
# EVOLVED V ISTI RUNDI (kanon R368): r388-stil-val66 (C) L811 pin →
# nadgrajena trditev + r388-hover-gladkost-generalizacija izjeme ×12→×11
# (L811 pokritost sedaj resnična — stražar jo PREVERJA); žigi
# [EVOLVED R389 val 67].
# ERA (R389): DVAINŠTIRIDESIJNA preverba EXIT=0 ×2 — 171/171 ŽIVO
# [42 registrov r347–r388]; LEKCIJA R389: (1) Vercel Security Checkpoint
# (403) onesnažil žetev [46/60 čankov = 403 strani; qa-harvest uspeh =
# ne-prazno telo] → CHECKPOINT GUARD v era-clone.py (GLASNA razširitev);
# (2) zamrznjen URL seznam iz R339 OPADE [5/60 = 'Not Found' telesa] →
# ODPADNI CENZUS + era kontrole dobile hash-rezolucijski fallback
# (R340 kontrola ŽIV prek fd237717403ebc43.js — izkazano).
# PROD (R389): prod-qa re-run 388 ZELEN ob poskusu 1 [23. runda] + spot
# r171/29 [val 66 MONTIRANO: n2Navy=1 + n4Red=1 className split; POGOJNE
# iskrene 0: setup done-stanje + foto uredjevalnik; sonde 27/27/0 + red 0;
# kolektor 0].
# KOLIZIJA: brez (fetch-first origin/main == HEAD 2ccba6c == R388 push).
#
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO — presledki
# znotraj needleja so POMENNI, ker grep -F išče dobesedno).
# Vrste: need_static (MORA biti ŽIV v svežem buildu) | must_miss
# (NESME biti v produkcijskih čankih).
{N1}\tR389 val 67 notification L811 (×1, nativni ChevronRight — property-list nadgradnja transition-transform → transition-[transform,color]; group-hover:text-roksal-amber NEHA biti snap; aditivno NI šlo — kaskada) (0 v HEAD 2ccba6c)\tneed_static
{N2}\tR389 val 67 safety-tab L254 (×1, ui-kit Button — baza transition-all OVERRIDANA; nadgradnja → [transform,background-color,box-shadow]; hover:bg-roksal-navy/90 NEHA biti snap) (0 v HEAD 2ccba6c)\tneed_static
TODO-R389\tmust_miss: razvojni ostanki (nesme biti v produkcijskih čankih)\tmust_miss
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
    if need_static != 2:
        sys.exit(f"FAILOVEDANO: need_static={need_static} (pričakovano 2 — era veriga ≥173)")
    REG.write_text(VSEBINA, encoding="utf-8")
    print(f"OK: {REG} zapisan ({need_static} need_static + must_miss; 0-v-HEAD {HEAD}; ŽIVO v src bajtno)")


if __name__ == "__main__":
    main()
