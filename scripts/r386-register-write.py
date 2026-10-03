#!/usr/bin/env python3
# r386-register-write.py — R386 fail-closed pisanje registra
# scripts/qa-needles/r386.tsv (kanon r385-register-write.py). Preverbe:
#  (1) idempotenca — abort, če register ŽE obstaja z vsebino;
#  (2) TSV struktura — točno 3 TAB polja na vrstico;
#  (3) needleji BAJTNISO ŽIVO v src/ (.tsx + .ts — LEKCIJA R384 (4));
#  (4) 0 pojavitev v HEAD 666a7cc (needleji so NOVI z val 64);
#  (5) need_static = 4 (usklajeno z era verigo — naslednja runda ≥163).
import pathlib
import subprocess
import sys

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r386.tsv")
SRC = pathlib.Path("/home/z/my-project/src")
HEAD = "666a7cc"

N1 = "flex w-full items-center gap-3 rounded-xl border border-roksal-amber/40 bg-roksal-amber/5 p-3 text-left animate-fade-in-up cursor-pointer transition-colors hover:bg-roksal-amber/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40"
N2 = "flex items-center gap-1 rounded-lg border border-roksal-amber/30 bg-roksal-amber/5 px-2 py-1 text-[11px] font-medium text-roksal-amber hover:bg-roksal-amber/10 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40 focus-visible:outline-none"
N3 = "flex w-full cursor-pointer items-center gap-2 rounded-xl border border-roksal-amber/40 bg-roksal-amber/5 p-3 text-left shadow-sm animate-fade-in-up transition-colors hover:bg-roksal-amber/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40"
N4 = "focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40"

VSEBINA = f"""# qa-needles/r386.tsv — REGISTER needlejev runde R386 (STIL val 64:
# AMBER/40 BORDER-PARITETA — zaključek amber simetrije skupaj z val 63;
# 3 × INS, in-place, 0 novih vrstic; kanon R386 handover kandidat 1).
# Disk resnica r386-triaza.py [polna triaža po LEKCIJI R382 (1)]: 3 tarče
# z VIDLJIVIM borderjem — vse border-class [dashboard L1946
# border-roksal-amber/40 kartica, measurements L3478 border-roksal-amber/30,
# vodja L2093 border-roksal-amber/40 kartica — rdeči dvojček L2122 ima FB
# že od val 62], vseh 3 z O2; 2 N/A iskreno izključena (dashboard L1749,
# measurements L3329 — brez borderja + brez sorojenca z FB); 21 IZVEN
# obsega (amber/50 zaključen val 63 ×15 + amber/60 prihodnji val) →
# 3 × INS ' focus-visible:border-roksal-amber/40
# dark:focus-visible:border-roksal-amber/40' TIK ZA O2 (val 57 kanon
# R375) — LEKCIJA R383 (2): PAR (light + dark) v ENEM koraku; dark /40 po
# družinskem precedensu z ISTO intenziveto — crm-tab L811
# 'dark:border-roksal-amber/40' Card (edini obstoječi dark amber/40 border
# v kodebazi; amber ostane amber v temni temi — barva je pomen, NI ink).
# ⭐ LEKCIJA R385 (1) UPOŠTEVANA: r368-stil-val51 (B) N3 pojavitveni pin
# PIN SHIFTAN V ISTI RUNDI [stari adjacency 2→1 — L3329 (N/A) ohrani;
# EVOLVED adjacency ×1 — L3478 z FB+dark]; register r368 N3 needle ŽIVO
# (grep binarno — L3329); register needle-survival v apply potrdil 0 mrtvih.
# FEATURE (R386): O2 pairing stražar GENERALIZACIJA — vsak barvni focus
# ring (navy 237 / red 25 / amber 26) nosi O2 — r386-ring-o2-
# generalizacija.test.ts [×5: per-družina razcep = 0 + FROZEN izjema #2
# roksal-catalog L95 <Input> dokumentirana + TOČNO 1 + globalna števca
# zamrznjena]; komplement r385-fb-dark-generalizacija [EVOLVED — amber
# PAR seznam razširjen na /50+/40 intenziteti, disk 159/16/15+3].
# Orodja: r386-triaza.py [dark-polovica lookbehind fix — light ring /40
# detekcija EXCLUDE 'dark:focus-visible:ring-roksal-amber/40' (notification
# L748 light ring je /60!)] + r386-val64-apply.py [fail-closed kontrakt ×3,
# POST closure lookbehind + in-place + needle survival; ponovni tek = 0
# INS] + r383-window-scan delta 79 'focus-visible:ring-roksal-amber/40
# focus-visible:ring-offset-2' [pre-skan PRED apply: 304 regexov 0 preozkih
# + 164 pinov 0 mrtvih + 133 slice-oknen + 0 odstopanj] + r386-era-harvest.sh
# [39. preverba DEVETINTRIDESIJNA, EXIT=0 ×2 — 159/159 ŽIVO; VSEH 12
# server-probe spec-ov — LEKCIJA R384 (1)] + spot-r167/26 [val 63
# POST-deploy: vodja N1 1/1 + N2 1/1 + photo kategorije 3/3 MONTIRANO
# (tokeni LOČENO); inclinometer iskreno 0 [historyError vrata]; kolektor 0].
# KOLIZIJA: brez (fetch-first origin/main == HEAD 666a7cc == R385 push).
#
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO — presledki
# znotraj needleja so POMENNI, ker grep -F išče dobesedno).
# Vrste: need_static (MORA biti ŽIV v svežem buildu) | must_miss
# (NESME biti v produkcijskih čankih).
{N1}\tR386 val 64 dashboard-tab L1946 (×1, kartica nativni gumb) — border-pariteta: FB amber/40+dark TIK ZA O2 (0 v HEAD 666a7cc)\tneed_static
{N2}\tR386 val 64 measurements-tab L3478 (×1, nativni gumb + active:scale rep) — border-pariteta: FB amber/40+dark TIK ZA O2 (0 v HEAD 666a7cc)\tneed_static
{N3}\tR386 val 64 vodja-dashboard L2093 (×1, kartica — rdeči dvojček L2122 FB od val 62) — border-pariteta: FB amber/40+dark TIK ZA O2 (0 v HEAD 666a7cc)\tneed_static
{N4}\tR386 val 64 družinski PAR žeton (×3 — dashboard L1946 + measurements L3478 + vodja L2093; +EVOLVED r368 N3 adjacency) — FB amber/40+dark par (0 v HEAD 666a7cc)\tneed_static
TODO-R386\tmust_miss: razvojni ostanki (nesme biti v produkcijskih cankih)\tmust_miss
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
