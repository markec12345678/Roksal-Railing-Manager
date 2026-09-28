#!/bin/bash
# R236 — build needleji: DOBAVITELJI PDF (3. člen 'izvozi' PDF družine —
# CSV+PDF brata v zavihku Dobavitelji + fail-verbose toasti + lib dokument +
# ENA resnica prerez CSV R233 + filename) + focus-visible prstan revizija
# (P1-f) + negativni + regresije R228–R235. Lekcije r229/r230: scope SAMO
# .next/static + .next/server; needle oblike KOMPIRIRANE (string literali
# preživijo minifikacijo); single quotes obvezni (backticki = command sub).
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

echo "--- R236 pozitivni (Dobavitelji PDF — gumb/handler) ---"
need "Izvozi dobavitelje kot PDF" "R236 PDF pill aria"
need "Dobavitelji kot pravi PDF — arhivski pregled kontaktnih in sodelovalnih podatkov" "R236 PDF pill title"
need "PDF se izvozi, ko je dodan prvi dobavitelj." "R236 fail-closed toast opis"
need "Dobavitelji PDF ni mogoče sestaviti iz tega seznama" "R236 fail-closed TypeError toast title"
need "Izvoz PDF ni uspel: " "R236 fail-verbose catch"
need "arhivski pregled kontaktnih in sodelovalnih podatkov" "R236 uspeh toast opis (delci)"
echo "--- R236 pozitivni (lib dobavitelji-pdf — dokument) ---"
need "DOBAVITELJI" "R236 PDF dokument naslov"
need "Povzetek dobaviteljev" "R236 KPI sekcija"
need "dobavitelji-" "R236 filename prefix"
need "preveriDobaviteljPdfVnos" "R236 fail-closed preverba (eksportirana)"
need "dobaviteljBeseda" "R236 sklanjatev (eksportirana)"
echo "--- R236 pozitivni (ENA resnica — prerez CSV R233) ---"
need 'Naziv","Status","Kontakt","Telefon","Email","Dobavni rok (dni)","Popust (%)","Št. cen","Št. naročil"]' "R236 tabela glava = CSV R233 (kompilirana oblika — dvojni navedki, r229 lekcija)"
need 'aktivna?"Aktiven":"Neaktiven"' "R236 Status resnica R144 (kompilirana oblika)"
need 'materialPrices!==void 0?String(' "R236 manjkajoči _count → prazna celica (kompilirana: !==undefined → !==void 0)"
echo "--- R236 pozitivni (P1-f focus-visible prstan revizija) ---"
need "press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1" "R236 invoice CSV pill navy/40"
need "bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-roksal-navy/40" "R236 Izdaj/Plačan navy/40"
need "bg-green-50 dark:bg-green-950/40 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1" "R236 Prejem navy/40"
echo "--- R236 negativni (stara odstopanja ostajajo odsotna) ---"
must_miss "focus-visible:ring-amber-500/50" "invoice CSV pill amber fokus (unikatna oblika)"
must_miss "focus-visible:ring-emerald-400/50" "Izdaj/Plačan emerald fokus (unikatna oblika)"
must_miss "focus-visible:ring-green-600/40" "Prejem green fokus (unikatna oblika)"
echo "--- regresije R229-R235 ---"
need "Prenesi naročilnico naročila pri" "R235 Naročilnica PDF pill aria"
need "Naročilnica kot pravi PDF za dobavitelja — determinističen dokument iz postavk" "R235 PDF pill title"
need "Povzetek naročila" "R235 KPI sekcija"
need "Naročilnice PDF ni mogoče sestaviti iz tega naročila" "R235 fail-closed toast"
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

echo "NEEDLE FAIL=$FAIL"
exit "$FAIL"
