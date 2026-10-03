#!/usr/bin/env python3
# r391-pinscan.py — R391 val 68 PIN-SHIFT pre-skan (kanon R368/R387/R389):
# ujemi VSE zamrznjene needleje (qa-needles/*.tsv podatkovne vrstice + ALL
# scripts/*.sh needle spise + src testi), ki vsebujejo žeton 'press-scale' IN
# so (pod)span ENEGA izmed 10 dual elementov (val 68 tarče) — ti needleji
# bi ob odstranitvi press-scale tokena postali MRTVI (bajtna pogodba!).
# Needleji, ki vsebujejo press-scale ampak NISO podspan dual elementa,
# ostanejo ŽIVI (njihovi viri se ne spreminjajo) — izpisani kot kontrola.
import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROK = REPO / "src/components/roksal"

# 1) zgradi resnico dual elementov iz r391-triaza.py logike (isti parser)
sys.path.insert(0, str(REPO / "scripts"))

RE_SPAN = re.compile(r"className=(\{`|`|\"|')", re.M)

def span_konec(text, po, odprt):
    zakljuc = "`" if odprt in ("{`", "`") else odprt
    i = po
    while i < len(text):
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == zakljuc:
            return i + 1
        i += 1
    return len(text)

dual_spans = []  # (file, vrstica, span_koda_brez_komentarjev)
for f in sorted(ROK.glob("*.tsx")):
    text = f.read_text(encoding="utf-8")
    for m in RE_SPAN.finditer(text):
        end = span_konec(text, m.end(), m.group(1))
        span = text[m.start():end]
        if "press-scale" not in span:
            continue
        if not re.search(r"active:scale-\[?[0-9.]+\]?", span):
            continue
        kodni = re.sub(r"/\*.*?\*/", "", span, flags=re.S)
        if "press-scale" not in kodni:
            continue
        # normalizacija za subspan test: odstrani className= prefix + zamiki
        vrednost = kodni.split("=", 1)[1].strip()
        if vrednost.startswith("{`"):
            vrednost = vrednost[2:]
        elif vrednost[0] in "\"'`":
            vrednost = vrednost[1:]
        if vrednost.endswith("}`"):
            vrednost = vrednost[:-2]
        elif vrednost[-1] in "\"'`":
            vrednost = vrednost[:-1]
        vrednost = re.sub(r"\$\{[^{}]*\}", " ", vrednost)  # template izrazi → presledek
        vrednost = re.sub(r"\s+", " ", vrednost).strip()
        dual_spans.append((f.name, text.count("\n", 0, m.start()) + 1, vrednost))

print(f"dual elementov: {len(dual_spans)}")
for f, v, _ in dual_spans:
    print(f"  {f}:{v}")

# 2) preveri vsak need_static needle iz registrov + vsak 'needle' v scripts/*.sh
needleji = []
for tsv in sorted((REPO / "scripts/qa-needles").glob("r*.tsv")):
    for i, line in enumerate(tsv.read_text(encoding="utf-8").splitlines(), 1):
        if line.startswith("#") or not line.strip():
            continue
        deli = line.split("\t")
        if len(deli) >= 1 and deli[0].strip():
            needleji.append((f"{tsv.name}:{i}", deli[0]))

for sh in sorted((REPO / "scripts").glob("*.sh")):
    text = sh.read_text(encoding="utf-8")
    # needle spisi: enojni narekovaji v NEEDLES=( … ) ali par='…' vrsticah —
    # poenostavljeno: vse '[A-Z0-9 čšž…-]{12,}' literale v navednicah, ki
    # vsebujejo press-scale (samo ti so ogroženi)
    for m in re.finditer(r"'([^']*)'", text):
        if "press-scale" in m.group(1) and len(m.group(1)) >= 20:
            needleji.append((f"{sh.name}:{text.count(chr(10), 0, m.start()) + 1}", m.group(1)))

ogrozeni = []
kontrola = 0
for loc, needle in needleji:
    if "press-scale" not in needle:
        continue
    norm = re.sub(r"\s+", " ", needle).strip()
    # subspan dual elementa? (needle je PODSPAN spana → živel SAMO na dualu)
    sub_dual = any(norm in span or span in norm for _, _, span in dual_spans)
    # dodatno: ali needle ŽIVO kje drugje v src (ne-dual element z istim spanom)?
    drugje = False
    if not sub_dual:
        for f in sorted(ROK.glob("*.tsx")):
            t = re.sub(r"\s+", " ", f.read_text(encoding="utf-8"))
            if norm in t:
                drugje = True
                break
    if sub_dual and not drugje:
        ogrozeni.append((loc, norm[:90]))
    elif sub_dual and drugje:
        print(f"  AMBIGVEN (dual + drug vir): {loc}: {norm[:70]}")
    else:
        kontrola += 1

print(f"\nogroženih needlejev (življenje = SAMO dual element): {len(ogrozeni)}")
for loc, n in ogrozeni:
    print(f"  {loc}: {n}…")
print(f"kontrola (press-scale needlejev na ne-dual elementih — ŽIVI): {kontrola}")
