#!/usr/bin/env python3
# r402-register-write.py — R402 REGISTER needlejev (fail-closed, kanon
# r361/…/r401). R402 = poslovna runda (§19 INVOICE → PAYMENT →
# RECONCILIATION, issue #13 korak R170; KOLIZIJA #31/#32/#33: NJIHOVE QA
# runde R400 [6abd7b1 val 74] + R401 [35e6f12 val 75] + dopolnilo [8275bfe]
# pristale med delom → MOJA runda preimenovana R400→R402).
#
# ⭐ LEKCIJA R402 (1) — register iz PREKINJENE seje je bil zapisan s
#   PRESLEDKI namesto TAB ločili (prejšnja seja je zmanjkala konteksta sredi
#   R402): qa-round.sh Z-STRUCT-REG varuh解析a FS="\t" — presledčna oblika
#   bi dala NAPAČEN needle (celotna vrstica) in tiho napačno verifikacijo.
#   Ta skripta strukturo GLASNO normalizira (presledki → TAB), preveri VSE
#   števce IZ svežega builda (LEKCIJA R398 (4) — nikoli napovedana), 0-v-HEAD
#   kanon (d8a76c5 = R399) in med-stražarske roke (val 72/73/74/75 needleji
#   bajtno — era veriga se ne sme prelomiti). NIČ tihega.
#
# Needleji (3 need_static — strežniški stringi novih rut, vzorec r399):
#   N1 vrata POST /api/payments (403 monter)
#   N2 vrata PATCH /api/payments/[id] (403 monter)
#   N3 zavrnitev ročnega PLACAN/DELNO_PLACAN prek PATCH /api/invoices (409)
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path("/home/z/repo-analysis")
REG = REPO / "scripts/qa-needles/r402.tsv"
HEAD = "d8a76c5"  # NJIHOVA R399 (§18) = moj fetch-first start; needle = 0 v d8a76c5

# needle → (pričakovana pojavnost v buildu, plast)
NEEDLEJI = [
    ("Beleženje plačil zahteva pravico invoices.issue.", 1),
    ("Prekinitev plačila zahteva pravico invoices.issue.", 1),
    ("se izpelje iz plačil — zabeleži plačilo prek /api/payments", 1),
]
MUST_MISS = "TODO-R402"

# kanonske needle vrstice (deterministična rekonstrukcija iz prekinjene seje —
# needle STRINGI se morajo ujemati z obstoječo vsebino, sicer fail-closed)
KANONSKE_VRSTICE = [
    ("Beleženje plačil zahteva pravico invoices.issue.",
     "R402 vrata POST /api/payments — sporočilo 403 v payments chunku "
     "(×1 v build server čanku — app-route template; monter brez pravice; "
     "0 v HEAD d8a76c5 (R399))",
     "need_static"),
    ("Prekinitev plačila zahteva pravico invoices.issue.",
     "R402 vrata PATCH /api/payments/[id] — sporočilo 403 v payments/[id] "
     "chunku (×1 v build server čanku; monter; 0 v HEAD d8a76c5 (R399))",
     "need_static"),
    ("se izpelje iz plačil — zabeleži plačilo prek /api/payments",
     "R402 zavrnitev ročnega PLACAN/DELNO_PLACAN prek PATCH /api/invoices "
     "(409 z navodilom; ×1 v build server čanku — invoices route; "
     "0 v HEAD d8a76c5 (R399))",
     "need_static"),
    ("TODO-R402",
     "must_miss: razvojni ostanki (nesme biti v produkcijskih čankih)",
     "must_miss"),
]

# med-stražarski roki (era veriga NE sme prelomiti — bajtno iz builda)
ROKI = [
    (".badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}", 1, "css", "val 72"),
    (".animate-fade-in-up,.slide-in-right{animation:none}", 1, "css", "val 73"),
    ("shimmer rounded", 7, "js_client", "val 74"),
    ("color-scheme:dark", 1, "css", "val 75 (dark)"),
    ("color-scheme:light", 1, "css", "val 75 (light)"),
]


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def pojavi(needle: str, plast: str) -> int:
    """Pojavnosti v kompiliranih čankih (samo *.js/*.css — NE .map virov).
    js_client = KLIENT čanki (.next/static/chunks) — kanon val 74 (TSX
    className raba ×7; RSC strežniški dvojniki NE štejejo);
    js = klient + strežnik (API rute — kanon r399 strežniških needlejev)."""
    n = 0
    koren = REPO / ".next/static/chunks"
    if plast in ("js", "js_client", "css"):
        for f in koren.glob(f"*.{plast.removesuffix('_client')}"):
            n += f.read_text(encoding="utf-8", errors="ignore").count(needle)
    if plast == "js":  # strežniški needleji živijo v .next/server čankih
        for f in (REPO / ".next/server").rglob("*.js"):
            n += f.read_text(encoding="utf-8", errors="ignore").count(needle)
    return n


