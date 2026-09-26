#!/bin/bash
# R157 browser E2E v2 — pravi vrstni red: prijava → orodja → top-bar + nagibi
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
setsid node .next/standalone/server.js > /tmp/r157-browser-server.log 2>&1 < /dev/null &
sleep 5

$AB open "$BASE/login" >/dev/null 2>&1
sleep 6
$AB fill 'input[type="email"]' "ci@roksal.si" >/dev/null
$AB fill 'input[type="password"]' "DimniSmoke139!" >/dev/null
$AB click 'button[type="submit"]' >/dev/null
sleep 6

echo "=== [A] Odpri Montažna orodja (orodja shell z top-bar) ==="
$AB click 'header nav button:nth-of-type(3)' >/dev/null 2>&1
sleep 5

echo "=== [B] Top-bar aria-labeli — R157 popravki živo v DOM ==="
$AB snapshot 2>&1 | grep -oE 'button "[^"]*(Preklopi|Sinhroniziraj|Obvestila)[^"]*"' | sort -u | head -6

echo "=== [C] Nagib zavihek klik ==="
$AB find text "Nagib" click >/dev/null 2>&1
sleep 4
$AB snapshot 2>&1 | grep -E 'Digitalna libela|Zabeleženi nagibi|Izvozi CSV|Izberite projekt' | head -6

echo "=== [D] Izberi projekt v comboboxu (če je) ==="
$AB snapshot 2>&1 | grep -oE 'combobox "[^"]*"' | head -3

echo "=== [E] Konzola napake ==="
$AB console 2>&1 | grep -icE "error" | xargs -I{} echo "console error vrstic: {}"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 free"; fi
