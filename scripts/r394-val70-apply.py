#!/usr/bin/env python3
"""r394-val70-apply.py — R394 STIL val 70: FORCED-COLORS FOKUS PARITETA
(105 × REPL in-place, 0 novih vrstic — roksal render plast ×24 datotek).

Disk resnica (r394-triaza.py element-točna + kompilirani CSS dokaz
.next/static/chunks/71255bde5e5a73d6.css):
  .focus-visible\\:outline-none:focus-visible { --tw-outline-style:none;
                                                outline-style:none }
  .focus-visible\\:outline-hidden:focus-visible { --tw-outline-style:none;
                                                outline-style:none }
  @media (forced-colors:active) { …outline-hidden:focus-visible {
        outline-offset:2px; outline:2px solid #0000 } }
→ normal-mode CSS IDENTIČNA (obe outline-style:none); razlika ŠELE v
forced-colors mode: ring/box-shadow NE preživi forced-colors, outline-hidden
obnovi 2px outline (WCAG 2.4.7 fokus indikator). Družinski precedens: viz
plast ×3 (viz-tab L125 + step-corners L402 + before-after L172) ŽE kanon.
Iskrene meje: ui-kit cva baze (shadcn jezik — FROZEN), goli outline-none na
vnosnih poljih (focus: paradigma — outline-hidden bi v forced-colors risal
stalni outline tudi brez fokusa), tabs.tsx Radix vsebina (upstream).

ATOMSKI KORAKI:
  1. RENDER swap  ×24 datotek (žeton-exact, 0 novih vrstic, per-file delta)
  2. TESTI  evolucija (51 pinov / 27 datotek) — token-for-token; vrstice
     z .toBe(0)/.toEqual(0) ZA žetonom = pričakovane NIČLE → ostanejo
  3. REGISTRI NASLEDNICA-2 (32 živih vrstic / 18 datotek): stara vrstica
     komentirana dobesedno (+ EVOLVED anotacija v 3. polju), naslednica z
     zamenjanim žetonom; need_static številci per-register NESPREMENJENI
  IDEMPOTENTEN: 2. tek = abort (0 žetonov v renderu = kontrakt nič).
"""
import re
import sys
from pathlib import Path

REPO = Path("/home/z/my-project")
ŽETON = "focus-visible:outline-none"
NOVO = "focus-visible:outline-hidden"
ROKSAL = REPO / "src/components/roksal"
TEST_KORENI = [REPO / "src/lib/__tests__", REPO / "tests"]
REGISTRI = REPO / "scripts/qa-needles"
NIČELNI = re.compile(r"\.to(?:Be|Equal)\(0\)")

PRIČAKOVANO = {  # iz r394-pinscan.py (disk resnica pred swapom)
    "audit-trail-dialog.tsx": 2, "bottom-nav.tsx": 2, "calculator-tab.tsx": 2,
    "cena-dobavitelji-panel.tsx": 2, "cena-zgodovina-panel.tsx": 2,
    "crm-tab.tsx": 1, "dashboard-tab.tsx": 2, "deal-pipeline.tsx": 2,
    "inclinometer-tab.tsx": 1, "inventory-tab.tsx": 14, "invoice-manager.tsx": 12,
    "material-intelligence-tab.tsx": 3, "measurements/steber-table.tsx": 1,
    "measurements-tab.tsx": 33, "notification-center.tsx": 5, "photo-tab.tsx": 9,
    "punch-list.tsx": 1, "quick-actions-fab.tsx": 2, "reference-gallery.tsx": 1,
    "sistem-zdravje-card.tsx": 2, "site-survey-tab.tsx": 1, "termini-card.tsx": 2,
    "top-bar.tsx": 1, "vodja-dashboard.tsx": 2,
}


def swap_render() -> int:
    print("=== 1) RENDER swap ===")
    vseh = 0
    for f in sorted(ROKSAL.rglob("*.tsx")):
        rel = str(f.relative_to(ROKSAL))
        t = f.read_text(encoding="utf-8")
        n = t.count(ŽETON)
        if n == 0:
            continue
        prič = PRIČAKOVANO.get(rel)
        if prič is None:
            sys.exit(f"FAILOVEDANO: {rel} nosi žeton ×{n}, NI v pričakovani mapi (pre-skan stale?)")
        if n != prič:
            sys.exit(f"FAILOVEDANO: {rel} = {n} ≠ pričakovano {prič} (pre-skan stale — pognaj r394-pinscan.py)")
        pre_vrstice = t.count("\n")
        t2 = t.replace(ŽETON, NOVO)
        if t2.count(NOVO) < n:
            sys.exit(f"FAILOVEDANO: {rel} post manjka žetonov")
        if t2.count(ŽETON) != 0:
            sys.exit(f"FAILOVEDANO: {rel} star žeton še živ")
        if t2.count("\n") != pre_vrstice:
            sys.exit(f"FAILOVEDANO: {rel} vrstice spremenjene (0 novih vrstic kanon)")
        f.write_text(t2, encoding="utf-8")
        vseh += n
        print(f"  {rel}: {n} × REPL")
    if vseh != sum(PRIČAKOVANO.values()):
        sys.exit(f"FAILOVEDANO: skupaj {vseh} ≠ 105")
    print(f"  SKUPAJ: {vseh} × REPL (kontrakt 105)")
    return vseh


