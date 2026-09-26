#!/bin/bash
# R182 byte follow-up: prijavljena seja → performance.getEntriesByType('resource')
# → aplikacijski chunki → byte needleji R181/R179/R178/R175/R174.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r182-probe
mkdir -p "$OUT"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8

for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && break
done

# Zberi VSE naložene JS chunk URL-je iz performance API (prijavljena seja = app chunki)
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | sed 's/^\[//; s/\]$//' | grep "_next" > "$OUT/app-chunks.txt"
echo "app chunkov: $(wc -l < "$OUT/app-chunks.txt")"

N1=0; N2=0; N3=0; N4=0; N5=0; N6=0
while read -r u; do
  f="$OUT/$(echo "$u" | md5sum | cut -c1-10).js"
  curl -s "$u" -o "$f" 2>/dev/null
  grep -q "api/public/version" "$f" 2>/dev/null && N1=$((N1+1))
  grep -q "Na voljo je nova verzija aplikacije." "$f" 2>/dev/null && N2=$((N2+1))
  grep -q "Seznam strank, opomniki in zgodovina sodelovanja" "$f" 2>/dev/null && N3=$((N3+1))
  grep -q "Ponovno naloži zalogo" "$f" 2>/dev/null && N4=$((N4+1))
  grep -q "Ponovno naloži seznam ekipe" "$f" 2>/dev/null && N5=$((N5+1))
  grep -q "Nekateri viri niso bilo naloženi" "$f" 2>/dev/null && N6=$((N6+1))
done < "$OUT/app-chunks.txt"
echo "R181 needle 'api/public/version': $N1 chunkov"
echo "R179 needle 'Na voljo je nova verzija…': $N2 chunkov"
echo "R178 needle 'Seznam strank, opomniki…': $N3 chunkov"
echo "R175 needle 'Ponovno naloži zalogo': $N4 chunkov"
echo "R174 needle 'Ponovno naloži seznam ekipe': $N5 chunkov"
echo "R182 needle 'Nekateri viri…' (PRIČAKOVANO 0 — R182 ni še pushan): $N6 chunkov"

agent-browser close --all > /dev/null 2>&1 || true
echo "R182 BYTE FOLLOW-UP KONEC"
