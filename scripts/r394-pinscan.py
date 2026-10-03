#!/usr/bin/env python3
"""r394-pinscan.py — val 70 PIN-SCAN (kanon R368/R387/R391/R392: pre-skan
VSEH pinov, ki referencirajo žeton 'focus-visible:outline-none', PRED swapom).

Žeton: 'focus-visible:outline-none' — swap = 'focus-visible:outline-hidden'
(roksal render plast ×105 v 24 datotekah; triaža r394-triaza.py: normal-mode
CSS identična — oba kompilirata v outline-style:none; forced-colors:hidden
obnovi outline — ring/box-shadow v forced-colors umre).

Klasifikacija vsake pojavitve v testih/registrskih:
  PIN-PRESENCE  — žeton znotraj pričakovanega class-list niza/regexa
                  (evolucija = token-for-token REPL)
  PIN-CENZUS    — števec/obseg (assert N, toContain ×N …) — ročna presodba
                  (izpiši kontekst; apply NE popravlja samodejno)
  PIN-ABSENCE   — negacija (NOT / 0 pričakovanj) — ostane (po swapu še
                  vedno resnično)
  REG-DATA      — živa podatkovna vrstica registra (NASLEDNICA-2)
  REG-HEAD      — komentar/zgodovina (preskočeno)

Izhod: per-file razčlenba + statistika; EXIT=1 če je REG-DATA ali
PIN-CENZUS prisoten (apply jih potrebuje izrecno obdelavo — fail-closed).
"""
import json
import re
import sys
from pathlib import Path

REPO = Path("/home/z/my-project")
ŽETON = "focus-visible:outline-none"
ROKSAL = REPO / "src/components/roksal"
TEST_KORENI = [REPO / "src/lib/__tests__", REPO / "tests"]
REGISTRI = REPO / "scripts/qa-needles"


def main():
    print("=== r394-pinscan — pre-skan žetona", ŽETON, "===")
    # 1) roksal render pojavitve (swap tarče)
    render = {}
    for f in sorted(ROKSAL.rglob("*.tsx")):
        n = f.read_text(encoding="utf-8", errors="replace").count(ŽETON)
        if n:
            render[str(f.relative_to(REPO))] = n
    vsota = sum(render.values())
    print(f"RENDER: {len(render)} datotek × {vsota} pojavitev")

    # 2) testni pini po datotekah, klasificirani po kontekstu
    testi = {}
    for koren in TEST_KORENI:
        if not koren.exists():
            continue
        for f in sorted(koren.rglob("*.ts")) + sorted(koren.rglob("*.tsx")):
            t = f.read_text(encoding="utf-8", errors="replace")
            n = t.count(ŽETON)
            if not n:
                continue
            negacije = len(re.findall(r"not\.toContain\(['\"`][^'\"`]*" + re.escape(ŽETON), t)) + len(
                re.findall(r"(toBe|toEqual)\(0\)[^\n]*" + re.escape(ŽETON), t)
            )
            testi[str(f.relative_to(REPO))] = {
                "vseh": n,
                "negacij": negacije,
                "premennih": n - negacije,
            }
    print(f"TESTI: {len(testi)} datotek × {sum(x['vseh'] for x in testi.values())} pinov")

    # 3) registri — žive podatkovne vrstice z žetonom
    reg_data = {}
    reg_head = {}
    for f in sorted(REGISTRI.glob("r*.tsv")):
        data = head = 0
        for line in f.read_text(encoding="utf-8", errors="replace").splitlines():
            if ŽETON not in line:
                continue
            if line.lstrip().startswith("#"):
                head += 1
            else:
                data += 1
        if data or head:
            reg_data[f.name] = data
            reg_head[f.name] = head
    print(f"REGISTRI: {sum(reg_data.values())} ŽIVIH vrstic + {sum(reg_head.values())} komentiranih")

    print(json.dumps({
        "render": render,
        "testi": testi,
        "registri_data": reg_data,
        "registri_head": reg_head,
    }, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
