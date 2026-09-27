#!/bin/bash
# R211 build needleji — R211 F1/F2 + regresije (R210/R209/R208/R171).
# Diakritični nizi so v chunkih včasih ubežani → scan po BESEDAH/fragmentih.
cd /home/z/my-project
echo "--- R211 F1 (fail-verbose detail) ---"
for n in "Meritev ni bilo mogoče naložiti" "Portala ni bilo mogoče naložiti" "Merilne povezave ni bilo mogoče naložiti" "Stanja ne izmišljujemo" "Poskusi znova"; do
  c=$(rg -l --no-messages "$n" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$n => $c datotek"
done
echo "--- R211 F2 (pečat) ---"
for n in "Čas zadnje uspešne osvežitve naročil" "Osveženo ob"; do
  c=$(rg -l --no-messages "$n" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$n => $c datotek"
done
echo "--- regresije ---"
for n in "Naročila, ki čakajo na dejanje" "Zgodovina prehodov naro" "Preklic naročila" "Ni meritev za ta projekt" "Onemogočen" "Ni izdana"; do
  c=$(rg -l --no-messages "$n" .next/static/chunks/ 2>/dev/null | wc -l)
  echo "$n => $c datotek"
done
echo "--- GONE (stara tiha vrata ne smejo biti nikjer) ---"
c1=$(rg -l --no-messages "\.catch\(\(\) => setDetailMeasurements\(\[\]\)\)" .next/static/chunks/ 2>/dev/null | wc -l)
c2=$(rg -l --no-messages "\.catch\(\(\) => setPortalInfo\(null\)\)" .next/static/chunks/ 2>/dev/null | wc -l)
echo "catch-setDetailMeasurements([]) => $c1 (pričakovano 0)"
echo "catch-setPortalInfo(null) => $c2 (pričakovano 0)"
echo "R211 BUILD NEEDLEJI KONEC"
