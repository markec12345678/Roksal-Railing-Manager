#!/usr/bin/env python3
# r390-val68-apply.py — R390 STIL val 68: PRESS-SCALE DVOJNI MEHANIZEM
# RESOLUCIJA (10 × REPL in-place, 0 novih vrstic) + EVOLVED ×5 testov +
# register r363.tsv NASLEDNICA-3 — VSE V ENEM atomskem koraku (kanon R368).
#
# Disk resnica (r390-triaza.py + zgrajeni CSS):
#   - .press-scale:active { transform: scale(.97) }   → LASTNOST `transform`
#   - .active\:scale-\[0\.96\]:active { scale: .96 }  → LASTNOST `scale`
#   Element z OBEIMA: :active → 0.97 × 0.96 = 0.9312 MNOŽIČEN dvojni skrček.
#   Val 68: odstrani `press-scale` žeton z 10 dual elementov (ostane
#   element-specifičen active:scale-[0.96]; cva baza Button nosi
#   transition-all → pretok ohranjen ×10).
#
# IDEMPOTENCA (LEKCIJA R390, 2. tek): vsak korak prepozna ŽE uporabljeno
# stanje (span brez press-scale = že popravljen; test z žigom = že evoluiran;
# r363 L21 komentirana = že evoluirana) in ga preskoči — končno stanje je
# VEDNO enako. Multi-target datoteke (dashboard ×2, measurements ×3) se
# urejajo v ENEM in-memory pomiku (popravljen path + akumulacijski bug
# 1. teka: junk v korenu repozitorija + izgubljeni bratski uredi).
import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROK = REPO / "src/components/roksal"
RE_SPAN = re.compile(r"className=(\{`|`|\"|')", re.M)
ZIG = "[EVOLVED R390 val 68"

def span_konec(text, po, od):
    z = "`" if od in ("{`", "`") else od
    i = po
    while i < len(text):
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == z:
            return i + 1
        i += 1
    return len(text)

TARGETS = [  # (file, line)
    ("calculator-tab.tsx", 820),
    ("dashboard-tab.tsx", 2426),
    ("dashboard-tab.tsx", 2435),
    ("inclinometer-tab.tsx", 341),
    ("inventory-tab.tsx", 1562),
    ("measurements-tab.tsx", 3496),
    ("measurements-tab.tsx", 5211),
    ("measurements-tab.tsx", 5234),
    ("measurements-tab.tsx", 5258),
    ("punch-list.tsx", 531),
]

def dual_locaj():
    duals = []
    for f in sorted(ROK.glob("*.tsx")):
        t = f.read_text(encoding="utf-8")
        for m in RE_SPAN.finditer(t):
            e = span_konec(t, m.end(), m.group(1))
            s = t[m.start():e]
            if "press-scale" not in s:
                continue
            if not re.search(r"active:scale-\[?[0-9.]+\]?", s):
                continue
            kodni = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
            if "press-scale" not in kodni:
                continue
            duals.append((f.name, t.count("\n", 0, m.start()) + 1))
    return duals

def rep_vrstica(content, staro, novo, lok, ze_ok=None):
    """Zamenjaj staro→novo (count==1). Če je že novo prisotno = preskoči."""
    c = content.count(staro)
    if c == 1:
        return content.replace(staro, novo, 1)
    if c == 0 and ze_ok and ze_ok in content:
        print(f"  preskočeno (že evoluirano): {lok}")
        return content
    sys.exit(f"FAILOVEDANO ({lok}): kontrakt = {c} (pričakovano 1)")

