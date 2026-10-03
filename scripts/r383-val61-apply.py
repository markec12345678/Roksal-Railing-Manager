#!/usr/bin/env python3
# r382-val61-apply.py — R382 MANDATORY STIL val 61: A/OFFSET ZAKLJUČEK +
# C/BORDER-PARITETA ZAKLJUČEK (dvostopenjski sekvencirani apply; kanon
# R382 handover kandidat 1 + 2; LEKCIJA R381 (1): polna triaža PRED
# scopingom — r383-triaza.py disk resnica).
#
# DISK RESNICA (r383-triaza.py + val61 kontrakt):
#   STEP 1 — A/offset zaključek: 34 × INS ' focus-visible:ring-offset-2'
#     TIK ZA 'focus-visible:ring-roksal-navy/40' (val 52 pairing kanon)
#     na navy ring-2 vrsticah BREZ O2. FROZEN izjema #2 (kanon R377):
#     roksal-catalog.tsx L95 <Input> — besedilno polje, izključeno.
#   STEP 2 — C/border-pariteta zaključek: 134 × INS
#     ' focus-visible:border-roksal-navy/40' TIK ZA
#     'focus-visible:ring-offset-2' (val 57 kanon R375) na vrsticah z
#     VIDLJIVIM borderjem [eksplicitni border class ALI <Button
#     variant="outline"> — border iz baze ui/button.tsx]. Po STEP 1 imajo
#     vse tarče O2 = enoten sidro.
#   Skupaj: 168 INS, in-place, 0 novih vrstic.
#
# NAČELA (fail-closed, kanon r379/r381 apply):
#   - kontrakt: EMBEDED vrstične liste per datoteko (disk resnica te
#     triaže) — apply ponovno izpelje iste predikate in zahteva BAJTNATO
#     ujemanje list; KOLIZIJA premik vrstic = GLASEN abort;
#   - per-vrstica: točno 1 sidro (navy/40 oz. O2); več kot 1 = abort;
#   - POST: ponovna izpeljava → 0 tarč (zaključek) + in-place dokaz +
#     155/155 register needlejev še ŽIVIH v src (DEL-2 stil preverba).

# ==== EMBEDDED KONTRAKT (disk resnica R382 triaže) ====
S1_LINije = {'audit-trail-dialog.tsx': [219],
 'calculator-tab.tsx': [4396],
 'cena-dobavitelji-panel.tsx': [122, 133],
 'cena-zgodovina-panel.tsx': [165, 176],
 'dashboard-tab.tsx': [2360, 2696, 3015],
 'deal-pipeline.tsx': [219, 235, 602],
 'documents-tab.tsx': [452, 580],
 'floor-plan-tab.tsx': [1682, 1692, 1702],
 'inclinometer-tab.tsx': [444, 571],
 'moja-vloga-dialog.tsx': [121, 195],
 'photo-tab.tsx': [2172],
 'punch-list.tsx': [736],
 'reference-gallery.tsx': [1534],
 'roksal-catalog.tsx': [110],
 'sessions-dialog.tsx': [261, 363],
 'sistem-zdravje-card.tsx': [204],
 'site-survey-tab.tsx': [535],
 'team-tab.tsx': [497, 515, 523, 916, 926]}
