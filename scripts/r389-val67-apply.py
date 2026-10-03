#!/usr/bin/env python3
# r389-val67-apply.py — R389 MANDATORY STIL val 67: LASTNA-PREHOD GLADKOST
# (property-list nadgradnja) — 2 × REPL in-place (0 novih vrstic):
#   1. notification-center.tsx:811  transition-transform →
#      transition-[transform,color]  (group-hover:translate-x-0.5 ostane
#      gladk + group-hover:text-roksal-amber NEHA biti snap — konflikt
#      dokumentiran R388: aditivni transition-colors bi OVERIL transform,
#      ker .transition-colors @117441 < .transition-transform @118190 v
#      zgrajenem CSS — kaskada vzame KASNEJEGA; nadgradnja lastnosti je
#      edina iskrena rešitev);
#   2. safety-tab.tsx:254  transition-transform →
#      transition-[transform,background-color,box-shadow]  (ui-kit Button
#      baza 'transition-all' je OVERRIDANA s strani elementa:
#      .transition-transform @118190 > .transition-all @117243 → hover:bg-
#      roksal-navy/90 je bil SNAP; LEKCIJA R389 (3): cva baza pokritost je
#      NIČNA, če element sam nosi ožjo transition-* utility).
# Fail-closed kontrakt: polna STARA vrstica bajtno (×2), REPL in-place,
# POST preverba (nov žeton ŽIVO ×1, star ×0 na tarčni vrstici), idempotenca
# (ponovni tek = abort 'vrstica ≠ kontrakt').
# EVOLVED V ISTI RUNDI (kanon R368 — PIN/izjema premiki v ENEM atomskem koraku):
#   - r388-stil-val66.test.ts (C): L811 pin transition-transform →
#     transition-[transform,color] + star token ×0 + žig [EVOLVED R389 val 67];
#   - r388-hover-gladkost-generalizacija.test.ts: L811 IZ ZAMRZNJENIH IZJEM
#     (×12 → ×11; pokritost sedaj resnična — stražar je preverja) + žig.
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")

# (pot, staro, novo, pričakovano staro število, pričakovano novo število)
KONTRAKTI = [
    (
        "src/components/roksal/notification-center.tsx",
        '                      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-roksal-amber" />',
        '                      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-roksal-amber" />',
    ),
    (
        "src/components/roksal/safety-tab.tsx",
        '          className="h-9 px-3 bg-roksal-navy hover:bg-roksal-navy/90 text-white gap-1.5 transition-transform duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"',
        '          className="h-9 px-3 bg-roksal-navy hover:bg-roksal-navy/90 text-white gap-1.5 transition-[transform,background-color,box-shadow] duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"',
    ),
]

EVOLVED_1 = (
    "src/lib/__tests__/r388-stil-val66.test.ts",
    """    // transition-transform konflikt (L811) — NI aditivno rešljiv, ostaja
    const nc = R('components/roksal/notification-center.tsx').split('\\n')[810]
    expect(nc.includes('transition-transform')).toBe(true)
    expect(nc.includes('group-hover:text-roksal-amber')).toBe(true)""",
    """    // [EVOLVED R389 val 67] L811 konflikt REŠEN: property-list nadgradnja
    // transition-transform → transition-[transform,color] (NI aditivno —
    // kaskada: .transition-transform @118190 > .transition-colors @117441;
    // transform + color SEDAJ OBA gladka)
    const nc = R('components/roksal/notification-center.tsx').split('\\n')[810]
    expect(nc.includes('transition-[transform,color]')).toBe(true)
    expect(nc.includes('transition-transform')).toBe(false)
    expect(nc.includes('group-hover:text-roksal-amber')).toBe(true)""",
)

