#!/usr/bin/env python3
# r381-window-scan.py — R381 GENERALIZACIJA stale-pin PRED-SKANA (10.
# generalizacija QA orodij; naslednik r379-window-scan.py 8. generacije,
# ki ga NIKOLI ne mutira — kanon R358: hardening V NOVI skripti). Razlike
# proti r379 verziji:
#   1. TARGETS + 3 val 60 tarče (audit-trail-dialog, measurements-tab,
#      photo-tab — top-bar ŽE pokrit);
#   2. REG_DO = 380 (r380 register se v DEL 2 vključi SAMODEJNO, ko
#      nastane — manjkajoči registri so tolerantno preskočeni, zato je
#      skranljiv PRED in PO pisanju registra);
#   3. DEL 4 — NOVO: in-place varstvo (per-tarča števec vrstic disk
#      resnica — val 60 kanon zahteva 0 novih vrstic; odstopanje = glasno
#      FAILOVEDANO, primerjavo vodi zapis znotraj tega skripta).
# Trije deli iz r379 ostajajo ISTI (okna / needle pini / slice-okna).
#
# Uporaba: python3 scripts/r380-window-scan.py [scan | delta <znakova> <žeton>]
import re, pathlib, sys

TARGETS = [
    "src/components/roksal/audit-trail-dialog.tsx",
    "src/components/roksal/dashboard-tab.tsx",
    "src/components/roksal/floor-plan-tab.tsx",
    "src/components/roksal/inventory-tab.tsx",
    "src/components/roksal/measurements-tab.tsx",
    "src/components/roksal/photo-tab.tsx",
    "src/components/roksal/quote-followup.tsx",
    "src/components/roksal/roksal-catalog.tsx",
    "src/components/roksal/sessions-dialog.tsx",
    "src/components/roksal/termini-card.tsx",
    "src/components/roksal/top-bar.tsx",
]
# R381 val 60 in-place kanon: pričakovano število vrstic per tarča (disk
# resnica PRED rundi; DEL 4 preverja, da ostaja BAJTNATO enako).
PRIČAKOVANE_VRSTICE = {
    "audit-trail-dialog.tsx": 344,
    "dashboard-tab.tsx": 3188,
    "floor-plan-tab.tsx": 2901,
    "inventory-tab.tsx": 2299,
    "measurements-tab.tsx": 6232,
    "photo-tab.tsx": 2684,
    "quote-followup.tsx": 683,
    "roksal-catalog.tsx": 274,
    "sessions-dialog.tsx": 372,
    "termini-card.tsx": 539,
    "top-bar.tsx": 282,
}
TESTS = pathlib.Path("src/lib/__tests__")
REGISTRI = pathlib.Path("scripts/qa-needles")
REG_OD, REG_DO = 340, 381
WIN = re.compile(r"\{0,(\d+)\}|\{(\d+),(\d+)\}")


def testi_ki_berejo(basename):
    out = []
    for t in sorted(TESTS.glob("*.test.ts")):
        src = t.read_text(encoding="utf-8")
        if f"/{basename}" in src:
            out.append((t.name, src))
    return out


def regexi_z_okni(src):
    found = []
    for i, line in enumerate(src.splitlines(), 1):
        if not WIN.search(line):
            continue
        for m in re.finditer(r"/((?:[^/\\\n]|\\.)+)/", line):
            pat = m.group(1)
            if WIN.search(pat):
                found.append((i, pat))
    return found


def needleji_iz_registrov():
    """DEL 2 vir: (needle, runda) iz need_static vrst; komentarji/EVOLVED
    izključeni (čeprav EVOLVED vrstice so dobesedno KOMENTIRANE — # na
    začetku, zato naravno izpuščene; NASLEDNICA = nova need_static vrstica)."""
    out = []
    for r in range(REG_OD, REG_DO + 1):
        f = REGISTRI / f"r{r}.tsv"
        if not f.exists():
            continue
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#"):
                continue
            deli = line.split("\t")
            if len(deli) >= 3 and deli[2] == "need_static" and deli[0].strip():
                out.append((deli[0], r))
    return out


