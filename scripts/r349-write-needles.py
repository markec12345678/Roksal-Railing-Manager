#!/usr/bin/env python3
# r349-write-needles.py — r349.tsv (kanon R340–R348; python write z eksplicitnim
# \t — LEKCIJA R346 1; val 32 needleji = STATIČNI PREDPoni deli template
# literalov — minifikacija ohrani statični kos kot string literal).
rows = [
    ("Naloži predlogo meritev: ", "R349 val 32 predloga apply aria (statični predponi del template literala)", "need_static"),
    ("Naloži predlogo — zapolni vnosni obrazec z vrednostmi predloge", "R349 val 32 predloga apply title (statičen niz)", "need_static"),
    ("Hitro dodaj novo meritev vrste ", "R349 val 32 quick add title (statični predponi del, ×2 mesti)", "need_static"),
    ("Nova meritev: ", "R349 val 32 quick add aria (statični predponi del, ×2 mesti)", "need_static"),
    ("Nastavi glavno enoto: ", "R349 val 32 enota toggle aria (statični predponi del)", "need_static"),
    ("Glavna enota vseh vnosnih in prikaznih polj meritev", "R349 val 32 enota toggle title (statičen niz)", "need_static"),
    ("Naloži stopnično predlogo: ", "R349 val 32 stopnična predloga aria (statični predponi del)", "need_static"),
    ("Naloži stopnično predlogo v vnosni obrazec", "R349 val 32 stopnična predloga title (statičen niz)", "need_static"),
    ("TODO-R349", "R349 — brez razvojnih ostankov", "must_miss"),
]
header = """# qa-needles/r349.tsv — REGISTER needlejev runde R349 (measurements FAZA 6:
# EN VIR fetch + fail-verbose DTO pruning terenskih izvozov →
# measurements/teren-vnosi.ts [3 stale telesa R269/R284/R285 → 1 gradnik z
# dialektnim stikalom zKotom — vzorec FAZA 5/RA348 + kalkulator FAZA 5–7]
# + STIL val 32: a11y parity akcijskih gumbov meritev, kjer vidno besedilo
# NE razlaga akcije [predloga apply / quick add ×2 / enota / stopnična
# predloga] + izrecen navy/40 ring V ISTEM commitu — LEKCIJA R346 kanon).
# ============================================================================
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO — presledki znotraj
# needleja so POMENNI, ker grep -F išče dobesedno) — kanon R340–R348.
#   <needle_string><TAB><opis><TAB><vrsta>
# vrsta:
#   need_static  — niz MORA biti ŽIV v čankih (grep -rqF po .next/static/chunks
#                  + .next/server, kopiranih v /tmp/r349-build-chunks)
#   must_miss    — niz NE SME biti prisoten (razvojni ostanki)
#
# ── R349 lastni needleji ──
# FAZA 6 je premik bajtno identičnih/stale teles v EN VIR modul → NI
# edinstvenega needleja za SAM premik (iskrena omejitev: pokritost = tsc +
# vitest r349-meritve-faza6 ×19 + E2E regresija).
# STIL val 32: aria/title so TEMPLATE literali — minifikacija ohrani STATIČNI
# kos kot string literal; needleji so statični predponi deli/diskriminatorni
# celoti ( SAMO NOVI — parity nizi val 28–31 so že v registrh r345–r348 ):
"""
with open("scripts/qa-needles/r349.tsv", "w", encoding="utf-8") as f:
    f.write(header)
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")
print("r349.tsv zapisan:", len(rows), "vrstic")
