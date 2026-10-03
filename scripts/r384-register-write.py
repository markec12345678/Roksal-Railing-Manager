#!/usr/bin/env python3
# r384-register-write.py — R384 fail-closed pisanje registra
# scripts/qa-needles/r384.tsv (kanon r383-register-write.py). Preverbe:
#  (1) idempotenca — abort, če register ŽE obstaja z vsebino;
#  (2) TSV struktura — točno 3 TAB polja na vrstico (LEKCIJA R382 (2):
#      presledki-namesto-TAB = Z-STRUCT zavrnitev);
#  (3) needleji BAJTNISO ŽIVO v src/ (LEKCIJA R383 (4): goli repi — brez
#      'className="' prefixa in brez končnega navedka);
#  (4) 0 pojavitev v HEAD d1cb4d2 (needleji so NOVI z val 62 — kanon
#      '0 v HEAD');
#  (5) need_static = 4 (usklajeno z era-clone.py --expected-total 151
#      verižnim segmentom 'IN r383.tsv val 61 ×4 IN r384.tsv val 62 ×4 na').
import pathlib
import subprocess
import sys

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r384.tsv")
ROKSAL = pathlib.Path("/home/z/my-project/src/components/roksal")
HEAD = "d1cb4d2"

VSEBINA = """# qa-needles/r384.tsv — REGISTER needlejev runde R384 (STIL val 62:
# RED/40 BORDER-PARITETA — rdeča simetrija po navy zaključku val 61;
# 16 × INS, in-place, 0 novih vrstic; kanon R384 handover kandidat 1).
# Disk resnica r384-triaza.py [polna triaža po LEKCIJI R382 (1)]: 16 tarč
# z VIDLJIVIM borderjem [border-roksal-red/N barvni override na <Button
# variant="outline"> ALI eksplicitni border na nativnem gumbu/kartici],
# vseh 16 z O2; 9 N/A iskreno izključenih (brez borderja + brez
# sorojenca z FB: top-bar ×2, photo, material, notification, measurements
# ×2, quote-followup, sistem-zdravje) → 16 × INS ' focus-visible:
# border-roksal-red/40 dark:focus-visible:border-roksal-red/50' TIK ZA
# O2 (val 57 kanon R375) — LEKCIJA R383 (2): PAR (light + dark) v ENEM
# koraku; dark /50 po precedensu team-tab L619 'border-roksal-red/40
# dark:border-roksal-red/50' (rdeča ostane rdeča v temni temi).
# PAR-SOROJENCI (R384 kandidat 3, LEKCIJA R382 (2)): r384-triaza.py
# detekcija — 14 BREZ-SOROJENCA + 2 red-red dvojčka (dashboard
# L1914↔L2059, oba parirana) + top-bar navy/red meni (obe strani brez
# FB = uniformost); živi čuvaj: r384-sorojenci-par.test.ts (3 it).
# Orodja: r384-triaza.py + r384-val62-apply.py [fail-closed kontrakt
# vrstičnih list bajtno, POST closure+in-place+needle survival — lekcija:
# dark: token VSEBUJE light podniz → closure števec rabi negative
# lookbehind; needle-survival fallback MORA pokrivati .ts server rute] +
# r383-window-scan delta 75 'focus-visible:ring-roksal-red/40
# focus-visible:ring-offset-2' [pre-skan PRED apply, LEKCIJA R383 (3):
# 304 okenskih regexov 0 preozkih + 164 needle pinov 0 mrtvih → 0 PIN
# SHIFT potrebno] + r384-era-harvest.sh [37. preverba SEDEMINTRIDESIJNA,
# EXIT=0 ×2 — 151/151 ŽIVO = 127 direktno + 6 hash + 18 server; LEKCIJA
# R384 (1): era-clone --server-probe MENJA spec list, ne dopolnjuje —
# prvotni tek z 1 specom EXIT=2 [24 MISS, 0 razrešenih], popravek z
# VSEH 12 spec-ov EXIT=0] + spot-r167/24 [val 61 POST-deploy: calculator
# izvoz 11/11 + sessions Zapri 6/6 MONTIRANO; ekipa 0 [users.read 403
# gate] + material 0 ['Izberi projekt' prazno stanje] iskreno; kolektor 0].
# KOLIZIJA: brez (fetch-first origin/main == HEAD d1cb4d2 == R383 push).
#
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO — presledki
# znotraj needleja so POMENNI, ker grep -F išče dobesedno).
# Vrste: need_static (MORA biti ŽIV v svežem buildu) | must_miss
# (NESME biti v produkcijskih čankih).
h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 focus-visible:border-roksal-red/40 dark:focus-visible:border-roksal-red/50	R384 val 62 dashboard-tab L1914 (×2 — bajtni dvojček L2059, sorojenec kanon) — Button outline border-pariteta: FB+dark TIK ZA O2 (0 v HEAD d1cb4d2)	need_static
h-7 shrink-0 gap-1 border-roksal-red/30 px-2 text-2xs text-roksal-red hover:bg-roksal-red/10 press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 focus-visible:border-roksal-red/40 dark:focus-visible:border-roksal-red/50	R384 val 62 sessions-dialog L316 (×1) — Button outline /30 barvni override: FB+dark TIK ZA O2 (0 v HEAD d1cb4d2)	need_static
rounded-lg border border-roksal-red/30 bg-roksal-red/5 p-1 text-roksal-red hover:bg-roksal-red/10 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 focus-visible:border-roksal-red/40 dark:focus-visible:border-roksal-red/50 active:scale-[0.96]	R384 val 62 measurements-tab L5679 (×1, nativni gumb) — eksplicitni border + FB+dark + active:scale rep (0 v HEAD d1cb4d2)	need_static
flex w-full cursor-pointer items-center gap-2 rounded-xl border border-roksal-red/20 bg-roksal-red/5 p-3 text-left shadow-sm animate-fade-in-up transition-colors hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 focus-visible:border-roksal-red/40 dark:focus-visible:border-roksal-red/50	R384 val 62 vodja-dashboard L2122 (×1, kartica) — eksplicitni border kartice: FB+dark TIK ZA O2 (0 v HEAD d1cb4d2)	need_static
TODO-R384	must_miss: razvojni ostanki (nesme biti v produkcijskih cankih)	must_miss
"""