S2_LINije = {'audit-trail-dialog.tsx': [219, 249],
 'bottom-nav.tsx': [186],
 'cena-dobavitelji-panel.tsx': [122, 133],
 'cena-zgodovina-panel.tsx': [165, 176],
 'crm-tab.tsx': [942, 959, 977, 995, 1013, 1031, 1049, 1088, 1289, 1390],
 'dashboard-tab.tsx': [1830, 2360, 2696, 3015],
 'deal-pipeline.tsx': [646],
 'documents-tab.tsx': [580],
 'floor-plan-tab.tsx': [1682, 1692, 1702],
 'inclinometer-tab.tsx': [341, 571],
 'inventory-tab.tsx': [1397,
                       1428,
                       1461,
                       1500,
                       1511,
                       1525,
                       1541,
                       1562,
                       1583,
                       1944,
                       2016,
                       2121,
                       2191,
                       2252,
                       2262,
                       2272],
 'invoice-manager.tsx': [1045, 1061, 1182, 1328, 1386, 1402, 1409, 1421],
 'logistics-tab.tsx': [1302,
                       1987,
                       2008,
                       2027,
                       2059,
                       2091,
                       2112,
                       2136,
                       2160,
                       2185,
                       2210,
                       2232,
                       2255,
                       2283,
                       2389,
                       2398,
                       2417,
                       2421,
                       2431,
                       2518,
                       2534,
                       2720,
                       2744,
                       2815,
                       2873,
                       2896,
                       3233],
 'material-intelligence-tab.tsx': [456,
                                   1549,
                                   1561,
                                   1579,
                                   1680,
                                   1764,
                                   1779,
                                   1795,
                                   1808,
                                   1813,
                                   1818,
                                   1826,
                                   1915,
                                   1927,
                                   2041,
                                   2053,
                                   2072,
                                   2084,
                                   2124,
                                   2198,
                                   2275,
                                   2340],
 'measurements-tab.tsx': [4147, 4539, 4635, 5880, 5915],
 'moja-vloga-dialog.tsx': [121, 195],
 'notification-center.tsx': [881],
 'punch-list.tsx': [531, 637, 736],
 'quick-actions-fab.tsx': [92],
 'quote-followup.tsx': [423, 453, 471, 514, 603, 614],
 'reference-gallery.tsx': [1534],
 'safety-tab.tsx': [287],
 'sessions-dialog.tsx': [261, 363],
 'sistem-zdravje-card.tsx': [204],
 'site-survey-tab.tsx': [535],
 'team-tab.tsx': [497, 515, 573, 916, 926],
 'vodja-dashboard.tsx': [1174, 1274, 1290, 1306]}

# ==== KONEC KONTRAKTA ====

import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"
NAVY = "focus-visible:ring-roksal-navy/40"
RING2 = "focus-visible:ring-2"
O2 = "focus-visible:ring-offset-2"
BORDER_INS = " focus-visible:border-roksal-navy/40"
O2_INS = " focus-visible:ring-offset-2"
TAG_PAT = re.compile(r"<([A-Za-z][A-Za-z0-9.]*)")
BORDER_PAT = re.compile(r"(?<![\w-])(border(?:-[a-zA-Z0-9./\[\]%-]+)?)(?![\w-])")
FROZEN = {("roksal-catalog.tsx", 95)}


def klas(v, i):
    for j in range(i, max(-1, i - 40), -1):
        mm = TAG_PAT.search(v[j])
        if mm:
            return mm.group(1), v[j]
    return "?", ""


def izpeljaj():
    s1 = {}
    s2 = {}
    vrstice_pred = {}
    for f in sorted(ROKSAL.glob("*.tsx")):
        lines = f.read_text(encoding="utf-8").splitlines()
        vrstice_pred[f.name] = len(lines)
        for i, line in enumerate(lines):
            if RING2 not in line or NAVY not in line:
                continue
            tag, tagline = klas(lines, i)
            has_b = any(t == "border" or (t.startswith("border-") and "focus-visible" not in t) for t in BORDER_PAT.findall(line))
            has_o = 'variant="outline"' in tagline and tag == "Button"
            if not has_o and tag == "Button":
                for j in range(i, max(-1, i - 6), -1):
                    if 'variant="outline"' in lines[j]:
                        has_o = True
                        break
            bordered = has_b or has_o
            frozen = (f.name, i + 1) in FROZEN
            if O2 not in line and not frozen:
                s1.setdefault(f.name, []).append(i + 1)
            if bordered and "focus-visible:border" not in line and not frozen:
                s2.setdefault(f.name, []).append(i + 1)
    return {k: v for k, v in s1.items() if v}, {k: v for k, v in s2.items() if v}, vrstice_pred


