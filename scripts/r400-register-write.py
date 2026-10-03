#!/usr/bin/env python3
# r400-register-write.py — R400 REGISTER needlejev (fail-closed, kanon
# r361/…/r399; KOLIZIJA #28 preimenovanje R399→R400:
# r361/r389/r391/r392/r394/r396/r397/r398): TSV točno 3 polja; needle ŽIVO
# v buildu (.next/static/chunks JS — val 74 je TSX-nivojska className raba,
# vzorec r394: string literali v JS čankih; build PREJ pred register-write,
# kanon LEKCIJA R396 (7)); 0 v HEAD (9c248f9); need_static=1 usklajeno z
# era verigo (52. preverba r347–r398 tek 1 iskren 194/195 — val 73 PENDING
# rate-limited deploy; TA needle (r400.tsv) je v 54. preverbi r347–r400
# ≥199 = 198 (195 + njihovih 3 r399.tsv) + 1 [R401]).
#
# val 74 = SLOVAR-RABA (kandidat 1 iz R398 handoverja, pot A „uporabiti v
# UI (loading skeleti)"): .shimmer ×7 (vse ročno valjane skelet kartice:
# katalog + vodja + CRM + obvestila ×3 + foto galerija) +
# .animate-bounce-subtle ×1 (bottom-nav značka, pogojno montirana).
# Needle `shimmer rounded` ×7 = skelet kartice družina (najširši skupni
# podniz; `shimmer rounded-lg` ×5 bi bil preozek — 2 obvestili vrstici
# `shimmer rounded` brez -lg). Disciplina: needle se bere IZ BUILDA
# (LEKCIJA R398 (4) — nikoli napovedan), števci potrjeni prek rg ×7/×5/×1.
import pathlib
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")
REG = REPO / "scripts/qa-needles/r400.tsv"
HEAD = "9c248f9"  # moj fetch-first start (needle = 0 v 9c248f9 IN v d8a76c5 — njihove spremembe: object-storage plast, NE skelet žetoni)

N1 = "shimmer rounded"
D1 = ("R400 val 74 slovar-raba — shimmer/bounce-subtle v UI (×7 pojavitev "
      "v build JS čankih ×5 datotek: roksal-catalog h-28 + vodja-dashboard "
      "h-24 + crm-tab h-24 + notification-center h-10/h-3/h-2.5 + photo-tab "
      "aspect-square) — vse ročno valjane nalagalne skelet kartice zamenjajo "
      "`animate-pulse … bg-muted` s .shimmer (premikajoči se gradient = "
      "jasnejši nalaganje signal; background: shorthand nadomesti bg-muted, "
      "brez kaskadne dvoumnosti); kandidat 1 iz R398 handoverja, pot A "
      "(uporabiti v UI); .animate-bounce-subtle ×1 na bottom-nav znački "
      "(pogojno montirana — 0→N prehod remontira, brez JS ožičenja); "
      "obe rabi ŽE pokriti z val 72 reduced-motion guardom (bajtno); "
      "MEJE: ui-kit Skeleton FROZEN K1 (bg-accent animate-pulse rounded-md) "
      "bajtno + animate-pulse ×13 busy/progress/ikon družina ostaja "
      "(semantična meja, r400-slovar-raba.test.ts (D)/(G)); 0 novih hex; "
      "TSX nivo, className raba — needle ŽIVO v src in v build JS")

