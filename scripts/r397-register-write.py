#!/usr/bin/env python3
# r397-register-write.py — R397 REGISTER needlejev (fail-closed, kanon
# r361/r389/r391/r392/r394/r396): TSV točno 3 polja; needle ŽIVO v buildu
# (.next/static/chunks CSS — val 72 je CSS-nivojska, kanon LEKCIJA R396 (7):
# build PREJ pred register-write, ker šivni needle rabi minificirani CSS);
# 0 v HEAD (9cf275d); need_static=1 usklajeno z era verigo (50. preverba
# r347–r396 ≥193 = 192 + 1 njihovih r395 ×3... NE — 192 (r347–r395, 49.
# preverba R397) + 1 r396.tsv val 71 CSS; TA needle (r397.tsv) je v 51.
# preverbi r347–r397 ≥194 = 193 + 1 [R398]).
#
# ⭐ LEKCIJA R397 (3) — lightningcss ZLIJE media-guard selektorje v ENO
# pravilo: src pretty petih ločenih blokov → build minificirani selector
# list `.badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,
# .animate-bounce-subtle{animation:none}` (pseudo-element ::after →
# :after normaliziran; presledki porinjeni). Needle = TOČNO ta zliti
# pravilni niz (najmočnejši šiv — celotno pravilo, sekvenca čez zamenjan
# žeton je NOVA = 0-v-HEAD kanon).
import pathlib
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")
REG = REPO / "scripts/qa-needles/r397.tsv"
HEAD = "9cf275d"

N1 = ".badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}"
D1 = ("R397 val 72 reduced-motion pariteta (×1 pojavitev v build CSS "
      "chunku; globals.css — lightningcss zliti selector list, LEKCIJA "
      "R397 (3)) — ob prefers-reduced-motion: reduce mirujejo vse "
      "kontinuirane zanke: badge-pulse-breathe + shine + pulse-soft + "
      "shimmer (+ enojni bounce-subtle za popolnost družine); rešuje P2 "
      "mejo iz R396 (G); 0 novih hex, vrednosti se ne dotikamo, samo "
      "ustavimo gibanje; svetla/temna tema bajtno; CSS nivo, 0 className "
      "žetonov, 0 pinov na src (0 v HEAD 9cf275d)")

VRSTICE = [
    "# qa-needles/r397.tsv — REGISTER needlejev runde R397 (STIL val 72:",
    "# REDUCED-MOTION PARITETA — kontinuirane zanke mirujejo; CSS-nivojska",
    "# sprememba v globals.css (+26 vrstic, 0 className žetonov → 0 pinov",
    "# na src); rešuje P2 mejo iz R396 (G): .badge-pulse (badge-pulse-breathe",
    "# 2s infinite) + .shine-effect::after (shine 3s infinite) +",
    "# .animate-pulse-soft (pulse-soft 2s infinite) + .shimmer (shimmer 1.5s",
    "# infinite) + .animate-bounce-subtle (enojni 0.3s, popolnost družine)",
    "# NOSIJO @media (prefers-reduced-motion: reduce) guard (animation:none).",
    "# 1 need_static (šivni needle — lightningcss ZLITI selector list je NOV",
    "# = 0-v-HEAD kanon; ×1 pojavitev; pseudo-element normaliziran ::after →",
    "# :after); TODO-R397 must_miss.",
    "# FEATURE DESETI STRAŽAR: gibanje-pariteta disciplina (reduced-motion",
    "# pokritost) — r397-gibanje-pariteta.test.ts ×7; komplet varuhov",
    "# r385…r394 + r395 + r396 (HEX cenzus) + r397.",
    "#",
    "# KOLIZIJE: brez (fetch-first origin/main == HEAD 9cf275d ob startu).",
    "# Era: 48. preverba (r347–r394) 189/189 ŽIVO ×2 + 49. (r347–r395)",
    "# 192/192 ŽIVO ×2 [AW spec lekcija] + 50. (r347–r396) ≥193 [ta runda];",
    "# TA needle (r397.tsv) je v 51. preverbi r347–r397 ≥194 [R398].",
]


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def main() -> None:
    if REG.exists():
        fail(f"register ŽE obstaja (nikoli prepisuj): {REG}")
    build_css = sorted((REPO / ".next/static/chunks").glob("*.css"))
    if not build_css:
        fail("build CSS manjka — zaženi `npx next build` PREJ pred register-write (LEKCIJA R396 (7))")
    zadetki = [f for f in build_css if sum(f.read_text(encoding="utf-8").count(N1) for _ in [0]) >= 1]
    skupaj = sum(f.read_text(encoding="utf-8").count(N1) for f in build_css)
    if skupaj != 1:
        fail(f"needle v build CSS = {skupaj} (pričakovano točno ×1)")
    print(f"OK: needle ×1 v build CSS ({zadetki[0].name})")
    # 0-v-HEAD kanon
    r = subprocess.run(
        ["git", "grep", "-cF", "--", N1, HEAD, "--", "src"],
        cwd=REPO, capture_output=True, text=True,
    )
    if r.returncode == 0 and r.stdout.strip():
        fail(f"needle ŽE v HEAD {HEAD} — NI šiv: {r.stdout.strip()}")
    print(f"OK: 0 v HEAD ({HEAD}) — šivni needle")
    # 0 v src (CSS-nivojska sprememba = 0 className žetonov)
    r2 = subprocess.run(
        ["git", "grep", "-lF", "--", N1, "--", "src"],
        cwd=REPO, capture_output=True, text=True,
    )
    if r2.returncode == 0 and r2.stdout.strip():
        fail(f"needle v src (pričakovano 0 — CSS nivo): {r2.stdout.strip()}")
    vsebina = "\n".join(VRSTICE) + "\n" + "\t".join([N1, D1, "need_static"]) + "\n" + "\t".join([
        "TODO-R397", "must_miss: razvojni ostanki (nesme biti v produkcijskih čankih)", "must_miss",
    ]) + "\n"
    for vrstica in vsebina.splitlines():
        if vrstica.startswith("#"):
            continue
        polja = vrstica.split("\t")
        if len(polja) != 3 or polja[2] not in ("need_static", "must_miss"):
            fail(f"TSV struktura: {vrstica[:60]!r}")
    REG.write_text(vsebina, encoding="utf-8")
    print(f"OK: {REG} zapisan ({len(vsebina)} bajtov; need_static=1 + must_miss=1)")


if __name__ == "__main__":
    main()
