#!/usr/bin/env python3
# r377-register-write.py — R377 register scripts/qa-needles/r377.tsv
# (kanon: python write z \t — LEKCIJA R365; NF=3 validacija po zapisu).
# 1 need_static = val 58 NOVI className token (transition-colors SKLADNOST
# na edinem nativnem navy/40 fokus gumbu dashboard-tab 'Počisti iskanje
# projektov' L1628: 1 × INS ' transition-colors' PRED focus nizom — kanon
# measurements L4754/L4768 precedens), ×0 v HEAD pred rundo (fetch-first
# git grep -F na f224272 components — GLASNO potrjeno); multiplicita v
# POJAVITVAH (grep -o, LEKCIJA R365 (2)): N1 ×1 per-datoteka.
# Izpuščeni kandidati (iskreno dokumentirano, kanon r366–r375):
#  - amber/red bordered ×2 (measurements L5326/L5355) = <span cursor-help>
#    chipi — NE fokusabilni, border-pariteta N/A → iskreno izpuščeno
#    (r375.tsv izjema ostaja disk resnica — ni tiho);
#  - KIT <Button> vrstice brez transition žetona na vrstici (dashboard
#    L2360/L2696/L3015 + L1678) — transition-all pride iz ui/button baze
#    (dokaz: test r377-stil-val58 it 3) → NI gap;
#  - <Input> L1623 — INPUT fokus jezik (izjema #2, zamrznjen);
#  - outline triaža '0 preurejanj' (val 57 kanon) — NE dotikamo se.
# must_miss: TODO-R377.
import pathlib, subprocess, sys

rows = [
    ("absolute right-3 top-1/2 -translate-y-1/2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 rounded",
     "R377 val 58 dashboard L1628 pocisti-iskanje transition-colors tik pred fokus nizom (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("TODO-R377",
     "must_miss: razvojni ostanki (nesme biti v produkcijskih cankih)",
     "must_miss"),
]

HEAD = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
print(f"HEAD = {HEAD}")
if HEAD != "6176878":
    print("OPOZORILO: HEAD ni 6176878 (njihov R376 BOM push) — preverba gre VSEENO na 6176878 resolving")

BASE = subprocess.run(["git", "rev-parse", "6176878"], capture_output=True, text=True).stdout.strip()
if not BASE:
    sys.exit("FAILOVEDANO: 6176878 ni resolvljiv — kdo je premaknil zgodovino?")
for needle, opis, vrsta in rows:
    if vrsta != "need_static":
        continue
    r = subprocess.run(
        ["git", "grep", "-F", "--", needle, BASE, "--", "src/components"],
        capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip():
        sys.exit(f"FAILOVEDANO: needle ŽE v HEAD {BASE[:7]}: {needle[:70]} …")
    print(f"OK ×0 v 6176878: {needle[:70]} …")

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r377.tsv")
if REG.exists():
    sys.exit(f"FAILOVEDANO: register ŽE obstaja: {REG}")
with REG.open("w", encoding="utf-8") as f:
    f.write("# qa-needles/r377.tsv — REGISTER needlejev runde R377 (STIL val 58:\n")
    f.write("# transition-colors SKLADNOST — NON-ring kandidat #1 iz R375\n")
    f.write("# handoverja: 1 × INS ' transition-colors' PRED\n")
    f.write("# 'focus-visible:ring-2' na edinem nativnem navy/40 gumbu\n")
    f.write("# dashboard-tab 'Počisti iskanje projektov' L1628 (kanon\n")
    f.write("# measurements L4754/L4768 precedens; +18 znakov, in-place 0 novih\n")
    f.write("# vrstic; KIT <Button> nosi transition-all iz baze, <Input> ima\n")
    f.write("# lastni fokus jezik [izjema #2], amber/red ×2 = spani N/A — VSE\n")
    f.write("# dokumentirane izjeme BREZ sprememb). Orodja: era-clone.py --server-probe\n")
    f.write("# [6. generalizacija: labeli regex vidi poslovne runde + SERVER-NEEDLE\n")
    f.write("# razširitev — needle v .next/server + determinističen vedenjski probe\n")
    f.write("# lastniške rute na produ 401] → r377-era-harvest.sh TRIDESETIJNA [30 registrov] + r376-era-harvest.sh DEVETINDVJSETIJNA\n")
    f.write("# [29 registrov r347–r375, ≥121 = 117 + 4, vsota iz diska]: EXIT=0 ob\n")
    f.write("# 1. teku — 114 direktno + 7 rezolucij ŽIVO [3 hash starejši navy +\n")
    f.write("# 3 hash r374 client + 1 SERVER r374 price-book: .next/server/chunks/\n")
    f.write("# _8b39314d._.js + prod /api/price-book HTTP 401 fail-closed] — PRVI\n")
    f.write("# EXIT=0 od mešanega r374 registra [r375-era-harvest je bil EXIT=2];\n")
    f.write("# val 57 vsi 4 needleji ŽIVO DIREKTNO [chunk_026 ×4] → val 57 deploy\n")
    f.write("# potrjen v celoti; must_miss ×29 čisto. val 57 POST-deploy spot\n")
    f.write("# (r377-qa-spot.sh spot-r167/21; mounted + className LOČENO,\n")
    f.write("# dispatch+poll VSAKA): N2 predloga MONTIRANA 5, border-pariteta 5/5\n")
    f.write("# ŽIVO DOM dokaz; N1/N3/N4 iskreno NEmontirane [vrata: meritve/\n")
    f.write("# segmenti projekta — demo 'Ni projektov' testid\n")
    f.write("# meritve-brez-projektov, kanon r277]; navy sonda 27/27 BrezOffset=0;\n")
    f.write("# kolektor 0 errorjev. prod-qa re-run 375: ZELEN ob poskusu 1 (14.\n")
    f.write("# runda zapored). KOLIZIJA #18: NI (fetch-first origin/main == HEAD\n")
    f.write("# f224272). \n")
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")

# NF=3 validacija (LEKCIJA R365)
slabih = 0
for i, line in enumerate(REG.read_text(encoding="utf-8").splitlines(), 1):
    if line.startswith("#") or not line.strip():
        continue
    nf = len(line.split("\t"))
    if nf != 3:
        print(f"FAILOVEDANO: vrstica {i}: NF={nf} ≠ 3")
        slabih += 1
if slabih:
    sys.exit("FAILOVEDANO: register nima vseh vrstic NF=3")

# multiplicita v delovnem drevesu (grep -o per datoteka — disk resnica)
needle0 = rows[0][0]
r = subprocess.run(["grep", "-roF", "--", needle0, "src/components/"],
                   capture_output=True, text=True)
pojitve = {}
for line in r.stdout.splitlines():
    dat = line.split(":", 1)[0]
    pojitve[dat] = pojitve.get(dat, 0) + 1
print(f"multiplicita v delovnem drevesu: {pojitve}")
if pojitve != {"src/components/roksal/dashboard-tab.tsx": 1}:
    sys.exit(f"FAILOVEDANO: pričakovano natančno ×1 v dashboard-tab.tsx, disk pravi {pojitve}")
print(f"OK: {REG} zapisan (1 need_static + 1 must_miss)")
