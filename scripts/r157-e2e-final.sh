#!/bin/bash
# R157 browser E2E FINAL — prijava → orodja → izbira projekta → Nagib → Izvozi CSV
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
AB="agent-browser"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r157-bf.log 2>&1 < /dev/null &
sleep 5

# seja iz prejšnjih klicev je še vedno v piškotku — odpri direktno aplikacijo
$AB open "$BASE/" >/dev/null 2>&1
sleep 8
# če je prijava, se prijavi
if $AB snapshot 2>/dev/null | grep -q 'Prijava za monterje'; then
  $AB fill 'input[type="email"]' "ci@roksal.si" >/dev/null
  $AB fill 'input[type="password"]' "DimniSmoke139!" >/dev/null
  $AB click 'button[type="submit"]' >/dev/null
  sleep 6
fi

# orodja (CSS selektor — refi so nestabilni med re-renderji)
$AB click 'header nav button:nth-of-type(3)' >/dev/null 2>&1
sleep 6
$AB snapshot > /tmp/r157-final-tools.txt 2>&1
grep -c "Nagib" /tmp/r157-final-tools.txt | xargs -I{} echo "Nagib omenjeno: {}x"

# Domov zavihek → izberi prvi projekt (kartica)
$AB find text "Domov" click >/dev/null 2>&1
sleep 3
$AB snapshot > /tmp/r157-final-domov.txt 2>&1
PROJ_REF=$(grep -oE 'generic "[^"]*R1[0-9]+[^"]*" \[ref=([a-z0-9]+)\]' /tmp/r157-final-domov.txt | grep -oE 'ref=[a-z0-9]+' | head -1 | cut -d= -f2)
echo "projekt ref: $PROJ_REF"
if [ -n "$PROJ_REF" ]; then $AB click "@$PROJ_REF" >/dev/null 2>&1; sleep 2; fi

# Nagib zavihek (zadnji "Nagib" gumb v orodjarni = tab bar)
NAGIB_REF=$(grep -oE 'button "Nagib" \[ref=([a-z0-9]+)\]' /tmp/r157-final-tools.txt | grep -oE 'ref=[a-z0-9]+' | head -1 | cut -d= -f2)
echo "nagib ref: $NAGIB_REF"
if [ -n "$NAGIB_REF" ]; then
  $AB click "@$NAGIB_REF" >/dev/null 2>&1
  sleep 4
  echo "=== Nagib tab vsebina ==="
  $AB snapshot 2>&1 | grep -E 'Digitalna libela|Zabeleženi nagibi|Izvozi CSV|Izberite projekt|Ni še zabeleženih' | head -6
else
  echo "Nagib gumb ni bil najden v orodjarni"
fi

echo "=== Konzola napake ==="
$AB console 2>&1 | grep -icE "error" | xargs -I{} echo "console error vrstic: {}"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 free"; fi