def main():
    pre_dual = dual_locaj()
    if len(pre_dual) > 10:
        sys.exit(f"FAILOVEDANO: dual prej = {len(pre_dual)} (> 10 — neznan disk stanje)")
    # delna stanja (0–10) so podprta: idempotentni koraki preskočijo že
    # uporabljene spine (LEKCIJA R390, 2./3. tek po path-bug popravku)
    pre_vrstice = {f.name: f.read_text(encoding="utf-8").count("\n") for f in ROK.glob("*.tsx")}

    post = {}  # abs rel pot → vsebina

    # 1) SOURCE: grupirano per file (akumulacija vseh bratov v enem pomiku)
    per_file = {}
    for fn, vr in TARGETS:
        per_file.setdefault(fn, []).append(vr)
    for fn, vrs in per_file.items():
        p = ROK / fn
        t = p.read_text(encoding="utf-8")
        for vr in vrs:
            urejeno = False
            for m in RE_SPAN.finditer(t):
                e = span_konec(t, m.end(), m.group(1))
                s = t[m.start():e]
                if t.count("\n", 0, m.start()) + 1 != vr:
                    continue
                if " press-scale" in s:
                    nov_span = s.replace(" press-scale", "", 1)
                    if "press-scale" in nov_span:
                        sys.exit(f"FAILOVEDANO: {fn}:{vr} — več žetonov v spanu")
                    if "active:scale-[0.96]" not in nov_span:
                        sys.exit(f"FAILOVEDANO: {fn}:{vr} — active:scale-[0.96] izgubljen")
                    t = t[:m.start()] + nov_span + t[e:]
                    urejeno = True
                    break
                elif re.search(r"active:scale-\[?0\.96\]?", s) and "press-scale" not in s:
                    print(f"  preskočeno (že popravljeno): {fn}:{vr}")
                    urejeno = True
                    break
            if not urejeno:
                sys.exit(f"FAILOVEDANO: {fn}:{vr} — dual span NI najden (kontrakt bajtno ne velja)")
        post[f"src/components/roksal/{fn}"] = t

    # 2) EVOLVED ×5 testov (žig [EVOLVED R390 val 68])
    TS = REPO / "src/lib/__tests__"

    p = TS / "r204-narocilnica-strazar.test.ts"
    t = p.read_text(encoding="utf-8")
    t = rep_vrstica(
        t,
        "    expect(okno).toContain('h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale')\n",
        "    expect(okno).toContain('h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums') // [EVOLVED R390 val 68: press-scale žeton odstranjen z dual elementa — množičen skrček transform×scale]\n",
        "r204:90", ZIG,
    )
    post["src/lib/__tests__/r204-narocilnica-strazar.test.ts"] = t

    p = TS / "r363-stil-val46.test.ts"
    t = p.read_text(encoding="utf-8")
    t = rep_vrstica(
        t,
        "    expect(INV.match(/h-8 shrink-0 gap-1\\.5 text-\\[11px\\] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy\\/40 focus-visible:ring-offset-2( focus-visible:border-roksal-navy\\/40)?( dark:focus-visible:border-roksal-ink\\/40)? active:scale-\\[0\\.96\\]/g) ?? []).toHaveLength(1)\n",
        "    expect(INV.match(/h-8 shrink-0 gap-1\\.5 text-\\[11px\\] font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy\\/40 focus-visible:ring-offset-2( focus-visible:border-roksal-navy\\/40)?( dark:focus-visible:border-roksal-ink\\/40)? active:scale-\\[0\\.96\\]/g) ?? []).toHaveLength(1) // [EVOLVED R390 val 68: press-scale odstranjen]\n",
        "r363:43", ZIG,
    )
    post["src/lib/__tests__/r363-stil-val46.test.ts"] = t

    p = TS / "r269-meritve-teren-pdf.test.ts"
    t = p.read_text(encoding="utf-8")
    t = rep_vrstica(
        t,
        "+ disabled={pdfVteku} dvoklik guard + press-scale + FileDown aria-hidden",
        "+ disabled={pdfVteku} dvoklik guard + FileDown aria-hidden",
        "r269:281 opis", "+ disabled={pdfVteku} dvoklik guard + FileDown aria-hidden",
    )
    t = rep_vrstica(
        t,
        "    expect(komponenta).toContain('press-scale active:scale-[0.96] hover:text-roksal-ink')\n",
        "    // [EVOLVED R390 val 68: press-scale odstranjen — utility scale ostane]\n    expect(komponenta).toContain('active:scale-[0.96] hover:text-roksal-ink')\n",
        "r269:292", ZIG,
    )
    post["src/lib/__tests__/r269-meritve-teren-pdf.test.ts"] = t

    p = TS / "r271-punch-stanje-pdf.test.ts"
    t = p.read_text(encoding="utf-8")
    t = rep_vrstica(
        t,
        "  it('pill ŽIVO: aria + press-scale + disabled={stanjeVteku} + guard + Loader2/FileDown aria-hidden + VEDNO viden pri projektu (NI gated na items.length)', () => {",
        "  it('pill ŽIVO: aria + active:scale + disabled={stanjeVteku} + guard + Loader2/FileDown aria-hidden + VEDNO viden pri projektu (NI gated na items.length)', () => {",
        "r271:303 opis", "  it('pill ŽIVO: aria + active:scale + disabled={stanjeVteku}",
    )
    t = rep_vrstica(
        t,
        "    expect(pill).toContain('press-scale')\n",
        "    expect(pill).toContain('active:scale-[0.96]') // [EVOLVED R390 val 68: dual mehanizem razrešen — utility scale ostane]\n",
        "r271:308", ZIG,
    )
    post["src/lib/__tests__/r271-punch-stanje-pdf.test.ts"] = t

    p = TS / "r272-nagibi-teren-pdf.test.ts"
    t = p.read_text(encoding="utf-8")
    t = rep_vrstica(
        t,
        "  it('pill ŽIVO: aria + press-scale + disabled={pdfNagibiVteku} + guard + Loader2/FileDown aria-hidden + VEDNO viden pri projektu (NI gated na saved.length)', () => {",
        "  it('pill ŽIVO: aria + active:scale + disabled={pdfNagibiVteku} + guard + Loader2/FileDown aria-hidden + VEDNO viden pri projektu (NI gated na saved.length)', () => {",
        "r272:304 opis", "  it('pill ŽIVO: aria + active:scale + disabled={pdfNagibiVteku}",
    )
    t = rep_vrstica(
        t,
        "    expect(pill).toContain('press-scale')\n",
        "    expect(pill).toContain('active:scale-[0.96]') // [EVOLVED R390 val 68: dual mehanizem razrešen — utility scale ostane]\n",
        "r272:309", ZIG,
    )
    post["src/lib/__tests__/r272-nagibi-teren-pdf.test.ts"] = t

    # 3) REGISTER r363.tsv — L21 → zgodovina + NASLEDNICA-3 (idempotentno)
    reg = REPO / "scripts/qa-needles/r363.tsv"
    rt = reg.read_text(encoding="utf-8")
    vrstice = rt.split("\n")
    l21 = vrstice[20]
    if l21.startswith("h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale\t"):
        deli = l21.split("\t")
        if len(deli) != 3:
            sys.exit("FAILOVEDANO: r363.tsv:21 nima 3 polj")
        nov_needle = deli[0].replace(" press-scale", "", 1)
        vrstice[20] = (
            f"# {deli[0]}\t{deli[1]}\tneed_static — EVOLVED R390 val 68: žeton ' press-scale'"
            " odstranjen iz vira (inventory L1562 — dvojni mehanizem press-scale"
            " transform:scale(.97) + active:scale scale:.96 = množičen skrček 0.9312);"
            " naslednica = naslednja podatkovna vrstica"
        )
        vrstice.insert(
            21,
            f"{nov_needle}\tR390 val 68 NASLEDNICA r363 needleja (press-scale odstranjen iz vira; opis izvirnika: {deli[1]})\tneed_static",
        )
        rt_nov = "\n".join(vrstice)
        post["scripts/qa-needles/r363.tsv"] = rt_nov
    elif l21.startswith("# h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale") and "EVOLVED R390 val 68" in l21:
        print("  preskočeno (že evoluirano): r363.tsv:21")
        rt_nov = rt
    else:
        sys.exit(f"FAILOVEDANO: r363.tsv:21 nepričakovano stanje: {l21[:80]}…")

    # 4) POST preverbe (fail-closed PRED zapisom)
    napake = []
    # 4a) press-scale števci: per file pričakovana delta = ŠTEVILO target spanov,
    #     ki so ŠE vsebovali ' press-scale' ob VHODU tega teka (idempotentno)
    for fn, vrs in per_file.items():
        nov = post[f"src/components/roksal/{fn}"]
        star = (ROK / fn).read_text(encoding="utf-8")
        še_z_dualom = sum(1 for vr in vrs if " press-scale" in _span_na_vrstici(star, vr))
        raz = (star.count("press-scale") - nov.count("press-scale"))
        if raz != še_z_dualom:
            napake.append(f"{fn}: press-scale delta {raz} ≠ {še_z_dualom} (še-dual targeti)")
        if nov.count("\n") != pre_vrstice[fn]:
            napake.append(f"{fn}: vrstice spremenjene")
        if "active:scale-[0.96]" not in nov:
            napake.append(f"{fn}: active:scale-[0.96] manjka")
    # 4b) evolved datoteke: žig prisoten, star kontrakt odsoten
    for rel, staro in [
        ("src/lib/__tests__/r204-narocilnica-strazar.test.ts", "tabular-nums press-scale'"),
        ("src/lib/__tests__/r363-stil-val46.test.ts", "tabular-nums press-scale focus-visible:outline-none"),
        ("src/lib/__tests__/r269-meritve-teren-pdf.test.ts", "'press-scale active:scale-[0.96]"),
        ("src/lib/__tests__/r271-punch-stanje-pdf.test.ts", "expect(pill).toContain('press-scale')"),
        ("src/lib/__tests__/r272-nagibi-teren-pdf.test.ts", "expect(pill).toContain('press-scale')"),
    ]:
        v = post[rel]
        if staro in v and ZIG not in v:
            napake.append(f"{rel}: star žeton ŽIV brez žiga")
        if ZIG not in v:
            napake.append(f"{rel}: žig manjka")
    # 4c) r363.tsv: need_static podatkovne vrstice NE SMEJO upasti
    def ns_podatkovne(txt):
        return [l for l in txt.split("\n")
                if l and not l.startswith("#") and len(l.split("\t")) >= 3 and l.split("\t")[2].startswith("need_static")]
    pre_ns = ns_podatkovne(reg.read_text(encoding="utf-8"))
    post_ns = ns_podatkovne(rt_nov)
    if len(pre_ns) != len(post_ns):
        napake.append(f"r363.tsv need_static: {len(pre_ns)} → {len(post_ns)} (mora biti enako)")
    # naslednica needle ŽIVO v post-fix viru
    inv = post["src/components/roksal/inventory-tab.tsx"]
    naslednica = [l for l in rt_nov.split("\n") if l.startswith("h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums focus-visible:outline-none")]
    if len(naslednica) != 1:
        napake.append(f"naslednica vrstica v r363 = {len(naslednica)} (pričakovano 1)")
    elif inv.count(naslednica[0].split("\t")[0]) != 1:
        napake.append("naslednica needle ni ŽIVO (×1) v post-fix inventory viru")
    # 4d) opisni žetoni ×0
    if "dvoklik guard + press-scale" in post["src/lib/__tests__/r269-meritve-teren-pdf.test.ts"]:
        napake.append("r269 opis: press-scale omenjen še")
    if napake:
        for n in napake:
            print("FAILOVEDANO:", n)
        sys.exit(1)

    # 5) ATOMSKI ZAPIS
    for rel, vsebina in post.items():
        (REPO / rel).write_text(vsebina, encoding="utf-8")
    post_dual = dual_locaj()
    pre_sk = sum((ROK / f.name).read_text(encoding="utf-8").count("press-scale") for f in ROK.glob("*.tsx"))
    print(f"OK: val 68 zapisan — dual prej {len(pre_dual)} → po {len(post_dual)} (pričakovano 0)")
    print(f"press-scale žetoni v roksal tsx: {pre_sk + len(pre_dual)} → {pre_sk}")

def _span_na_vrstici(text, vr):
    if text is None:
        return ""
    for m in RE_SPAN.finditer(text):
        if text.count("\n", 0, m.start()) + 1 == vr:
            e = span_konec(text, m.end(), m.group(1))
            return text[m.start():e]
    return ""

if __name__ == "__main__":
    main()
