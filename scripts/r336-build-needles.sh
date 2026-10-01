#!/bin/bash
# R336 — build needleji: 63. ČLEN issue #1 «IZVOZI» — SISTEM ZDRAVJE CSV
# (CSV brat zaslona SistemZdravjeCard R187/R188/R189 — ZADNJA vodja kartica
# brez izvoza: NOVI lib sistem-zdravje-csv — EN VIR: ISTA seja zgodovina
# [zdravje-zgodovina] + ISTI odziviStatistika izračun [divergenca nemogoča]
# + ISTI zigIzpis klic kot kartica + BAZA_NIZ kartica UVAŽA [precedens R335
# STATUS_SL: const → export, zero-behavior]; BREZ časa — kanon R334
# brez-časa [statičen izvoz te seje: isti zgodovina + build = bajtno
# identična datoteka, nič 'Izvoženo ob']; filename sistem-zdravje.csv —
# brez datuma, bratska simetrija z koncna-verifikacija.csv; format kanon
# R136 toCsv [BOM + podpičje + CRLF + RFC 4180]; fail-closed kanon R299;
# pill navy/40 družina [val20 Material precedens — gumb v SESTAVLJENI
# kartici sistem-zdravje-card.tsx, izven vodja datoteke → amber/50 register
# OSTANE ×10, val8 drevo 68 → 69, val9 taktilni ×17 NEPREMIKNJEN — file-
# scoped]; STIL val 23) +
# DEDOVINA 62. člena (R335 mesečno poročilo vodje CSV needleji ostajajo v
# verigi) + DEDOVINA 61. člena (R334 končna verifikacija CSV needleji
# ostajajo v verigi) + DEDOVINA 60. člena (R333 pozicija dobaviteljev CSV
# needleji ostajajo v verigi) +
# 🩺 OBNOVA R324 bloka (52. člen dnevni PDF — izpadel iz verige v
# KOLIZIJI #5+#6 dvakratnem preimenovanju: r324-build-needles prekrit z
# dekompozicijo FAZA 2 — UNION harvest kanon: noben generacijski needle
# se ne sme tiho izgubiti) + DEDOVINA vzporedne R325 (PRIROJENIŠKA
# dekompozicija FAZA 2 — measurements 7.604 → 7.153 laserski BT blok +
# calculator 5.372 → 4.846 PDF izvozi; KOLIZIJA #7: moja runda
# preimenovana R325→R326 po kanonu LEKCIJA 1):
#   (a) MEASUREMENTS-TAB FAZA 2 (lastniška prioriteta #1 laserski BT blok +
#       #2 template localStorage blok): 7.604 → 7.153 vrstic (−451); NOV
#       v src/components/roksal/measurements/ ×4 datotek/594 vrstic:
#       laser-bt.ts (Web Bluetooth tipi + LASER konstante + 3 pomožne —
#       ČIST PREMIK bajtno identično, edina sprememba export) +
#       use-laser.ts (stanje + GATT povezava + odklop + auto-reconnect —
#       REFAKTOR: edina semantična sprememba = polnjenje forme prek
#       onMeasurement povratnega klica namesto neposrednih setState;
#       + mikrotask vzorec PwaStatus za začetna branja — omejitev pravila
#       react-hooks/set-state-in-effect, prej skrito z bailoutom compiler
#       analize na 7,6k vrstični datoteki) + laser-panel.tsx (UI blok — ČIST
#       PREMIK s props) + templates.ts (PREDLOGE + StairTemplate/StairCalc +
#       WPC konstante + loadStairTemplates/saveStairTemplates — ČIST PREMIK).
#       Osiroteli lucide uvozi odstranjeni (Bluetooth/Radio/Unplug — preverjeno
#       s štetjem POJAVITVE, kanon R322).
#   (b) CALCULATOR-TAB FAZA 2 (PDF izvozi): 5.372 → 4.846 vrstic (−526);
#       NOV src/components/roksal/calculator/pdf-exports.ts/647 vrstic —
#       5 PDF funkcij (predloga vrtanja / materialni list / razrezni list
#       CNC / vetrno poročilo / steklena balustrada) REFAKTOR: telesa
#       VERBATIM, closure dostop do stanja → eksplicitni args objekti
#       (čiste projekcije posredovanega stanja); tipa CncSegment +
#       GlassType preseljena iz telesa komponente; osirotela jsPDF/autoTable
#       uvoza odstranjena iz glavne datoteke.
#   POZITIVNI needleji (build): premaknjena vsebina ŽIVA v čankih kljub
#   spremembi bivališča (regresijska zaščita dekompozicije — vsebina bajtno
#   identična/refaktorirana, mapa nova; string literali preživijo
#   minifikacijo).
#   MUST_MISS (build): TODO-R323 (brez razvojnih ostankov).
#   + (1) regresije: r323-build-needles.sh [VZPOREDNA runda — 51. člen CSV
#   zmogljivost ×2+1 + delegirana veriga r322→r321[vzporedna]→R320→…→R227 —
#   DELEGACIJA; red: r323 → r322 → r321 → …].
# LEKCIJA R289/R299-R321 (ASCII kanon): needleji = ASCII/UTF-8 string
# literali; komentarji odstranjeni v buildu. Build PREJ pred needleji.
set -u
cd /home/z/my-project
OUT=/tmp/r336-build-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

