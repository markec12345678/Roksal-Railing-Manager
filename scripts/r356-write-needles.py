import io

# r356.tsv — REGISTER needlejev runde R356 (measurements FAZA 9: vnos meritve
# POST orkestracija → measurements/vnos-meritve.ts [3 stale per-item tokova:
# stopniščni čarovnik batch + WPC palice batch + steber single → EN gradnik
# posljiVnosMere z diskriminiranim rezultatom uspeh/osnutek R152; 9 podvojenih
# payload literalov + 9× gps literal → ENA definicija; UI resnica v UI —
# preslikava + osnutki + toasti ostanejo v tabu, LEKCIJA R354]
# + STIL val 39: a11y parity FAZA 9 družine — 4 gumbi (steber per-segment +
# WPC palice + stopniščni čarovnik Ustvari + steber submit) aria akcija+cilj +
# title + izrecen ring navy/40+offset-2 [LEKCIJA R346 kanon; submit brez aria
# — vidno besedilo ŽE nosi cilj S#]; 0 novih hex.
# ============================================================================
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R355.
#   <needle_string><TAB><opis><TAB><vrsta>
# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)
#
# OPOMBA (vzorec R354/R355): FAZA 9 orkestracija je LOGIKA (izvozi/vnosi
# bajtno identični — isti POST kontrakt, isto telo, R152 osnutek) — NI
# build-diskriminator; needleji so STIL val 39 statične celote (aria/title
# nizi = era-diskriminatorji, NOVI nizi te runde).

rows = [
    ("Ustvari stopniščne meritve v izbrani segment", "R356 val 39 stopniščni čarovnik Ustvari aria (akcija+cilj; NOV ring navy/40)", "need_static"),
    ("Dodaj izračunane WPC palice kot meritve v segment ", "R356 val 39 WPC palice aria prefix (akcija+cilj; template literal s seg.name)", "need_static"),
    ("Odpre formo za novega stebrička, že tarčno na segment ", "R356 val 39 steber per-segment title prefix (template literal s seg.name)", "need_static"),
    ("TODO-R356", "R356 — brez razvojnih ostankov", "must_miss"),
]

with io.open("scripts/qa-needles/r356.tsv", "w", encoding="utf-8", newline="") as f:
    f.write("# qa-needles/r356.tsv — REGISTER needlejev runde R356 (FAZA 9\n")
    f.write("# orkestracija + STIL val 39). Kanon R340–R355: TSV, TAB ločilo,\n")
    f.write("# need_static = ŽIV v čankih, must_miss = NE SME biti prisoten.\n")
    f.write("# FAZA 9 ni build-diskriminator (logika, bajtni kontrakt POST)\n")
    f.write("# — needleji = val 39 statične celote.\n")
    f.write("# ============================================================================\n")
    f.write("# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R355.\n")
    f.write("#   <needle_string><TAB><opis><TAB><vrsta>\n")
    f.write("# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)\n\n")
    f.write("# ── R356 lastni needleji ──\n")
    f.write("# statične celote (NOVI nizi — era-diskriminatorji):\n")
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")

print("written scripts/qa-needles/r356.tsv")
