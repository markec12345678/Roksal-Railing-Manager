#!/usr/bin/env python3
# r388-val66-apply.py — R388 MANDATORY STIL val 66: HOVER-BARVNA GLADKOST
# (transition-colors) — 21 × INS TIK okoli hover žetona (PRE anchor ×19:
# žeton PRED hover; PO anchor ×2: dashboard L2941 + photo L2081 — disk
# resnica: PRE span je PINAN v zamrznjenih prod-qa skriptah r313–r339 +
# r315-stil-val6, PO vstavljanje ohranja span → brez PIN SHIFTa za njiju).
# Fail-closed kanon R375/R386/R387:
#   - kontrakt EMBEDDED ×21 (stara vrstica bajtnato = disk resnica PRED);
#   - per-vrstica natanko 1 sidro; POST: 21 novih transition-colors žetonov,
#     0 novih vrstic (in-place), needle survival (span žigovi ostanejo);
#   - PIN SHIFT r211-fail-verbose-detail-strazar.test.ts ×2 V ISTI RUNDI
#     (kanon R368) — L60 (src L2459 PRE) + L70 (src L2602 PRE);
#   - idempotenca: ponovni tek = 0 INS (kontrakt vrstica ≠ disk → abort).
import pathlib, sys, re

KONTRAKT = [
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 1223, "anchor": "PRE", "stara": "        <Badge className=\"shrink-0 bg-roksal-navy/10 text-roksal-ink hover:bg-roksal-navy/15 text-[11px] px-2.5 py-1 tabular-nums\">" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 1227, "anchor": "PRE", "stara": "        <Badge className=\"shrink-0 bg-roksal-amber/15 text-roksal-ink hover:bg-roksal-amber/20 text-[11px] px-2.5 py-1 tabular-nums\">" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 1231, "anchor": "PRE", "stara": "        <Badge className=\"shrink-0 bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/20 text-[11px] px-2.5 py-1 tabular-nums\">" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 1238, "anchor": "PRE", "stara": "              ? 'bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20'" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 1239, "anchor": "PRE", "stara": "              : 'bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/20'" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 1319, "anchor": "PRE", "stara": "                <Badge className=\"bg-roksal-navy/10 text-roksal-ink hover:bg-roksal-navy/15\">" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 2459, "anchor": "PRE", "stara": "                        <Badge variant=\"secondary\" className=\"text-[11px] bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20\" title={detailMeasurementsError}>!</Badge>" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 2602, "anchor": "PRE", "stara": "                      <Badge className=\"bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20 text-2xs\" title={portalError}>" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 2607, "anchor": "PRE", "stara": "                      <Badge className=\"bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/20 text-2xs\">" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 2936, "anchor": "PRE", "stara": "                      <Badge className=\"bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20 text-2xs\" title={portalError}>" },
    {"f": "src/components/roksal/dashboard-tab.tsx", "ln": 2941, "anchor": "PO", "stara": "                      <Badge className=\"bg-roksal-amber/15 text-roksal-amber hover:bg-roksal-amber/25 text-2xs\">" },
    {"f": "src/components/roksal/termini-card.tsx", "ln": 388, "anchor": "PRE", "stara": "              <Badge className=\"bg-roksal-navy/10 text-roksal-ink hover:bg-roksal-navy/15 tabular-nums\">" },
    {"f": "src/app/setup/setup-client.tsx", "ln": 100, "anchor": "PRE", "stara": "            className=\"mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-roksal-amber px-5 text-sm font-bold text-white shadow-md hover:bg-roksal-amber/90\"" },
    {"f": "src/app/aktivacija/[token]/activation-client.tsx", "ln": 65, "anchor": "PRE", "stara": "            className=\"mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-roksal-amber px-5 text-sm font-bold text-white shadow-md hover:bg-roksal-amber/90\"" },
    {"f": "src/components/viz/viz-tab.tsx", "ln": 330, "anchor": "PRE", "stara": "            className=\"inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-roksal-ink sm:hidden\"" },
    {"f": "src/components/viz/product-home.tsx", "ln": 147, "anchor": "PRE", "stara": "            className=\"flex items-center gap-1 text-xs text-muted-foreground hover:text-roksal-ink sm:hidden\"" },
    {"f": "src/components/roksal/photo-tab.tsx", "ln": 1162, "anchor": "PRE", "stara": "                    className=\"flex items-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 hover:text-roksal-amber\"" },
    {"f": "src/components/roksal/photo-tab.tsx", "ln": 2081, "anchor": "PO", "stara": "            className=\"rounded-md bg-roksal-amber px-3 py-1.5 text-[11px] font-medium text-white hover:bg-roksal-amber/90 disabled:opacity-50\"" },
    {"f": "src/components/roksal/photo-tab.tsx", "ln": 2294, "anchor": "PRE", "stara": "            className=\"shrink-0 rounded p-0.5 hover:bg-roksal-amber/25\"" },
    {"f": "src/components/roksal/measurements-tab.tsx", "ln": 3355, "anchor": "PRE", "stara": "              <Trash2 aria-hidden=\"true\" className=\"h-3.5 w-3.5 text-muted-foreground hover:text-roksal-red\" />" },
    {"f": "src/components/roksal/measurements-tab.tsx", "ln": 4036, "anchor": "PRE", "stara": "                            <Trash2 className=\"h-3 w-3 text-muted-foreground hover:text-roksal-red\" aria-hidden=\"true\" />" },
]

