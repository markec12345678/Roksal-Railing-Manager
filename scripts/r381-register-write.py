#!/usr/bin/env python3
# r381-register-write.py — R381 fail-closed pisanje registra
# scripts/qa-needles/r380.tsv (kanon r379-register-write.py). Žigi PRED /
# PO + idempotenca (abort, če register ŽE obstaja z vsebino).
import pathlib
import sys

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r381.tsv")

VSEBINA = """# qa-needles/r381.tsv — REGISTER needlejev runde R381 (po KOLIZIJI #22 preimenovana iz R380 — kanon KOLIZIJE #4/R323/#13–#21; val 60 OSTANE val 60 — poslovne runde NE porabijo val, kanon R375) (STIL val 60:
# NATIVNI PREHOD-PARITETNI ZAKLJUČEK — 11 × INS na 8 vrsticah, in-place,
# 0 novih vrstic; kanon R380 handover kandidat 1 — B/transition-colors
# družina, nativni <button> triaža po kanonu val 58). Disk resnica
# r381-triaza.py (170 vrstic obeh barvnih družin): 154 × <Button> =
# transition-all IZ BAZE (ui/button.tsx L8) → N/A; 3 × nativni <button> =
# INS ' transition-colors' PRED ring-2; 5 × top-bar DropdownMenuItem (3
# navy + 2 red) = base (ui/dropdown-menu.tsx) BREZ transition → INS
# transition-colors, navy itemi INORE ' focus-visible:ring-offset-2'
# (val 52 pairing kanon — meni-notranja pariteta z rdečima sestro iz
# val 59); 8 × input/textarea = FROZEN izjema #2 (kanon R377).
# REGISTER EVOLUCIJA (kanon r371 N3 / R377, 3. uporaba): val 60 evoluiral
# r379 needle #1 (top-bar CMP par) → stara vrstica KOMENTIRANA 'EVOLVED
# R381 val 60' + NASLEDNICA need_static (r379 need_static = 4
# NESPREMENJEN); PIN SHIFT žigi v r372 (D) + r379 (D).
# Orodja: r381-triaza.py [element klasifikacija: <button>/<Button>/drugo
# + obe barvni družini navy+red] + r381-window-scan.py [10.
# generalizacija: TARGETS +3 tarče, REG window 380, DEL 4 in-place
# varstvo — 0 preozkih okenskih pinov pri +18 in +28; 147 needle pinov
# ŽIVIH] + r381-val60-apply.py [fail-closed scan→11 INS, idempotenca 0,
# in-place dokaz] + r381-era-ruta-map.py [FEATURE: needle→ruta mapping
# — ruta-direktno / prek-importa / probe / shared-client-chunk] +
# spot-r167/23 (R381) [val 59 POST-deploy ZELEN: N1 2/2 parity, N2 47/47
# parity (46 preklici + 1 ostali), N3/N4 iskreno 0, kolektor 0].
# KOLIZIJA #22: ob pushu — njihova poslovna R380 [2f5cb30, issue #13 R168 §12 REAL UNITS + DECIMAL + c63ee37 worklog] pristala MED mojim delom → moja runda preimenovana R380→R381; re-aplicirana na c63ee37 (fetch-first; njihovi r380-* artefakti ostanejo = njihova zgodovina).
#
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO — presledki
# znotraj needleja so POMENNI, ker grep -F išče dobesedno).
# Vrste: need_static (MORA biti ŽIV v svežem buildu) | must_miss
# (NESME biti v produkcijskih čankih).
gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2	R381 val 60 top-bar navy meni par ×3 (L239+L246+L253) — transition + offset-2 meni-notranja pariteta z rdečima sestro (0 v HEAD c63ee37)	need_static
hover:text-roksal-ink focus-visible:outline-none transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40	R381 val 60 audit-trail-dialog L310 nativni <button> — val 58 kanon INS (0 v HEAD c63ee37)	need_static
flex-1 text-left min-w-0 focus-visible:outline-none transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40	R381 val 60 measurements-tab L4020 nativni <button> 'Naloži stopnično predlogo' — val 58 kanon INS (0 v HEAD c63ee37)	need_static
hover:bg-muted hover:text-roksal-ink transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40	R381 val 60 photo-tab L2370 nativni <button> 'Uredi mero' — val 58 kanon INS (0 v HEAD c63ee37)	need_static
TODO-R381	must_miss: razvojni ostanki (nesme biti v produkcijskih cankih)	must_miss
"""

# PRED žigi
if REG.exists() and REG.read_text(encoding="utf-8").strip():
    sys.exit(f"FAILOVEDANO: register ŽE obstaja z vsebino (nikoli prepisuj): {REG}")

podatki = [l for l in VSEBINA.splitlines() if l and not l.startswith("#")]
ns = sum(1 for l in podatki if l.split("\t")[-1] == "need_static")
mm = sum(1 for l in podatki if l.split("\t")[-1] == "must_miss")
if ns != 4 or mm != 1:
    sys.exit(f"FAILOVEDANO: need_static={ns} (pričakovano 4), must_miss={mm} (pričakovano 1)")
for l in podatki:
    if len(l.split("\t")) != 3:
        sys.exit(f"FAILOVEDANO: NF≠3: {l[:60]!r}")
if "TODO-R381" not in VSEBINA:
    sys.exit("FAILOVEDANO: must_miss manjka")

REG.parent.mkdir(parents=True, exist_ok=True)
REG.write_text(VSEBINA, encoding="utf-8")

# PO žigi
out = REG.read_text(encoding="utf-8")
podatki_po = [l for l in out.splitlines() if l and not l.startswith("#")]
ns_po = sum(1 for l in podatki_po if l.split("\t")[-1] == "need_static")
if ns_po != 4:
    sys.exit(f"FAILOVEDANO: PO need_static = {ns_po} ≠ 4")
print(f"OK: {REG} zapisan ({len(out)} bajtov; need_static ×4 + must_miss ×1; NF=3 vseh)")