def evolve_tests() -> tuple[int, int]:
    print("=== 2) TESTI evolucija ===")
    zamenjanih = ostalih = 0
    for koren in TEST_KORENI:
        if not koren.exists():
            continue
        for f in sorted(koren.rglob("*.ts")) + sorted(koren.rglob("*.tsx")):
            t = f.read_text(encoding="utf-8")
            if ŽETON not in t:
                continue
            vrstice = t.split("\n")
            nova, z_file, o_file = [], 0, 0
            for vrsta in vrstice:
                if ŽETON in vrsta:
                    rep = NIČELNI.search(vrsta[vrsta.index(ŽETON) + len(ŽETON):])
                    if rep:
                        nova.append(vrsta)
                        o_file += 1
                        continue
                    vrsta = vrsta.replace(ŽETON, NOVO)
                    z_file += 1
                nova.append(vrsta)
            f.write_text("\n".join(nova), encoding="utf-8")
            zamenjanih += z_file
            ostalih += o_file
            print(f"  {f.relative_to(REPO)}: {z_file} × swap, {o_file} × ničelni pin ostane")
    print(f"  SKUPAJ: {zamenjanih} × swap, {ostalih} × ničelni ostane")
    return zamenjanih, ostalih


def evolve_registers() -> int:
    print("=== 3) REGISTRI NASLEDNICA-2 ===")
    skupaj = 0
    for f in sorted(REGISTRI.glob("r*.tsv")):
        vrstice = f.read_text(encoding="utf-8").split("\n")
        če_živih = [i for i, v in enumerate(vrstice)
                    if ŽETON in v and not v.lstrip().startswith("#")]
        if not če_živih:
            continue
        nova = []
        for i, v in enumerate(vrstice):
            if i in če_živih:
                polja = v.split("\t")
                if len(polja) != 3:
                    sys.exit(f"FAILOVEDANO: {f.name}:{i+1} = {len(polja)} polj ≠ 3")
                needle, opis, third = polja
                nova.append(
                    f"# {needle}\t{opis}\tneed_static — EVOLVED R394 val 70: "
                    f"žeton '{ŽETON}' → '{NOVO}' (forced-colors fokus pariteta "
                    f"— ring/box-shadow NE preživi forced-colors mode, "
                    f"outline-hidden obnovi 2px outline; normal-mode CSS "
                    f"identiČna) — vrstica KOMENTIRANA (zgodovina dobesedno), "
                    f"naslednica = naslednja podatkovna vrstica".replace("identiČna", "identična")
                )
                nasl_needle = needle.replace(ŽETON, NOVO)
                nov_opis = (
                    f"R394 val 70 NASLEDNICA — žeton outline-none→outline-hidden "
                    f"(opis izvirnika: {opis})"
                )
                nova.append(f"{nasl_needle}\t{nov_opis}\tneed_static")
                skupaj += 1
            else:
                nova.append(v)
        f.write_text("\n".join(nova), encoding="utf-8")
        print(f"  {f.name}: {len(če_živih)} × NASLEDNICA-2")
    print(f"  SKUPAJ: {skupaj} naslednic")
    return skupaj


def main():
    render_že = sum(f.read_text(encoding="utf-8").count(NOVO)
                    for f in ROKSAL.rglob("*.tsx"))
    star_že = sum(f.read_text(encoding="utf-8").count(ŽETON)
                  for f in ROKSAL.rglob("*.tsx"))
    if star_že == 0 and render_že >= 105:
        sys.exit(
            f"FAILOVEDANO (idempotenca): val 70 že uporabljen "
            f"(render fv_hidden = {render_že}, fv_none = 0) — 2. tek abort"
        )
    if star_že != 105:
        sys.exit(f"FAILOVEDANO: render žeton = {star_že} ≠ 105 (pre-skan stale)")
    if render_že != 0:
        sys.exit(f"FAILOVEDANO: roksal ŽE nosi fv_hidden ×{render_že} ≠ 0 (čiščen pre-skan)")
    n1 = swap_render()
    n2, n3 = evolve_tests()
    n4 = evolve_registers()
    # POST global
    for f in ROKSAL.rglob("*.tsx"):
        if ŽETON in f.read_text(encoding="utf-8"):
            sys.exit(f"FAILOVEDANO POST: {f} še nosi star žeton")
    print(f"OK: val 70 uporabljen — render {n1}, testi {n2} swap + {n3} ničelnih, "
          f"registri {n4} naslednic")


if __name__ == "__main__":
    main()
