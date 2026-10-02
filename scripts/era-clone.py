#!/usr/bin/env python3
# era-clone.py — R375 FEATURE: PARAMETRIZIRAN generični kloner era-harvest
# skriptov (5. korak generalizacije era verige: r370-era-clone → r371-era-clone
# → r372-era-clone → r373-era-clone [VSE hardcodirane] → TA).
#
# UPORABA (fail-closed, --src-round + --expected-total obvezna):
#   python3 scripts/era-clone.py --src-round 373 --expected-total 113
#   python3 scripts/era-clone.py --src-round 374 --expected-total 117 \
#       --dst-round 375 --dst-label "R374 issue #13" --dst-chain-seg "IN r374.tsv ×4 na"
#
# NAČELA:
#   - vhodni rep (PRED-pogoji) vsi žigi obvezni — LEKCIJA R371 (1);
#   - vsota need_static IZ DISKA (LEKCIJA R364 (4)), ne trdo kodirana;
#   - izpeljava: dst = src+1 (ali --dst-round), dst label = src label +1 runda
#     +1 val (kanon: 1 val/rundo od val 30); era besede iz števca er
#     (ERA_BESODE — fail-closed izven znanih vrednosti);
#   - KOLIZIJA generalizacija (R375): poslovne runde NE porabijo val →
#     --dst-label + --dst-chain-seg override; ×N = VEDNO iz diska (grep -c
#     šteje tudi komentarje — disk resnica r374 = ×4 podatkovne vrstice);
#   - POST-pogoji: natančna števca žigov v izhodu (novi ×n, stari ×0);
#   - NE piše izhoda, če KOLIKR koli preverba faila (fail-closed).
#   - LEKCIJA R375 (3): prag rebuild gre nad TRENUTNIM out (ne content) —
#     rebuild iz starega vira pobije prejšnje replacemente.
import argparse, pathlib, re, sys

REPO = pathlib.Path("/home/z/my-project")

ERA_BESODE = {
    22: ("DVAINDVJSETIJNA", "dvaindvajsete", "dvaindvajset", "DVAINDVJSETIH"),
    23: ("TRIINDVJSETIJNA", "triindvajsete", "triindvajset", "TRIINDVJSETIH"),
    24: ("STIRIINDVJSETIJNA", "štiriindvajsete", "štiriindvajset", "STIRIINDVJSETIH"),
    25: ("PETINDVJSETIJNA", "petindvajsete", "petindvajset", "PETINDVJSETIH"),
    26: ("ŠESTINDVJSETIJNA", "šestindvajsete", "šestindvajset", "ŠESTINDVJSETIH"),
    27: ("SEDEMINDVJSETIJNA", "sedemindvajsete", "sedemindvajset", "SEDEMINDVJSETIH"),
    28: ("OSEMINDVJSETIJNA", "osemindvajsete", "osemindvajset", "OSEMINDVJSETIH"),
    29: ("DEVETINDVJSETIJNA", "devetindvajsete", "devetindvajset", "DEVETINDVJSETIH"),
    30: ("TRIDESIJNA", "tridesete", "trideset", "TRIDESETIH"),
    31: ("ENAINTRIDESIJNA", "enaintridesete", "enaintrideset", "ENAINTRIDESETIH"),
    32: ("DVAINTRIDESIJNA", "dvaintridesete", "dvaintrideset", "DVAINTRIDESETIH"),
    33: ("TRIINTRIDESIJNA", "triintridesete", "triintrideset", "TRIINTRIDESETIH"),
    34: ("ŠTIRIINTRIDESIJNA", "štiriintridesete", "štiriintrideset", "ŠTIRIINTRIDESETIH"),
    35: ("PETINTRIDESIJNA", "petintridesete", "petintrideset", "PETINTRIDESETIH"),
    36: ("ŠESTINTRIDESIJNA", "šestintridesete", "šestintrideset", "ŠESTINTRIDESETIH"),
    37: ("SEDEMINTRIDESIJNA", "sedemintridesete", "sedemintrideset", "SEDEMINTRIDESETIH"),
    38: ("OSEMINTRIDESIJNA", "osemintridesete", "osemintrideset", "OSEMINTRIDESETIH"),
    39: ("DEVETINTRIDESIJNA", "devetintridesete", "devetintrideset", "DEVETINTRIDESETIH"),
    40: ("ŠTIRIDESIJNA", "štiridesete", "štirideset", "ŠTIRIDESETIH"),
}
ERA_MEJA = max(ERA_BESODE)


def reg_var(runda: int) -> str:
    """A=347 … Z=372, AA=373, AB=374 … (kanon r373-era-harvest.sh)."""
    i = runda - 347
    if i < 0:
        sys.exit("FAILOVEDANO: runda < 347 (era veriga začetek)")
    if i < 26:
        return chr(65 + i)
    return "A" + chr(65 + i - 26)


