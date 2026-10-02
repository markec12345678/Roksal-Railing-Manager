#!/usr/bin/env python3
# r381-val60-apply.py — R381 MANDATORY STIL val 60: NATIVNI PREHOD-PARITETNI
# ZAKLJUČEK (kanon R380 handover kandidat 1 (runda R381 po KOLIZIJI #22) — B/transition-colors družina,
# nativni <button> triaža po kanonu val 58).
#
# DISK RESNICA (r380-triaza.py, 170 vrstic obeh barvnih družin):
#   154 × <Button>  → transition-all IZ BAZE (ui/button.tsx L8) → N/A
#     3 × <button>  → NATIVNI GAP → val 58 kanon INS ' transition-colors'
#     8 × input/textarea/Input → FROZEN izjema #2 (kanon R377)
#     5 × DropdownMenuItem (top-bar 3 navy + 2 red) → base (ui/dropdown-menu.
#         tsx) NIMA transition → INS ' transition-colors'; navy itemi INORE
#         ' focus-visible:ring-offset-2' (val 52 pairing kanon — meni-notranja
#         pariteta z rdečima sestro, ki sta offset-2 od val 59)
#
# OPERACIJE (11 INS na 8 vrsticah, in-place, 0 novih vrstic):
#   audit-trail-dialog.tsx  ×1 INS ' transition-colors' PRED 'focus-visible:ring-2'
#   measurements-tab.tsx    ×1 INS ' transition-colors' PRED 'focus-visible:ring-2'
#   photo-tab.tsx           ×1 INS ' transition-colors' PRED 'focus-visible:ring-2'
#   top-bar.tsx navy ×3     INS ' transition-colors' PRED 'focus-visible:ring-2'
#                      IN   INS ' focus-visible:ring-offset-2' ZA navy/40
#   top-bar.tsx red ×2      INS ' transition-colors' PRED 'focus-visible:ring-2'
#
# NAČELA (fail-closed, kanon r377-val58-apply / r379-val59-apply):
#   - SCAN faza najprej: vsak ciljni podniz mora imeti TOČNO pričakovano
#     število pojavitev; odstopanje = ABORT PRED zapisom;
#   - APPLY faza: vstavitve na disku; po zapisu ponovna preverba (subn
#     == plan, stari podniz 0 na spremenjenih mestih);
#   - in-place dokaz: števec vrstic per datoteka bajtno enak;
#   - idempotenca: ponovni scan po apply najde 0 ciljev (že-parirani).
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"

TRANS = " transition-colors"
OFFSET = " focus-visible:ring-offset-2"

# (datoteka, staro, novo, pričakovano število)
PLAN = [
    # 3 nativni <button> (val 58 kanon: INS ' transition-colors' PRED ring-2)
    ("audit-trail-dialog.tsx",
     "hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40",
     "hover:text-roksal-ink focus-visible:outline-none" + TRANS + " focus-visible:ring-2 focus-visible:ring-roksal-navy/40",
     1),
    ("measurements-tab.tsx",
     "flex-1 text-left min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40",
     "flex-1 text-left min-w-0 focus-visible:outline-none" + TRANS + " focus-visible:ring-2 focus-visible:ring-roksal-navy/40",
     1),
    ("photo-tab.tsx",
     "hover:bg-muted hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-navy/40",
     "hover:bg-muted hover:text-roksal-ink" + TRANS + " focus-visible:ring-2 focus-visible:ring-roksal-navy/40",
     1),
    # top-bar navy DropdownMenuItem ×3 (transition + offset pariteta)
    ("top-bar.tsx",
     'className="gap-2 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"',
     'className="gap-2' + TRANS + " focus-visible:ring-2 focus-visible:ring-roksal-navy/40" + OFFSET + '"',
     3),
    # top-bar red DropdownMenuItem ×2 (samo transition — offset že od val 59)
    ("top-bar.tsx",
     'className="gap-2 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2"',
     'className="gap-2' + TRANS + " focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\"",
     2),
]


def main() -> None:
    # ---- SCAN faza ----
    napake = 0
    vrstice_pred = {}
    načrtovane = {}
    for ime, staro, novo, n in PLAN:
        f = ROKSAL / ime
        vsebina = f.read_text(encoding="utf-8")
        if ime not in vrstice_pred:
            vrstice_pred[ime] = len(vsebina.splitlines())
        dejansko = vsebina.count(staro)
        načrtovane[ime] = načrtovane.get(ime, 0) + dejansko
        if dejansko != n:
            print(f"SCAN FAILOVEDANO: {ime} podniz = {dejansko} (pričakovano {n}): {staro[:70]!r}")
            napake += 1
        else:
            print(f"SCAN OK: {ime} ×{n}: {staro[:60]!r} …")
    if napake:
        sys.exit(f"ABORT PRED zapisom: {napake} scan napak (fail-closed)")

    # ---- APPLY faza ----
    for ime, staro, novo, n in PLAN:
        f = ROKSAL / ime
        vsebina = f.read_text(encoding="utf-8")
        c = vsebina.count(staro)
        if c != n:
            sys.exit(f"APPLY FAILOVEDANO: {ime} count {c} ≠ {n} (med fazama spremenjeno?)")
        vsebina = vsebina.replace(staro, novo)
        f.write_text(vsebina, encoding="utf-8")
        print(f"APPLY OK: {ime} ×{n} INS")

    # ---- POST preverba ----
    napake = 0
    for ime, staro, novo, n in PLAN:
        f = ROKSAL / ime
        vsebina = f.read_text(encoding="utf-8")
        subn = vsebina.count(novo)
        ostarni = vsebina.count(staro)
        po_vrsticah = len(vsebina.splitlines())
        if subn < n:
            print(f"POST FAILOVEDANO: {ime} nov podniz {subn} < {n}")
            napake += 1
        if ostarni != 0:
            print(f"POST FAILOVEDANO: {ime} star podniz še {ostarni} (pričakovano 0)")
            napake += 1
        if po_vrsticah != vrstice_pred[ime]:
            print(f"POST FAILOVEDANO: {ime} vrstice {po_vrsticah} ≠ {vrstice_pred[ime]} (NOVA VRSTICA — kanon prekršen)")
            napake += 1
    if napake:
        sys.exit(f"POST: {napake} napak (fail-closed)")

    # ---- Idempotenca ----
    ostanki = 0
    for ime, staro, novo, n in PLAN:
        if (ROKSAL / ime).read_text(encoding="utf-8").count(staro):
            ostanki += 1
    print(f"IDEMPOTENCA: {ostanki} preostalih ciljev (pričakovano 0)")
    if ostanki:
        sys.exit(1)
    print("=== r381-val60-apply KONEC: 11 INS (8 transition-colors + 3 ring-offset-2) na 8 vrsticah, in-place, 0 novih vrstic ===")


if __name__ == "__main__":
    main()