EVOLVED_2A = (
    "src/lib/__tests__/r388-hover-gladkost-generalizacija.test.ts",
    """//      (hover:bg == bg — vizualno NIČ), roksal/notification-center L811
//      (transition-transform konflikt — rabil bi property-list nadgradnjo,
//      NI aditivno), lib/termini-prikaz L47/L49/L51/L53 (mrtvi izvozi —
//      SCHEDULE_TERMINI_STATUS_COLORS brez .tsx potrošnika).""",
    """//      (hover:bg == bg — vizualno NIČ), lib/termini-prikaz L47/L49/L51/L53
//      (mrtvi izvozi — SCHEDULE_TERMINI_STATUS_COLORS brez .tsx potrošnika).
//      [EVOLVED R389 val 67] roksal/notification-center L811 IZ IZJEM —
//      property-list nadgradnja transition-[transform,color] (konflikt
//      rešen; pokritost sedaj resnična in stražar jo PREVERJA).""",
)

EVOLVED_2B = (
    "src/lib/__tests__/r388-hover-gladkost-generalizacija.test.ts",
    """  'components/roksal/material-intelligence-tab.tsx:459',
  'components/roksal/notification-center.tsx:811',
  'lib/termini-prikaz.ts:47',""",
    """  'components/roksal/material-intelligence-tab.tsx:459',
  // [EVOLVED R389 val 67] notification-center.tsx:811 odstranjena —
  // property-list nadgradnja; pokritost preverjena v glavnem skanu
  'lib/termini-prikaz.ts:47',""",
)


def main() -> None:
    # FAZA 0: kontrakti — polna stara vrstica bajtno, točno ×1
    for rel, staro, novo in KONTRAKTI:
        p = REPO / rel
        vsebina = p.read_text(encoding="utf-8")
        c = vsebina.count(staro)
        if c != 1:
            sys.exit(f"FAILOVEDANO: kontrakt {rel} = {c} (pričakovano 1) — idempotenca ALI zamik")
        if novo in vsebina:
            sys.exit(f"FAILOVEDANO: {rel} ŽE nosi nov žeton (idempotentni tek = 0 INS kanon)")
    # FAZA 1: EVOLVED kontrakti (isti atomski korak — kanon R368)
    for rel, staro, novo in (EVOLVED_1, EVOLVED_2A, EVOLVED_2B):
        p = REPO / rel
        vsebina = p.read_text(encoding="utf-8")
        c = vsebina.count(staro)
        if c != 1:
            sys.exit(f"FAILOVEDANO: EVOLVED kontrakt {rel} = {c} (pričakovano 1): {staro[:60]!r}")
    # FAZA 2: APPLY (vsi kontrakti potrjeni — zdaj pišemo)
    for rel, staro, novo in KONTRAKTI:
        p = REPO / rel
        vsebina = p.read_text(encoding="utf-8")
        p.write_text(vsebina.replace(staro, novo, 1), encoding="utf-8")
        post = (REPO / rel).read_text(encoding="utf-8")
        vrstica = next(l for l in post.splitlines() if novo.strip()[:40] in l)
        if novo not in post or staro in post:
            sys.exit(f"FAILOVEDANO: POST preverba {rel}")
        print(f"OK REPL: {rel} (in-place, 0 novih vrstic)")
    for rel, staro, novo in (EVOLVED_1, EVOLVED_2A, EVOLVED_2B):
        p = REPO / rel
        vsebina = p.read_text(encoding="utf-8")
        p.write_text(vsebina.replace(staro, novo, 1), encoding="utf-8")
        print(f"OK EVOLVED: {rel}")
    # FAZA 3: POST disk resnica
    nc = (REPO / "src/components/roksal/notification-center.tsx").read_text(encoding="utf-8").splitlines()
    st = (REPO / "src/components/roksal/safety-tab.tsx").read_text(encoding="utf-8").splitlines()
    if len(nc) != 969 or len(st) != 759:
        sys.exit(f"FAILOVEDANO: števec vrstic {len(nc)}/{len(st)} ≠ 969/759 (in-place kršen)")
    print("POST: 969 + 759 vrstic bajtno ohranjeno (in-place kanon); žigi EVOLVED ×3")
    print("val 67: 2 × property-list nadgradnja MONTIRANA")


if __name__ == "__main__":
    main()