def need_static_disk(runda: int) -> int:
    """Podatkovne vrstice need_static (komentarji NE štejejo — disk resnica r374)."""
    reg = REPO / f"scripts/qa-needles/r{runda}.tsv"
    if not reg.exists():
        sys.exit(f"FAILOVEDANO: register manjka na disku: {reg}")
    n = 0
    for line in reg.read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) >= 3 and parts[2].strip() == "need_static":
            n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src-round", type=int, required=True)
    ap.add_argument("--expected-total", type=int, required=True)
    ap.add_argument("--dst-round", type=int, default=None)
    ap.add_argument("--dst-label", type=str, default=None,
                    help="override za poslovne runde brez val številke (npr. 'R374 issue #13')")
    ap.add_argument("--dst-chain-seg", type=str, default=None,
                    help="override za glavni verižni segment (npr. 'IN r374.tsv ×4 na')")
    args = ap.parse_args()

    src = args.src_round
    dst = args.dst_round or (src + 1)
    if dst != src + 1:
        sys.exit(f"FAILOVEDANO: dst {dst} ≠ src+1 {src+1} (kanon: 1 runda naprej)")

    SRC_F = REPO / f"scripts/r{src}-era-harvest.sh"
    DST_F = REPO / f"scripts/r{dst}-era-harvest.sh"
    if not SRC_F.exists():
        sys.exit(f"FAILOVEDANO: vhodni skript manjka: {SRC_F}")
    if DST_F.exists():
        sys.exit(f"FAILOVEDANO: izhod ŽE obstaja (nikoli prepisuj): {DST_F}")

    stevec = dst - 347
    if stevec not in ERA_BESODE:
        sys.exit(f"FAILOVEDANO: era števec {stevec} (runda R{dst}) izven znane mape do {ERA_MEJA} — razširi ERA_BESODE GLASNO")
    ERA, low_prev, low_reg, ERA_PL = ERA_BESODE[stevec]

    content = SRC_F.read_text(encoding="utf-8")

    labeli = re.findall(r'preberi_register "\$REG_([A-Z]+)" "(R(\d+) val (\d+))"', content)
    if not labeli:
        sys.exit("FAILOVEDANO: vhod nima preberi_register klicev")
    last_var, srclabel, src_r, src_val = labeli[-1]
    if int(src_r) != src - 1:
        sys.exit(f"FAILOVEDANO: zadnji register v vhodu je R{src_r} ≠ R{src-1}")
    dst_n = need_static_disk(src)  # ×N vedno IZ DISKA
    if args.dst_label:
        dstlabel = args.dst_label
    else:
        dstlabel = f"R{src} val {int(src_val) + 1}"

    src_total = args.expected_total - need_static_disk(src)
    pred = [
        f'REG_{reg_var(src-1)}="scripts/qa-needles/r{src-1}.tsv"',
        f'preberi_register "$REG_{reg_var(src-1)}" "{srclabel}"',
        ERA_BESODE[stevec - 1][0],
        f"TODO-R{src-1}|R{src-1}",
        f"r{src}-resolucija-",
        f"/tmp/r{src}-prod-chunks",
        f'[ "$need_n" -lt {src_total} ]',
    ]
    for m in pred:
        if m not in content:
            sys.exit(f"FAILOVEDANO: vhodni rep manjka: {m}")

    out = content

    def rep(staro, novo, priakovano):
        nonlocal out
        c = out.count(staro)
        if c != priakovano:
            sys.exit(f"FAILOVEDANO: '{staro[:70]} …' = {c} (pričakovano {priakovano})")
        out = out.replace(staro, novo)

    # 1) glava — vrstica z imenom skripta + era beseda
    rep(f"# r{src}-era-harvest.sh — R{src} {ERA_BESODE[stevec-1][0]} era preverba: r347.tsv val 30",
        f"# r{dst}-era-harvest.sh — R{dst} {ERA} era preverba: r347.tsv val 30", 1)
    # 2) glava — register veriga (override za poslovne runde)
    if args.dst_chain_seg:
        rep(f"IN r{src-1}.tsv val {src_val} ×4 na", args.dst_chain_seg, 1)
    else:
        rep(f"IN r{src-1}.tsv val {src_val} ×4 na",
            f"IN r{src-1}.tsv val {src_val} ×4 IN r{src}.tsv val {int(src_val)+1} ×{dst_n} na", 1)
    # 3) glava — 'pride na produ SAM' + zaostanek ere-besede POPRAVLJEN
    rep(f"(R{src} pride na produ SAM — R347–R{src-1} so ŽE ŽIVI od\n# {ERA_BESODE[stevec-1][1]} preverbe R{src},",
        f"(R{dst} pride na produ SAM — R347–R{src} so ŽE ŽIVI od\n# {low_prev} preverbe R{dst},", 1)
    # 4) glava — kanon žig
    rep(f"Kanon R345–R{src}\n# (r{src}-era-harvest.sh)",
        f"Kanon R345–R{dst}\n# (r{dst}-era-harvest.sh)", 1)
    # 5) poti + začasne datoteke
    rep(f"/tmp/r{src}-prod-chunks", f"/tmp/r{dst}-prod-chunks", 1)
    rep(f"r{src}-resolucija-", f"r{dst}-resolucija-", 2)
    # 6) NOV register var + klic
    rep(f'REG_{reg_var(src-1)}="scripts/qa-needles/r{src-1}.tsv"\n',
        f'REG_{reg_var(src-1)}="scripts/qa-needles/r{src-1}.tsv"\nREG_{reg_var(src)}="scripts/qa-needles/r{src}.tsv"\n', 1)
    rep(f'preberi_register "$REG_{reg_var(src-1)}" "{srclabel}"\n',
        f'preberi_register "$REG_{reg_var(src-1)}" "{srclabel}"\npreberi_register "$REG_{reg_var(src)}" "{dstlabel}"\n', 1)
    # 7) prag — CELO vrstico zgradi IZ DISKA; izhodišče = TRENUTNI out
    vrstice = out.splitlines()
    idx = [i for i, l in enumerate(vrstice) if f'[ "$need_n" -lt {src_total} ]' in l]
    if len(idx) != 1:
        sys.exit(f"FAILOVEDANO: prag vrstica = {len(idx)} najdenih ≠ 1")
    per = [(r, need_static_disk(r)) for r in range(347, src + 1)]
    tot = sum(n for _, n in per)
    if tot != args.expected_total:
        sys.exit(f"FAILOVEDANO: disk vsota {tot} ≠ pričakovano {args.expected_total}")
    vrstice[idx[0]] = (
        f'[ "$need_n" -lt {tot} ] && {{ echo "FAILOVEDANO: VSI {low_reg} registrov '
        f'SKUPAJ imajo $need_n need_static needlejev (pričakovano ≥ {tot} = '
        + " + ".join(str(n) for _, n in per) + ')"; exit 1; }'
    )
    out = "\n".join(vrstice) + ("\n" if content.endswith("\n") else "")
    # 8) must_miss — nov TODO par + komentar
    rep(f"'TODO-R{src-1}|R{src-1}'; do",
        f"'TODO-R{src-1}|R{src-1}' 'TODO-R{src}|R{src}'; do", 1)
    rep(f"TODO-R{src-1} NE SMEJO", f"TODO-R{src} NE SMEJO", 1)
    # 9) sekcija komentar — plural era beseda
    rep(f"VSEH {ERA_BESODE[stevec-1][3]} registrov", f"VSEH {ERA_PL} registrov", 1)
    # 10) banner — ×N iz diska
    rep(f"IN {srclabel} (×4) ŽIVO NA PRODU",
        f"IN {srclabel} (×4) IN {dstlabel} (×{dst_n}) ŽIVO NA PRODU", 1)
    # 11) tri končni bannerji
    rep(f"=== R{src} {ERA_BESODE[stevec-1][0]} ERA PREVERBA",
        f"=== R{dst} {ERA} ERA PREVERBA", 3)

    checks = [
        (f'REG_{reg_var(src)}="scripts/qa-needles/r{src}.tsv"', 1),
        (f'preberi_register "$REG_{reg_var(src)}" "{dstlabel}"', 1),
        (ERA, 4),
        (f"TODO-R{src}|R{src}", 1),
        (f'[ "$need_n" -lt {tot} ]', 1),
        (f"IN {dstlabel} (×{dst_n}) ŽIVO NA PRODU", 1),
        (f"/tmp/r{dst}-prod-chunks", 1),
        (f"r{dst}-resolucija-", 2),
        (f"{low_prev} preverbe R{dst}", 1),
        (f"{ERA_BESODE[stevec-1][1]} preverbe R{src}", 0),
        (f"R{src} pride na produ SAM", 0),
        (f"{low_reg} registrov", 1),
        (f"{ERA_BESODE[stevec-1][2]} registrov", 0),
        (ERA_BESODE[stevec-1][0], 0),
        (ERA_BESODE[stevec-1][3], 0),
        (ERA_PL, 1),
        (f"Kanon R345–R{src}", 0),
        (f"Kanon R345–R{dst}", 1),
        (f"IN r{src}.tsv val {int(src_val)+1} ×{dst_n} na", 1 if not args.dst_chain_seg else 0),
        (args.dst_chain_seg, 1) if args.dst_chain_seg else (f"IN r{src}.tsv", 1),
    ]
    ok = True
    for pat, n in checks:
        c = out.count(pat)
        if c != n:
            print(f"FAILOVEDANO: '{pat}' = {c} (pričakovano {n})")
            ok = False
    if not ok:
        sys.exit(1)

    print("per-registr need_static:", per)
    print(f"SKUPAJ: {tot} (pričakovano ≥ {args.expected_total})")
    print(f"izpeljani labeli: src={srclabel} dst={dstlabel} (×{dst_n}); era={ERA} (števec {stevec})")
    DST_F.write_text(out, encoding="utf-8")
    print(f"OK: {DST_F} zapisan ({len(out)} bajtov)")


if __name__ == "__main__":
    main()
