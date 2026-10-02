#!/usr/bin/env python3
# r370-pins-shift.py — R370 stale-pin shifti V ISTI RUNDI (6 pinov, žigi
# [PIN SHIFT R370 val 53]). Fail-closed: vsak pin preveri PRIČAKOVANO staro
# vsebino (točno 1 pojavitev, kjer obvezano), potem substitucija; najdenih
# napačno število → abort BREZ pisanja. Osvežitvi (3)+(4) = ŽE zastarela
# legacy needleja (najdba R370, dokumentirana v apply glavi).
import pathlib, sys

def shift(path, old, new, expected=1, stamp_comment=None, anchor=None):
    p = pathlib.Path(path)
    src = p.read_text(encoding="utf-8")
    n = src.count(old)
    if n != expected:
        sys.exit(f"FAILOVEDANO: {path}: '{old[:60]}…' = {n} pojavitve (pričakovano {expected}) — abort")
    if stamp_comment and anchor:
        if src.count(anchor) != 1:
            sys.exit(f"FAILOVEDANO: {path}: sidro '{anchor[:50]}…' = {src.count(anchor)} — abort")
        src = src.replace(anchor, stamp_comment + "\n" + anchor, 1)
    src = src.replace(old, new)
    p.write_text(src, encoding="utf-8")
    print(f"OK shift: {path} ({old[:48]}… → {new[:48]}…)")

O1 = "focus-visible:ring-offset-1"
O2 = "focus-visible:ring-offset-2"

# (1) vitest hard pin — r236 test, invoice offset-1" → offset-2" + žig komentar
shift(
    "src/lib/__tests__/r236-dobavitelji-pdf.test.ts",
    "focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1\"",
    "focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2\"",
    1,
    "    // [PIN SHIFT R370 val 53: offset-1→2 navy rep normalizacija —\n    // precedens val 44/47/49/51; invoice L1045/L1061/L1182 zdaj offset-2]",
    "    expect(racuni).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40",
)

# (2) r236-build-needles L47 — CSV pill (LEGACY, proaktiven)
shift(
    "scripts/r236-build-needles.sh",
    "need \"press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1\" \"R236 invoice CSV pill navy/40\"",
    "need \"press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2\" \"R236 invoice CSV pill navy/40 [PIN SHIFT R370 val 53: offset-1→2 navy rep normalizacija]\"",
    1,
)

# (3) r236-build-needles L49 — Prejem (ŽE zastarel pred R370 — osvežitev)
shift(
    "scripts/r236-build-needles.sh",
    "need \"bg-green-50 dark:bg-green-950/40 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1\" \"R236 Prejem navy/40\"",
    "need \"bg-green-50 dark:bg-green-950/40 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2\" \"R236 Prejem navy/40 [PIN SHIFT R370 val 53: osveženo na disk resnico — green-50+navy/40 živi na logistics L2417 z offset-2; ŽE zastarel pred R370]\"",
    1,
)

# (4) r236-build-needles L48 — Izdaj/Plačan (ŽE zastarel pred R370 — osvežitev)
shift(
    "scripts/r236-build-needles.sh",
    "need \"bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-roksal-navy/40\" \"R236 Izdaj/Plačan navy/40\"",
    "need \"bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40\" \"R236 Izdaj/Plačan navy/40 [PIN SHIFT R370 val 53: osveženo na disk resnico — vmesni outline-none+ring-2 segment L1319/L1339; ŽE zastarel pred R370]\"",
    1,
)

# (5) r237-build-needles L43 — dashboard L2666
shift(
    "scripts/r237-build-needles.sh",
    "need \"focus-visible:ring-offset-1 transition-colors\" \"R237 dashboard navy gumb fokus (2635)\"",
    "need \"focus-visible:ring-offset-2 transition-colors\" \"R237 dashboard navy gumb fokus [PIN SHIFT R370 val 53: offset-1→2 navy rep normalizacija; vrstica zdaj 2666]\"",
    1,
)

# (6) r237-prod-core L64 — CSV pill (LEGACY, proaktiven)
shift(
    "scripts/r237-prod-core.sh",
    "need \"press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1\" \"R236 fokus revizija invoice CSV pill\"",
    "need \"press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2\" \"R236 fokus revizija invoice CSV pill [PIN SHIFT R370 val 53: offset-1→2 navy rep normalizacija]\"",
    1,
)

print("=== 6/6 pinov shiftanih z žigi [PIN SHIFT R370 val 53] ===")
