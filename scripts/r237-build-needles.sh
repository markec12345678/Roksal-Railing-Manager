#!/bin/bash
# R237 — build needleji: NAROČILNICA OSNUTEK PDF (4. člen 'izvozi' PDF
# družine — dialog gumb PDF + fail-verbose sonner + lib dokument + ENA
# resnica prerez CSV R205 + filename) + fokus revizija 2. faza (P1-f —
# 14 konverzij + skripta fokus family) + negativni + regresije R227–R236.
set -u
cd /home/z/my-project
FAIL=0

need() {
  if grep -rqF -- "$1" .next/static .next/server 2>/dev/null; then
    echo "OK   : $2"
  else
    echo "MISS : $2  (needle: $1)"
    FAIL=1
  fi
}

must_miss() {
  if grep -rqF -- "$1" .next/static 2>/dev/null; then
    echo "MISS : $2  ŠE VEDNO v static čankih (needle: $1)"; FAIL=1
  else
    echo "OK   : $2 (izginil — pravilno)"
  fi
}

echo "--- R237 pozitivni (Osnutek PDF — gumb/handler) ---"
need "Prenesi naročilnico vidnih artiklov kot PDF" "R237 dialog PDF gumb aria"
need "Naročilnica osnutka kot pravi PDF — interni pregled pred pošiljanjem" "R237 dialog PDF gumb title"
need "Osnutka PDF ni mogoče sestaviti iz teh artiklov" "R237 fail-closed TypeError toast"
need "Izvoz PDF ni uspel: " "R237 fail-verbose catch (sonner)"
need "interni pregled pred pošiljanjem" "R237 uspeh toast opis (delci)"
echo "--- R237 pozitivni (lib osnutek-pdf — dokument) ---"
need "NAROČILNICA OSNUTEK" "R237 PDF dokument naslov"
need "Povzetek osnutka" "R237 KPI sekcija"
need "osnutek-narocilnica-" "R237 filename prefix"
need "osnutekPdfFilename" "R237 filename funkcija (eksportirana)"
need "Interni dokument — priprava naročilnega osnutka" "R237 interni podnaslov"
echo "--- R237 pozitivni (ENA resnica — prerez CSV R205) ---"
need 'Šifra","Naziv","Enota","Zaloga","Min. zaloga","Naroči"]' "R237 tabela glava = CSV R205 (kompilirana oblika — dvojni navedki, r229 lekcija)"
echo "--- R237 pozitivni (P1-f fokus revizija 2. faza — 14 konverzij) ---"
need "focus-visible:ring-2 focus-visible:ring-roksal-navy/40" "R237 navy/40 fokus (konverzirane vrstice)"
need "focus-visible:ring-offset-2 transition-colors" "R237 dashboard navy gumb fokus [PIN SHIFT R370 val 53: offset-1→2 navy rep normalizacija; vrstica zdaj 2666]"
echo "--- R237 negativni (osamljeni amber fokus ostajajo odsotni) ---"
must_miss "focus-visible:ring-roksal-amber/70" "deal-pipeline slider amber fokus (unikatna oblika)"
# OPOMBA: notification-center:653 ring amber/60+/40 je AMBER-TEMA vrstica
# (border-roksal-amber/40 non-ring token) — strukturna izjema skripte,
# legalno ostane — must_miss zato NE gre (r236 lekcija: per-kontekst dokaz).
echo "--- regresije R227-R236 ---"
need "Prenesi naročilnico naročila pri" "R235 Naročilnica PDF pill aria"
need "Naročilnica kot pravi PDF za dobavitelja — determinističen dokument iz postavk" "R235 pill title"
need "Povzetek naročila" "R235 KPI sekcija"
need "Izvozi dobavitelje kot PDF" "R236 Dobavitelji PDF pill aria"
need "Dobavitelji kot pravi PDF — arhivski pregled kontaktnih in sodelovalnih podatkov" "R236 pill title"
need "Dobavitelji PDF ni mogoče sestaviti iz tega seznama" "R236 fail-closed toast"
need "Izvozi vidno zalogo kot PDF" "R234 Zaloga PDF gumb aria"
need "STANJE ZALOGE" "R234 PDF dokument naslov"
need "Izvozi dobavitelje kot CSV" "R233 Dobavitelji CSV gumb"
need "Ni dobaviteljev za izvoz" "R233 fail-closed toast"
need '"Opombe","Pretekel rok"]' "R231 CSV glava ZADNJI stolpec"
need "Izvozi naročila kot CSV" "R231/R232 naročila CSV gumb"
need "Ni naročil za izvoz" "R232 fail-closed toast"
need "NEAKTIVEN:\"bg-muted text-muted-foreground border-border\"" "R234 crm NEAKTIVEN žetoni"
need "UPOKOJENO:\"bg-muted text-muted-foreground border-border\"" "R234 logistics UPOKOJENO žetoni"
need "bg-muted border border-border p-2 text-center" "R235 status števec žetoni"
need "border-border bg-muted text-muted-foreground cursor-not-allowed" "R235 glasovni disabled žetoni"
need "bg-roksal-navy text-white hover:bg-roksal-navy/90" "R232 cv-studio bbox žeton"
need "bg-muted text-roksal-ink" "R229 Inox chip žeton"
need "Zamujena dobava (" "R230 Domov kartica aria (delci)"
need '"Opozorila","Zamujena dobava"' "R228 vodja CSV vrstica"
need "— brez vpisane nabavne cene" "R227 naročilnica oznaka"
need "bg-muted text-muted-foreground border-border line-through" "R234 measurements ARHIVIRANA žeton"

echo "NEEDLE FAIL=$FAIL"
exit "$FAIL"
