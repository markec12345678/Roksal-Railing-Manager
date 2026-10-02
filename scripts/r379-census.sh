#!/usr/bin/env bash
# r379-census.sh — R379 disk resnica census fokus jezikov (val 59 kandidati)
# Deterministično, disk-only, BREZ mutacij. Trijaža po družinah:
#   A) ring-roksal-navy/40 brez ring-offset-2  (val 52 zaprl — pričakuj 0)
#   B) ring-roksal-navy/40 z ring-2 brez transition-colors (val 58 zaprl
#      nativni gap — pričakuj 0 nativnih; KIT nosi transition-all iz baze)
#   C) ring-roksal-navy/40 brez border paritete (val 57 zaprl measurements
#      ×22 — pričakuj 0 v measurements, išči DRUGE datoteke)
#   D) amber/50 + red/40 brez offset-2 (prejšnji census: amber 18/18 O2)
#   E) dark: ink/40 pariteta (kanon R163–R166: vsak navy/40 rabi dark:
#      border-roksal-ink/40 ko je border prisoten)
# Izhod: per-vrstica izpis z datoteka:vrstica, razvrščeno deterministično.
set -u
cd /home/z/my-project

echo "=== R379 CENSUS — fokus jezik (disk resnica) ==="
DATOTEKE=$(ls src/components/roksal/*.tsx | sort)
for F in $DATOTEKE; do
  n=$(basename "$F")
  a=$(grep -n "focus-visible:ring-roksal-navy/40" "$F" | grep -cv "ring-offset-2")
  b=$(grep -n "focus-visible:ring-roksal-navy/40" "$F" | grep "focus-visible:ring-2" | grep -cv "transition")
  c=$(grep -n "focus-visible:ring-roksal-navy/40" "$F" | grep "focus-visible:ring-2" | grep -cv "focus-visible:border")
  d=$(grep -n "focus-visible:ring-roksal-amber/50\|focus-visible:ring-roksal-red/40\|focus-visible:ring-red-500" "$F" | grep -cv "ring-offset-2")
  e=$(grep -n "focus-visible:border-roksal-navy/40" "$F" | grep -cv "dark:focus-visible:border-roksal-ink/40")
  if [ "$a" != "0" ] || [ "$b" != "0" ] || [ "$c" != "0" ] || [ "$d" != "0" ] || [ "$e" != "0" ]; then
    echo "--- $n: A(brez-offset)=$a B(brez-trans)=$b C(brez-border)=$c D(amber-red-brez-O2)=$d E(navy-brez-dark-ink)=$e"
    if [ "$a" != "0" ]; then grep -n "focus-visible:ring-roksal-navy/40" "$F" | grep -v "ring-offset-2" | cut -c1-120 | sed 's/^/   A /'; fi
    if [ "$b" != "0" ]; then grep -n "focus-visible:ring-roksal-navy/40" "$F" | grep "focus-visible:ring-2" | grep -v "transition" | cut -c1-120 | sed 's/^/   B /'; fi
    if [ "$c" != "0" ]; then grep -n "focus-visible:ring-roksal-navy/40" "$F" | grep "focus-visible:ring-2" | grep -v "focus-visible:border" | cut -c1-120 | sed 's/^/   C /'; fi
    if [ "$d" != "0" ]; then grep -n "focus-visible:ring-roksal-amber/50\|focus-visible:ring-roksal-red/40\|focus-visible:ring-red-500" "$F" | grep -v "ring-offset-2" | cut -c1-120 | sed 's/^/   D /'; fi
    if [ "$e" != "0" ]; then grep -n "focus-visible:border-roksal-navy/40" "$F" | grep -v "dark:focus-visible:border-roksal-ink/40" | cut -c1-120 | sed 's/^/   E /'; fi
  fi
done
echo "=== CENSUS KONEC ==="