# --- AWK strukturna preverba (r270 lekcija 2; r296-r322 vzorec) ---
STRUCT=$(awk '
  /^need_static\(\)/      { infn=1; needdef=1; next }
  /^must_miss\(\)/        { infn=1; next }
  infn && /^\}/           { infn=0; next }
  infn                    { next }
  infn==0 && /^find /     { loop=1; next }
  infn==0 && loop==1 && /^done$/ { loop=0; next }
  infn==0 && loop==1 && (/^need_static / || /^must_miss /) { c1++; next }
  infn==0 && !needdef && (/^need_static / || /^must_miss /) { c2++; next }
  END { print (c1+0) "/" (c2+0) }
' "$0")
echo "=== Z-STRUCT: needleji v loopu / pred definicijo = $STRUCT (mora biti 0/0) ==="
[ "$STRUCT" = "0/0" ] || { echo "STRUKTURNA NAPAKA — abort"; exit 1; }

find .next/static/chunks .next/server -name '*.js' -type f | while read -r f; do
  cp "$f" "$OUT/$(echo "$f" | md5sum | cut -c1-12)-$(basename "$f")"
done
echo "  cankov: $(ls "$OUT"/*.js 2>/dev/null | wc -l)"

FAIL=0
need_static() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "HIT  : $2 (needle: $1 — NE SME BITI!)"; FAIL=1; else echo "OK   : $2 (odsoten)"; fi
}