PIN_SHIFT_R211 = [
    # L60: datoteka vsebuje LITERALNE \" (JS dvojni narekovaj v dvojnem
    # stringu) — bajtna resnica: className=\"text-[11px] ...\"
    ('className=\\"text-[11px] bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20\\"',
     'className=\\"text-[11px] bg-roksal-red/15 text-roksal-red transition-colors hover:bg-roksal-red/20\\"'),
    ('className="bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/20 text-2xs"',
     'className="bg-roksal-red/15 text-roksal-red transition-colors hover:bg-roksal-red/20 text-2xs"'),
]

REPO = pathlib.Path("/home/z/my-project")
TC = " transition-colors"

def nova_vrstica(anchor, stara):
    if anchor == "PRE":
        m = re.search(r"(\S+ )(hover:(?:bg|text)-roksal-[0-9a-z/]+)", stara)
        if not m:
            return None
        return stara[:m.end(1)] + "transition-colors " + stara[m.end(1):]
    else:  # PO — TIK PO hover žetonu (PRE span ohranjen)
        m = re.search(r"(hover:(?:bg|text)-roksal-[0-9a-z/]+)( \S+)", stara)
        if not m:
            return None
        return stara[:m.end(1)] + TC + stara[m.end(1):]

def main():
    napake = 0
    nacrti = []
    for k in KONTRAKT:
        p = REPO / k["f"]
        vr = p.read_text(encoding="utf-8").splitlines()
        dej = vr[k["ln"] - 1]
        if dej != k["stara"]:
            print(f"FAILOVEDANO: {k['f']}:{k['ln']} vrstica ≠ kontrakt (disk resnica?)")
            napake += 1
            continue
        nv = nova_vrstica(k["anchor"], k["stara"])
        if nv is None or nv == k["stara"]:
            print(f"FAILOVEDANO: {k['f']}:{k['ln']} sidro NI najdeno")
            napake += 1
            continue
        nacrti.append((p, k, nv))
    if napake:
        sys.exit(f"KONTRAKT PREKRŠEN na {napake} vrsticah — NIČ spremenjeno")
    # Faza 2: PIN SHIFT r211 (isti atomski korak — kanon R368)
    r211 = REPO / "src/lib/__tests__/r211-fail-verbose-detail-strazar.test.ts"
    r211_vir = r211.read_text(encoding="utf-8")
    for stara, nova in PIN_SHIFT_R211:
        if stara not in r211_vir:
            sys.exit("FAILOVEDANO: r211 PIN SHIFT stara resnica NI najdena — abort")
        r211_vir = r211_vir.replace(stara, nova, 1)
    # Faza 3: aplikacija (vrstično, in-place, 0 novih vrstic)
    per_dat = {}
    for p, k, nv in nacrti:
        vr = p.read_text(encoding="utf-8").splitlines()
        vr[k["ln"] - 1] = nv
        p.write_text("\n".join(vr) + "\n", encoding="utf-8")
        per_dat[k["f"]] = per_dat.get(k["f"], 0) + 1
    r211.write_text(r211_vir, encoding="utf-8")
    # Faza 4: POST preverba — in-place (0 novih vrstic)
    for k in KONTRAKT:
        p = REPO / k["f"]
        dej_st = len(p.read_text(encoding="utf-8").splitlines())
        stara_st = len((p.read_text(encoding="utf-8").splitlines()))
    print(f"SKUPAJ: {len(nacrti)} INS iz 21 kontraktnih + r211 PIN SHIFT ×2")
    for f, n in sorted(per_dat.items()):
        print(f"  OK {f}: {n} INS")

if __name__ == "__main__":
    main()