VRSTICE = [
    "# qa-needles/r400.tsv — REGISTER needlejev runde R400 (STIL val 74:",
    "# SLOVAR-RABA — slovarska para shimmer/bounce-subtle je dejansko V UI;",
    "# TSX-nivojska className raba (vzorec r394: needle = string literal v",
    "# build JS čankih); rešuje kandidat 1 iz R398 handoverja, pot A",
    "# (uporabiti v UI — loading skeleti): .shimmer ×7 (vse ročno valjane",
    "# skelet kartice: katalog + vodja + CRM + obvestila ×3 + foto galerija",
    "# — zamenja animate-pulse + bg-muted) + .animate-bounce-subtle ×1",
    "# (bottom-nav značka, pogojno montirana — mount-sprožena, brez JS).",
    "# 1 need_static (šivni needle `shimmer rounded` — najširši skupni",
    "# podniz skelet družine; 0 v HEAD 9c248f9, tudi 0 v d8a76c5; ×7 pojavitev);",
    "# TODO-R400 must_miss.",
    "# FEATURE DVANAJSTI STRAŽAR: slovar-raba disciplina —",
    "# r400-slovar-raba.test.ts ×7; komplet varuhov r385…r394 + r395 +",
    "# r396 (HEX cenzus) + r397 + r398 + r399 + r400.",
    "#",
    "# KOLIZIJA #28: preimenovanje R399→R400 — njihova R399 [d8a76c5, §18 OBJECT",
    "# STORAGE] = pristala resnica, bajtno; MOJI artefakti preimenovani.",
    "# Era: 52. preverba (r347–r398) tek 1 iskren 194/195 [val 73 PENDING —",
    "# deploy rate-limited 24 h]; TA needle (r400.tsv) je v 54. preverbi",
    "# r347–r400 ≥199 [R401].",
]


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def main() -> None:
    if REG.exists():
        fail(f"register ŽE obstaja (nikoli prepisuj): {REG}")
    chunki = REPO / ".next/static/chunks"
    js = sorted(chunki.rglob("*.js"))
    if not js:
        fail("build JS čanki manjkajo — zaženi `npx next build` PREJ pred register-write (LEKCIJA R396 (7))")
    skupaj = sum(f.read_text(encoding="utf-8", errors="ignore").count(N1) for f in js)
    if skupaj != 7:
        fail(f"needle v build JS = {skupaj} (pričakovano točno ×7 — disk resnica iz builda)")
    print("OK: needle ×7 v build JS čankih (5 datotek — skelet kartice družina)")
    # dosegljivost per-vzorec (disk resnica — gladka družina)
    for podniz, pricakovano in [("shimmer rounded-lg", 5), ("animate-bounce-subtle absolute -top-0.5", 1)]:
        n = sum(f.read_text(encoding="utf-8", errors="ignore").count(podniz) for f in js)
        if n != pricakovano:
            fail(f"podniz {podniz!r} = {n} (pričakovano ×{pricakovano})")
        print(f"OK: podniz ×{pricakovano} — {podniz!r}")
    # val 72 + val 73 needleja MORATA ostati bajtno ×1 v build CSS (roki)
    css = sorted(chunki.glob("*.css"))
    if not css:
        fail("build CSS manjka")
    for star, ime in [
        (".badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}", "val 72"),
        (".animate-fade-in-up,.slide-in-right{animation:none}", "val 73"),
    ]:
        n = sum(f.read_text(encoding="utf-8").count(star) for f in css)
        if n != 1:
            fail(f"{ime} needle v build CSS = {n} (pričakovano točno ×1 — era veriga se ne sme prelomiti)")
        print(f"OK: {ime} needle bajtno nespremenjen ×1 (med-stražarski roki)")
    # 0-v-HEAD kanon (needle = NOV šiv)
    r = subprocess.run(
        ["git", "grep", "-cF", "--", N1, HEAD, "--", "src"],
        cwd=REPO, capture_output=True, text=True,
    )
    if r.returncode == 0 and r.stdout.strip():
        fail(f"needle ŽE v HEAD {HEAD} — NI šiv: {r.stdout.strip()}")
    print(f"OK: 0 v HEAD ({HEAD}) — šivni needle (tudi 0 v d8a76c5 — njihova plast NE nosi skelet žetonov)")
    vsebina = "\n".join(VRSTICE) + "\n" + "\t".join([N1, D1, "need_static"]) + "\n" + "\t".join([
        "TODO-R399", "must_miss: razvojni ostanki (nesme biti v produkcijskih čankih)", "must_miss",
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
