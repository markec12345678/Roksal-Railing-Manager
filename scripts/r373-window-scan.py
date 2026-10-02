#!/usr/bin/env python3
# r373-window-scan.py — R373 klon r372-window-scan.py (istaknologija ista;
# TARGETS = val 56 surove datoteke (photo-tab + dashboard-tab)): stale-pin
# PRED-SKAN kot ORODJE — formalizacija LEKCIJE R369 (2) ("stale-pin PRED-skan
# mora enumerirati VSE okenske kvantifikatorje {0,N} nad tarčnimi datotemi;
# sosledja-skan je ulovil sosledja, NI pa okna — FULL vitest je edini zanesljiv
# mrežni skan"). Delovanje:
#   1) za vsako tarčno datoteko poišči teste, ki jo berejo (readFileSync …
#      <ime>.tsx);
#   2) v teh testih enumeriraj VSE regex literale z okenskim kvantifikatorjem
#      {0,N} (in splošne {M,N});
#   3) vsak regex POŽENI nad TRENUTNO disk vsebino tarčne datoteke in
#      poročaj MATCH/NO-MATCH + uporabljen okenski razpon;
#   4) dolžinsko-delta način (_argument 'delta N'): simulira vstavitve
#      skupne dolžine N v vsako vrstico z žetonom in poroča, če kateri
#      MATCH regex ob tem IZGINE (okno pre Ozko) — PREDVIDENJE pin shiftov
#      PRED full vitestom.
# Uporaba: python3 scripts/r370-window-scan.py [delta <znakova> <žeton>]
import re, pathlib, sys

TARGETS = [
    "src/components/roksal/photo-tab.tsx",
    "src/components/roksal/dashboard-tab.tsx",
]
TESTS = pathlib.Path("src/lib/__tests__")
WIN = re.compile(r"\{0,(\d+)\}|\{(\d+),(\d+)\}")

def testi_ki_berejo(basename):
    out = []
    for t in sorted(TESTS.glob("*.test.ts")):
        src = t.read_text(encoding="utf-8")
        if f"/{basename}" in src:
            out.append((t.name, src))
    return out

def regexi_z_okni(src):
    # regex literali /…/ v testih (poenostavljeno: vrstica vsebuje /…{0,N}…/)
    found = []
    for i, line in enumerate(src.splitlines(), 1):
        if not WIN.search(line):
            continue
        for m in re.finditer(r"/((?:[^/\\\n]|\\.)+)/", line):
            pat = m.group(1)
            if WIN.search(pat):
                found.append((i, pat))
    return found

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "scan"
    delta, token = 0, None
    if mode == "delta":
        delta = int(sys.argv[2]); token = sys.argv[3]
    skupaj = zadeli = 0
    for target in TARGETS:
        base = pathlib.Path(target).name
        vsebina = pathlib.Path(target).read_text(encoding="utf-8")
        simulirano = vsebina.replace(token, token + " " * delta) if token else vsebina
        print(f"--- {base}: {len(testi_ki_berejo(base))} testnih datotek bere tarčo ---")
        for tname, tsrc in testi_ki_berejo(base):
            for ln, pat in regexi_z_okni(tsrc):
                skupaj += 1
                try:
                    rx = re.compile(pat)
                except re.error:
                    print(f"  {tname}:{ln} NAPAKA-REGEX (preskočen): /{pat[:60]}/")
                    continue
                pre = bool(rx.search(vsebina))
                post = bool(rx.search(simulirano))
                okna = WIN.findall(pat)
                if pre and not post:
                    print(f"  {tname}:{ln} ⚠️ OKNO PREOZKO ob +{delta} znakov: /{pat[:70]}/ okna={okna}")
                    zadeli += 1
                elif pre and post:
                    print(f"  {tname}:{ln} MATCH (okno preživi +{delta}) okna={okna}")
                else:
                    print(f"  {tname}:{ln} no-match na tarči (pin na drugi datoteki ali ankor?) okna={okna}")
    if mode == "delta" and zadeli:
        print(f"SKLEP: {zadeli} okenskih pinov PREOZKIH ob +{delta} — shift obvezan PRED vitest")
        sys.exit(1)
    print(f"SKUPAJ enumeriranih okenskih regexov: {skupaj}; preozkih ob delta: {zadeli}")

if __name__ == "__main__":
    main()