def main() -> None:
    # SCAN: izpeljava mora bajtno ujemati kontrakt
    s1, s2, vrstice_pred = izpeljaj()
    if {k: sorted(v) for k, v in s1.items()} != {k: sorted(v) for k, v in S1_LINije.items()}:
        sys.exit(f"ABORT: STEP 1 izpeljana lista ≠ kontrakt\nizpeljano={s1}\nkontrakt={S1_LINije}")
    if {k: sorted(v) for k, v in s2.items()} != {k: sorted(v) for k, v in S2_LINije.items()}:
        sys.exit(f"ABORT: STEP 2 izpeljana lista ≠ kontrakt\nizpeljano={s2}\nkontrakt={S2_LINije}")
    n1 = sum(len(v) for v in s1.values())
    n2 = sum(len(v) for v in s2.values())
    print(f"SCAN OK: STEP1={n1} (pričakovano 34), STEP2={n2} (pričakovano 134)")

    # APPLY STEP 1 — per vrstica: INS O2 TIK ZA navy/40
    for ime, linije in S1_LINije.items():
        f = ROKSAL / ime
        lines = f.read_text(encoding="utf-8").split("\n")
        for ln in linije:
            v = lines[ln - 1]
            c = v.count(NAVY)
            if c != 1:
                sys.exit(f"ABORT STEP1: {ime}:L{ln} navy/40 ×{c} ≠ 1")
            if O2 in v:
                sys.exit(f"ABORT STEP1: {ime}:L{ln} že ima O2 (ne-konsistentno s triažo)")
            lines[ln - 1] = v.replace(NAVY, NAVY + O2_INS, 1)
        f.write_text("\n".join(lines), encoding="utf-8")
    print("APPLY STEP1 OK: 34 × INS ring-offset-2")

    # APPLY STEP 2 — per vrstica: INS border-pariteta TIK ZA O2
    for ime, linije in S2_LINije.items():
        f = ROKSAL / ime
        lines = f.read_text(encoding="utf-8").split("\n")
        for ln in linije:
            v = lines[ln - 1]
            c = v.count(O2)
            if c != 1:
                sys.exit(f"ABORT STEP2: {ime}:L{ln} O2 ×{c} ≠ 1")
            lines[ln - 1] = v.replace(O2, O2 + BORDER_INS, 1)
        f.write_text("\n".join(lines), encoding="utf-8")
    print("APPLY STEP2 OK: 134 × INS border-pariteta")

    # POST: zaključek + in-place + needle survival
    s1b, s2b, vrstice_post = izpeljaj()
    if s1b or s2b:
        sys.exit(f"POST FAILOVEDANO: ostanek tarč s1={s1b} s2={s2b} (zaključek ni čist)")
    for ime, n in vrstice_pred.items():
        dejansko = len((ROKSAL / ime).read_text(encoding="utf-8").splitlines())
        if dejansko != n:
            sys.exit(f"POST FAILOVEDANO: {ime} vrstice {dejansko} ≠ {n} (nova vrstica)")
    # 155/155 needle survival (DEL 2 stil)
    registri = sorted((REPO / "scripts/qa-needles").glob("r3*.tsv"))
    drevo = {str(p): p.read_text(encoding="utf-8", errors="replace") for p in sorted((REPO / "src").rglob("*.ts*"))}
    mrtvi = 0
    skupaj = 0
    for reg in registri:
        for line in reg.read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#"):
                continue
            deli = line.split("\t")
            if len(deli) >= 3 and deli[2] == "need_static" and deli[0].strip():
                skupaj += 1
                if not any(deli[0] in v for v in drevo.values()):
                    mrtvi += 1
                    print(f"  ⚠️ needle MRTEL: {deli[0][:70]!r}")
    if mrtvi:
        sys.exit(f"POST FAILOVEDANO: {mrtvi} register needlejev mrtev — REGISTER EVOLUCIJA obvezna")
    print(f"POST OK: zaključek čist, in-place dokaz, {skupaj - mrtvi}/{skupaj} needlejev ŽIVIH")
    print("=== r383-val61-apply KONEC: 168 INS (34 O2 + 134 border), in-place, 0 novih vrstic ===")


if __name__ == "__main__":
    main()