def src_vsebine():
    koren = pathlib.Path("src")
    return {str(p): p.read_text(encoding="utf-8", errors="replace") for p in sorted(koren.rglob("*.ts*"))}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "scan"
    delta, token = 0, None
    if mode == "delta":
        delta = int(sys.argv[2]); token = sys.argv[3]

    # ---- DEL 1: regex okna ----
    print("=== DEL 1: regex okenski kvantifikatorji (r373/r375 jedro) ===")
    skupaj = zadeli = 0
    for target in TARGETS:
        base = pathlib.Path(target).name
        vsebina = pathlib.Path(target).read_text(encoding="utf-8")
        simulirano = vsebina.replace(token, token + " " * delta) if token else vsebina
        bralci = testi_ki_berejo(base)
        print(f"--- {base}: {len(bralci)} testnih datotek bere tarčo ---")
        for tname, tsrc in bralci:
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
                    print(f"  {tname}:{ln} ⚠️ OKNO PREOZKO ob +{delta}: /{pat[:70]}/ okna={okna}")
                    zadeli += 1
                elif pre and post:
                    print(f"  {tname}:{ln} MATCH (okno preživi +{delta}) okna={okna}")
                else:
                    print(f"  {tname}:{ln} no-match na tarči (pin na drugi datoteki ali ankor?) okna={okna}")
    print(f"DEL 1 SKLEP: {skupaj} okenskih regexov; preozkih ob delta: {zadeli}")

    # ---- DEL 2: needle pini iz registrov ----
    print("=== DEL 2: FIXED-STRING needle pini iz registrov r%d–r%d (LEKCIJA R377 (4)) ===" % (REG_OD, REG_DO))
    needleji = needleji_iz_registrov()
    drevo = src_vsebine()
    mrtvi = 0
    for needle, runda in needleji:
        zivi = any(needle in v for v in drevo.values())
        if not zivi:
            mrtvi += 1
            print(f"  ⚠️ r{runda} needle MRTEL v src/ (evolucija? izbris?): {needle[:80]!r}")
    print(f"DEL 2 SKLEP: {len(needleji)} need_static needlejev iz registrov; mrtvih v src/: {mrtvi}")

    # ---- DEL 3: slice-okna detekcija ----
    print("=== DEL 3: slice-okna detekcija v bralcih tarč (LEKCIJA R375 (2)) ===")
    slic = 0
    for target in TARGETS:
        base = pathlib.Path(target).name
        for tname, tsrc in testi_ki_berejo(base):
            for i, line in enumerate(tsrc.splitlines(), 1):
                if ".slice(Math.max(0," in line:
                    slic += 1
                    print(f"  {tname}:{i} slice-okno nad {base}: {line.strip()[:90]}")
    print(f"DEL 3 SKLEP: {slic} slice-okenskih vzorcev (ročna razsoda razponov)")

    # ---- DEL 4 (R381 NOVO): in-place varstvo — vrstični števci ----
    print("=== DEL 4: in-place varstvo (val 60 kanon: 0 novih vrstic) ===")
    napake = 0
    for target in TARGETS:
        base = pathlib.Path(target).name
        dejansko = len(pathlib.Path(target).read_text(encoding="utf-8").splitlines())
        if base in PRIČAKOVANE_VRSTICE and dejansko != PRIČAKOVANE_VRSTICE[base]:
            print(f"  ⚠️ {base}: {dejansko} vrstic ≠ pričakovano {PRIČAKOVANE_VRSTICE[base]} (nova/izbrisana vrstica?)")
            napake += 1
    print(f"DEL 4 SKLEP: {napake} tarč z odstopajočim števcem vrstic")

    if mode == "delta" and (zadeli or mrtvi):
        print(f"SKLEP: {zadeli} preozkih okenskih pinov + {mrtvi} mrtvih needle pinov ob +{delta} — ukrepanje obvezno PRED vitest")
        sys.exit(1)
    if napake:
        print(f"SKLEP: in-place kanon PREKRŠEN na {napake} tarčah — ukrepanje obvezno")
        sys.exit(1)
    print("=== r381-window-scan KONEC (disk resnica, brez mutacij) ===")


if __name__ == "__main__":
    main()