ŽIG_PREJ = "<<<R384-REGISTER-PREJ>>>"
ŽIG_PO = "<<<R384-REGISTER-PO>>>"


def main() -> None:
    if REG.exists() and REG.read_text(encoding="utf-8").strip():
        sys.exit(f"FAILOVEDANO: {REG} ŽE obstaja z vsebino (idempotenca)")
    vrstice = [l for l in VSEBINA.splitlines() if l and not l.startswith("#")]
    # (2) TSV struktura
    for l in vrstice:
        polja = l.split("\t")
        if len(polja) != 3:
            sys.exit(f"FAILOVEDANO TSV: vrstica ima {len(polja)} polj ≠ 3: {l[:60]}")
    need_static = [l.split("\t")[0] for l in vrstice if l.endswith("need_static")]
    if len(need_static) != 4:
        sys.exit(f"FAILOVEDANO: need_static={len(need_static)} ≠ 4 (era veriga pričakuje ×4)")
    if not any(l.startswith("TODO-R384") for l in vrstice):
        sys.exit("FAILOVEDANO: TODO-R384 must_miss manjka")
    # (3) needleji ŽIVO v src
    lokacije = {
        need_static[0]: "dashboard-tab.tsx",
        need_static[1]: "sessions-dialog.tsx",
        need_static[2]: "measurements-tab.tsx",
        need_static[3]: "vodja-dashboard.tsx",
    }
    for needle, dat in lokacije.items():
        vir = (ROKSAL / dat).read_text(encoding="utf-8")
        if vir.count(needle) < 1:
            sys.exit(f"FAILOVEDANO: needle NI ŽIVO v {dat}: {needle[:60]}")
    # (4) 0 v HEAD
    for needle, dat in lokacije.items():
        stara = subprocess.run(
            ["git", "show", f"{HEAD}:src/components/roksal/{dat}"],
            capture_output=True, text=True, cwd="/home/z/my-project",
        ).stdout
        if needle in stara:
            sys.exit(f"FAILOVEDANO: needle ŽE v HEAD {HEAD} ({dat}) — ni nov z val 62")
    print("OK: TSV ×5 vrstic (4 need_static + TODO-R384), bajtno ŽIVO v src, 0 v HEAD d1cb4d2")
    # (5) žigi pred/po (deterministični dokaz pisanja)
    print(ŽIG_PREJ)
    REG.write_text(VSEBINA, encoding="utf-8")
    print(ŽIG_PO)
    print(f"OK: {REG} zapisan ({REG.stat().st_size} bajtov)")


if __name__ == "__main__":
    main()