echo "--- R325 MANDATORY — dekompozicija faza 2: premaknjena vsebina ŽIVA v čankih ---"
echo "--- (a) measurements: laserski BT blok + template localStorage blok ---"
need_static "0000feff-0000-1000-8000-00805f9b34fb" "R325 laser-bt.ts Leica DISTO service UUID (premik živ)"
need_static "Poveži laserski daljinec preko Web Bluetooth" "R325 laser-panel.tsx tooltip besedilo (premik živ)"
need_static "Poslušam meritve... Pošlji mero z gumbom na daljincu" "R325 laser-panel.tsx statusno besedilo (premik živ)"
need_static "Mera iz laserja: " "R325 use-laser.ts toast ob prejeti meri (premik živ)"
need_static "Standardni balkon 3m" "R325 templates.ts PREDLOGE naziv (premik živ)"
need_static "L-oblika 4+2m" "R325 templates.ts PREDLOGE naziv (premik živ)"
echo "--- (b) calculator: PDF izvozi (5 funkcij → pdf-exports.ts) ---"
need_static "ROKSAL — Predloga vrtanja" "R325 pdf-exports.ts naslov baluster PDF (premik živ)"
need_static "ROKSAL — Razrezni list CNC" "R325 pdf-exports.ts naslov CNC PDF (premik živ)"
need_static "ROKSAL — Steklena balustrada specifikacija" "R325 pdf-exports.ts naslov steklo PDF (premik živ)"
echo "--- R324 MANDATORY — 52. člen: izvoz dnevnega pregleda vodje kot PDF (IZVOZI družina) — OBNOVLJEN (izpadel v KOLIZIJI #5+#6; UNION harvest kanon) ---"
need_static "Izvozi dnevni pregled vodje kot PDF" "R324 dnevni PDF izvoz gumb aria (vodja chunk)"
need_static "pregled-vodje_" "R324 dnevni PDF izvoz filename prefix (vodja-dnevni-pdf lib)"
echo "--- R324 must_miss (negativni) ---"
must_miss "TODO-R324" "R324 — brez razvojnih ostankov"
echo "R324 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R325 must_miss (negativni) ---"
must_miss "TODO-R325" "R325 — brez razvojnih ostankov"
echo "R325 lastni needleji: FAIL=$FAIL (9 premik + 1 must_miss)"
echo "--- R326 MANDATORY — 53. člen: zgodovina cen materiala (price history; issue #1 §5) ---"
need_static "Zgodovina cen materiala" "R326 panel naslov (cena-zgodovina chunk)"
need_static "Izvozi zgodovino cen materiala kot CSV" "R326 CSV izvoz gumb aria (panel chunk)"
need_static "zgodovina-cen.csv" "R326 CSV izvoz filename (panel handler)"
echo "--- R326 must_miss (negativni) ---"
must_miss "TODO-R326" "R326 — brez razvojnih ostankov"
echo "R326 lastni needleji: FAIL=$FAIL (3 izvoz + 1 must_miss)"
echo "--- R327 MANDATORY — 54. člen: zgodovina cen materiala PDF izvoz (IZVOZI družina — PDF brat CSV-ju) ---"
need_static "Izvozi zgodovino cen materiala kot PDF" "R327 PDF izvoz gumb aria (panel chunk)"
need_static "zgodovina-cen.pdf" "R327 PDF izvoz filename (cena-zgodovina-pdf lib)"
echo "--- R327 must_miss (negativni) ---"
must_miss "TODO-R327" "R327 — brez razvojnih ostankov"
echo "R327 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R328 MANDATORY — 55. člen: primerjava dobaviteljev (§5 supplier comparison — IZVOZI družina) ---"
need_static "Izvozi primerjavo dobaviteljev kot CSV" "R328 primerjava dobaviteljev CSV gumb aria (panel chunk)"
need_static "PRIMERJAVA_DOBAVITELJEV" "R328 primerjava dobaviteljev VIR niz (cena-dobavitelji lib)"
echo "--- R328 must_miss (negativni) ---"
must_miss "TODO-R328" "R328 — brez razvojnih ostankov"
echo "R328 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R329 MANDATORY — 56. člen: primerjava dobaviteljev PDF izvoz (IZVOZI družina — PDF brat CSV-ju R328) ---"
need_static "Izvozi primerjavo dobaviteljev kot PDF" "R329 primerjava dobaviteljev PDF gumb aria (panel chunk)"
need_static "primerjava-dobaviteljev.pdf" "R329 PDF izvoz filename (cena-dobavitelji-pdf lib)"
echo "--- R329 must_miss (negativni) ---"
must_miss "TODO-R329" "R329 — brez razvojnih ostankov"
echo "R329 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R330 MANDATORY — 57. člen: pregled projektov in terminov CSV izvoz (IZVOZI družina — CSV brat PDF R265) ---"
need_static "Izvozi pregled projektov in terminov kot CSV" "R330 projekti-termini CSV gumb aria (logistics chunk)"
need_static "projekti-termini-csv-pill" "R330 projekti-termini CSV gumb testid (logistics chunk)"
echo "--- R330 must_miss (negativni) ---"
must_miss "TODO-R330" "R330 — brez razvojnih ostankov"
echo "R330 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R331 MANDATORY — 58. člen: pregled spomnikov ponudb CSV izvoz (IZVOZI družina — CSV brat PDF R267) ---"
need_static "Izvozi pregled spomnikov ponudb kot CSV" "R331 ponudbe-spomniki CSV gumb aria (quote-followup chunk)"
need_static "ponudbe-spomniki-csv-pill" "R331 ponudbe-spomniki CSV gumb testid (quote-followup chunk)"
echo "--- R331 must_miss (negativni) ---"
must_miss "TODO-R331" "R331 — brez razvojnih ostankov"
echo "R331 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R332 MANDATORY — 59. člen: potekli opomniki CSV izvoz (IZVOZI družina — CSV brat PDF R252) ---"
need_static "Izvozi potekle opomnike kot CSV" "R332 potekli opomniki CSV gumb aria (crm-tab chunk)"
need_static "potekli-opomniki-csv-pill" "R332 potekli opomniki CSV gumb testid (crm-tab chunk)"
echo "--- R332 must_miss (negativni) ---"
must_miss "TODO-R332" "R332 — brez razvojnih ostankov"
echo "R332 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R333 MANDATORY — 60. člen: pozicija dobaviteljev CSV izvoz (IZVOZI družina — CSV brat PDF R264) ---"
need_static "Izvozi pozicijo dobaviteljev kot CSV" "R333 pozicija dobaviteljev CSV gumb aria (material chunk)"
need_static "pozicija-dobaviteljev-csv-pill" "R333 pozicija dobaviteljev CSV gumb testid (material chunk)"
echo "--- R333 must_miss (negativni) ---"
must_miss "TODO-R333" "R333 — brez razvojnih ostankov"
echo "R333 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R334 MANDATORY — 61. člen: končna verifikacija CSV izvoz (IZVOZI družina — CSV brat JSON R316 + PDF R320, izvozna TRIADA) ---"
need_static "Izvozi poročilo končne verifikacije kot CSV" "R334 končna verifikacija CSV gumb aria (vodja chunk)"
need_static "koncna-verifikacija-csv-pill" "R334 končna verifikacija CSV gumb testid (vodja chunk)"
echo "--- R334 must_miss (negativni) ---"
must_miss "TODO-R334" "R334 — brez razvojnih ostankov"
echo "R334 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R335 MANDATORY — 62. člen: mesečno poročilo vodje CSV izvoz (IZVOZI družina — CSV brat Poročilo PDF rundi M, EN VIR mesecniPregledData) ---"
need_static "Izvozi mesečno poročilo vodje kot CSV" "R335 mesečno poročilo CSV gumb aria (vodja chunk)"
need_static "vodja-mesecni-csv-pill" "R335 mesečno poročilo CSV gumb testid (vodja chunk)"
echo "--- R335 must_miss (negativni) ---"
must_miss "TODO-R335" "R335 — brez razvojnih ostankov"
echo "--- R336 MANDATORY — 63. člen: sistem zdravje CSV izvoz (IZVOZI družina — CSV brat zaslona SistemZdravjeCard, EN VIR seja zgodovina + odziviStatistika) ---"
need_static "Izvozi sistem zdravje kot CSV" "R336 sistem zdravje CSV gumb aria (sistem-zdravje-card chunk)"
need_static "sistem-zdravje-csv-pill" "R336 sistem zdravje CSV gumb testid (sistem-zdravje-card chunk)"
echo "--- R336 must_miss (negativni) ---"
must_miss "TODO-R336" "R336 — brez razvojnih ostankov"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R335 mesečno poročilo vodje CSV + R334 končna verifikacija CSV + R333 pozicija dobaviteljev CSV + R332 potekli opomniki CSV + R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="
REG=0
bash scripts/r324-build-needles.sh || REG=1
if [ "$REG" = "1" ]; then echo "REGRESIJA FAIL"; exit 1; fi
if [ "$FAIL" = "1" ]; then echo "R336 NEEDLEJI FAIL"; exit 1; fi
echo "=== R336 BUILD NEEDLES VSE OK ==="