def main() -> None:
    if not REG.exists():
        fail(f"register manjka: {REG}")
    # 1) build PREJ (kanon LEKCIJA R396 (7) — runner NE builda, GLASNO preveri)
    if not (REPO / ".next/static/chunks").exists() or not (REPO / ".next/server").exists():
        fail("build čanki manjkajo — zaženi `bun run build` PREJ pred register-write (LEKCIJA R396 (7))")

    # 2) preberi obstoječi register (needle vrstice = ne-# vrstice)
    vrstice = REG.read_text(encoding="utf-8").splitlines()
    glava = [v for v in vrstice if v.startswith("#")]
    telo = [v for v in vrstice if v.strip() and not v.startswith("#")]
    if not telo:
        fail("register brez needle vrstic")

    # 3) LEKCIJA R402 (1): normalizacija presledkov → TAB (GLASNO,
    #    deterministično: vsak needle string mora obstajati v trenutni
    #    vsebini — sicer fail-closed, nič tihih zamenjav)
    normalizirano = []
    for needle, opis, kind in KANONSKE_VRSTICE:
        if not any(re.match(r"^" + re.escape(needle) + r"\s", v) or v.startswith(needle + "\t") for v in telo):
            fail(f"needle string MANJKA v obstoječem registru — nič tihih zamenjav: {needle[:48]!r}")
        normalizirano.append("\t".join([needle, opis, kind]))
    starih = len(telo)
    if starih != len(normalizirano):
        print(f"OPOMBA: telo registra {starih} vrstic -> kanonskih {len(normalizirano)}")
    popolnoma_tsv = all("\t" in v and v.split("\t")[2] in ("need_static", "must_miss") for v in telo)
    if not popolnoma_tsv:
        print(f"OK: LEKCIJA R402 (1) — {starih} vrstic rekonstruiranih v TAB obliko (GLASNO, struktura kanona)")

    # 4) struktura: 3 polja, veljavna vrsta, končna nova vrstica
    for v in normalizirano:
        polja = v.split("\t")
        if len(polja) != 3 or polja[2] not in ("need_static", "must_miss"):
            fail(f"TSV struktura: {v[:60]!r}")

    # 5) števca IZ BUILDA (LEKCIJA R398 (4))
    for needle, pricakovano in NEEDLEJI:
        n = pojavi(needle, "js")
        if n != pricakovano:
            fail(f"needle v buildu = {n} (pričakovano ×{pricakovano}): {needle!r}")
        print(f"OK: needle ×{pricakovano} v build čankih — {needle[:48]!r}…")

    # 6) must_miss čisto (TODO-R402 NESME biti v produkcijskih čankih)
    if pojavi(MUST_MISS, "js") or pojavi(MUST_MISS, "css"):
        fail(f"must_miss {MUST_MISS!r} najden v buildu — razvojni ostanek")
    print(f"OK: {MUST_MISS!r} ×0 v buildu (must_miss čisto)")

    # 7) med-stražarski roki (val 72/73/74/75 — era veriga bajtno)
    for needle, pricakovano, plast, ime in ROKI:
        n = pojavi(needle, plast)
        if n != pricakovano:
            fail(f"{ime} rok: {n} (pričakovano ×{pricakovano}) — era veriga se NE sme prelomiti")
        print(f"OK: {ime} needle ×{pricakovano} v build {plast.upper()} (rok)")

    # 8) 0-v-HEAD kanon (needle = NOV šiv R402; d8a76c5 = R399)
    for needle, _ in NEEDLEJI:
        r = subprocess.run(
            ["git", "grep", "-cF", "--", needle, HEAD, "--", "src"],
            cwd=REPO, capture_output=True, text=True,
        )
        if r.returncode == 0 and r.stdout.strip():
            fail(f"needle ŽE v HEAD {HEAD} — NI šiv: {needle!r} → {r.stdout.strip()}")
    print(f"OK: 0 v HEAD ({HEAD}) — vsi needleji so šivni za R402")

    # 9) zapiši normaliziran register (+ končna nova vrstica — Z-STRUCT-REG)
    vsebina = "\n".join(glava + normalizirano) + "\n"
    REG.write_text(vsebina, encoding="utf-8")
    st_need = sum(1 for v in normalizirano if v.endswith("\tneed_static"))
    st_miss = sum(1 for v in normalizirano if v.endswith("\tmust_miss"))
    print(f"OK: {REG} zapisan ({len(vsebina)} bajtov; need_static={st_need} + must_miss={st_miss}; TAB ločila + končna nova vrstica)")


if __name__ == "__main__":
    main()
