#!/bin/bash
# R182 produkcija probe: R181 ŽIVO? (push 17:51:32 UTC; deploy 15-40 min —
# probe teče na koncu runde, precedens R175-R181) + regresije R174-R179.
# Fingerprinti (MONTER spot; curl + byte + DOM):
#  • P0 CURL: /api/public/version 200 {build} (dvojček — R181 P0 fix ŽIVO)
#    + /api/version 200 (artefakt lahko svež — dvopoten pokriva OBA primera);
#  • byte needle R181: 'api/public/version' v banner chunku (dvopoten klic);
#  • byte regresije: 'Na voljo je nova verzija aplikacije.' (R179),
#    'Seznam strank, opomniki in zgodovina sodelovanja' (R178),
#    'Ponovno naloži zalogo' (R175), 'Ponovno naloži seznam ekipe' (R174);
#  • DOM regresije (MONTER): CRM glava 'CRM stranke' + pečati (R178),
#    Zaloga pečat (R177), banner SKRIT na istem žigu (pravilno stanje),
#    temna rgb(15,23,36) + window.__err null;
#  • R181 ADMIN pečati (zapisnik/posli/ponudbe) NISO probani z MONTER spotom
#    (ADMIN-only površine / 403 fail-closed meje) — curl P0 dokaz je glavni
#    R181 fingerprint; DOM pečati naslednja runda z lastniškim ADMIN dostopom.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r182-probe
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

echo "--- 1) CURL: P0 dvojček + original (R181 jedro živo?) ---"
curl -s -o /dev/null -w "api/public/version status: %{http_code}\n" "$PROD/api/public/version"
ZIG=$(curl -s "$PROD/api/public/version")
echo "dvoček telo: $ZIG"
curl -s -o /dev/null -w "api/version status: %{http_code}\n" "$PROD/api/version"
curl -sI "$PROD/api/public/version" | grep -i "cache-control" || echo "(cache-control manjka)"

echo "--- 2) BYTE: R181 dvopoten needle + regresije v chunkih ---"
html=$(curl -s "$PROD/login")
echo "$html" | grep -oE '/_next/static/chunks/[^"]+\.js' | sort -u > "$OUT/chunk-urls.txt"
# aplikacijski chunki: zajemi tudi s spletnega mesta po prijavi NI mogoče brez seje —
# login chunki + dovolj: REGRESIJE so bile v R179/R180 vidne v javnih chunkih login strani
# (banner je v skupnem vendor/app chunku). Dopolni z buildManifest če obstaja:
curl -s "$PROD/" -o /dev/null
N1=0; N2=0; N3=0; N4=0; N5=0
while read -r c; do
  f="$OUT/$(basename "$c")"
  curl -s "https://roksal-railing-manager.vercel.app$c" -o "$f" 2>/dev/null
  grep -q "api/public/version" "$f" 2>/dev/null && N1=$((N1+1))
  grep -q "Na voljo je nova verzija aplikacije." "$f" 2>/dev/null && N2=$((N2+1))
  grep -q "Seznam strank, opomniki in zgodovina sodelovanja" "$f" 2>/dev/null && N3=$((N3+1))
  grep -q "Ponovno naloži zalogo" "$f" 2>/dev/null && N4=$((N4+1))
  grep -q "Ponovno naloži seznam ekipe" "$f" 2>/dev/null && N5=$((N5+1))
done < "$OUT/chunk-urls.txt"
echo "needle 'api/public/version' (R181 dvopoten): $N1 chunkov"
echo "needle 'Na voljo je nova verzija aplikacije.' (R179): $N2 chunkov"
echo "needle 'Seznam strank, opomniki…' (R178): $N3 chunkov"
echo "needle 'Ponovno naloži zalogo' (R175): $N4 chunkov"
echo "needle 'Ponovno naloži seznam ekipe' (R174): $N5 chunkov"

echo "--- 3) DOM (MONTER spot): CRM pečati + Zaloga + temna + __err ---"
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
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
done

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "-- CRM: glava 'CRM stranke' + pečati (R178 regresija) --"
agent-browser eval "$VECPOMOC" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM')||b.textContent.trim().includes('CRM')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='CRM stranke'); const pecati=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({crmGlava: !!glava, pečatiVidni: pecati.length, errorPaneli: err});})()" 2>&1 | tail -1

echo "-- Zaloga: pečat (R177 regresija) --"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('Zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({zalogaPecat: p?p.textContent.trim():null, errorPaneli: err});})()" 2>&1 | tail -1

echo "-- Banner SKRIT na trenutnem žigu (pravilno stanje) + temna + __err --"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()==='Na voljo je nova verzija aplikacije.'); return JSON.stringify({bannerViden: !!b});})()" 2>&1 | tail -1
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pageBg: getComputedStyle(document.body).backgroundColor, pecatBarva: p?getComputedStyle(p).color:null});})()" 2>&1 | tail -1
agent-browser eval "JSON.stringify({err: window.__err ?? null})" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r182-prod-temna.png > /dev/null 2>&1 && echo "screenshot PROD TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
echo "R182 PROD PROBE KONEC"
