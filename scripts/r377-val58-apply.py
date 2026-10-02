#!/usr/bin/env python3
# r377-val58-apply.py — R377 MANDATORY STIL val 58: transition-colors
# SKLADNOST na edinem nativnem navy/40 fokus gumbu dashboard-tab.tsx BREZ
# transition žetona (NON-ring kandidat #1 iz R375 handoverja — disk
# resnica: nativni <button> 'Počisti iskanje projektov' L1628; KIT <Button>
# nosi transition-all iz ui/button baze, <Input> ima lastni INPUT fokus
# jezik [izjema #2] → edini gap = ta gumb; amber/red bordered ×2 = <span
# cursor-help> chipi — NE fokusabilni, border-pariteta N/A → iskreno
# izpuščeno, r375.tsv komentar ostaja resnica).
#
# TRANSFORMACIJA: 1 × INS ' transition-colors' PRED 'focus-visible:ring-2'
# (kanon measurements L4754/L4768: transition TIK PRED fokus nizom;
# +18 znakov, in-place 0 novih vrstic; 0 novih hex; aria/title ZAMRZNJENA;
# outline NI spremenjen — triaža val 57 '0 preurejanj' ostaja).
#
# FAIL-CLOSED (transformacijski dokument — LEKCIJA R373 (3)):
#   - tarča izpeljana IZ DISKA vsak tek (aria-label sidro + hoja nazaj do
#     className vrstice — nikoli hardcodirana vrstica; KOLIZIJA re-apply
#     kanon);
#   - sekvenca točno ×1 na tarčni vrstici; transition ŽE prisoten → abort;
#   - re-run po uspešnem applyu abortira na 'Ni tarč' (idempotenčna zaščita);
#   - po transformaciji: PO preverba polnega className, vrstice in-place,
#     delta = +18, transition-colors števec +1 (disk resnica PRED/PO).
import pathlib, sys

F = pathlib.Path("/home/z/my-project/src/components/roksal/dashboard-tab.tsx")
ARIA = 'aria-label="Počisti iskanje projektov"'
RING = "focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
NOVO = "transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"

src = F.read_text(encoding="utf-8")
vrstice = src.split("\n")

aria_i = [i for i, l in enumerate(vrstice) if ARIA in l]
if len(aria_i) != 1:
    sys.exit(f"FAILOVEDANO: aria sidro ×{len(aria_i)} ≠ ×1 — nič ne pišem")
tarca = None
for j in range(aria_i[0], max(-1, aria_i[0] - 8), -1):
    if "className" in vrstice[j] and "focus-visible:ring-roksal-navy/40" in vrstice[j]:
        tarca = j
        break
if tarca is None:
    sys.exit("FAILOVEDANO: className vrstica z navy/40 ringom ni najdena v 8 vrsticah nad sidrom — nič ne pišem")

l = vrstice[tarca]
if "transition-colors" in l:
    sys.exit(f"FAILOVEDANO: vrstica {tarca+1}: transition-colors ŽE prisoten (idempotenca) — nič ne pišem")
if l.count("focus-visible:ring-2") != 1:
    sys.exit(f"FAILOVEDANO: vrstica {tarca+1}: focus-visible:ring-2 ×{l.count('focus-visible:ring-2')} ≠ ×1")
if l.count(RING) != 1:
    sys.exit(f"FAILOVEDANO: vrstica {tarca+1}: ring sekvenca ×{l.count(RING)} ≠ ×1")

pred_tc = src.count("transition-colors")
vrstice[tarca] = l.replace(RING, "transition-colors " + RING, 1)
out = "\n".join(vrstice)

if ("transition-colors " + RING) not in vrstice[tarca]:
    sys.exit("FAILOVEDANO: PO preverba — nov className ni prisoten")
if len(vrstice) != len(src.split("\n")):
    sys.exit("FAILOVEDANO: število vrstic spremenjeno (in-place kršitev)")
delta = len(out) - len(src)
if delta != 18:
    sys.exit(f"FAILOVEDANO: delta {delta} ≠ 18")
po_tc = out.count("transition-colors")
if po_tc != pred_tc + 1:
    sys.exit(f"FAILOVEDANO: transition-colors števec {pred_tc}→{po_tc} ≠ +1")
# aria/title/hex nespremenjeni (INS ne doda nobenega)
for zeton in (ARIA, 'title="Izbriši', "focus-visible:ring-offset-2 rounded"):
    if out.count(zeton) != src.count(zeton):
        sys.exit(f"FAILOVEDANO: žeton '{zeton[:40]} …' spremenjen — INS to ne sme")
print(f"PO: 1 × INS ' transition-colors' na vrstici {tarca+1} · vrstice {len(vrstice)} (in-place) · delta +{delta} · transition-colors {pred_tc}→{po_tc} · aria/title zamrznjena")
F.write_text(out, encoding="utf-8")
print(f"OK: {F} zapisan")
