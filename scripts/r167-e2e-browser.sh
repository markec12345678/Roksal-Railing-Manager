#!/bin/bash
# R167 E2E (lokalni build): TerminiCard nova funkcionalnost.
# ADMIN (ci@roksal.si / DimniSmoke139! — precedens R165/R166):
#  1) kartica živa; 2) "Samo moje" stikalo (aria-pressed oba stanja);
#  3) Kopiraj gumbi v DOM; 4) klik na kopiraj → odložišče vsebuje
#     deterministično besedilo (buildTerminShareText prek intercepta);
#  5) filter obnašanje: moj termin ostane; 6) temna tema; 7) konzola čista.
# NAUČEK R157/R166: celoten flow v ENEM bash klicu (procesi ne preživijo).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r167-e2e-server.log 2>&1 < /dev/null &
sleep 5
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/login

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- E2E 1: TerminiCard živa + R167 stikalo + kopiraj gumbi v DOM ---"
agent-browser eval "(()=>{const naslov=[...document.querySelectorAll('[data-slot=card-title]')].find(x=>(x.textContent||'').includes('Termini — naslednjih 7 dni')); const samoMoje=document.querySelector('button[aria-label=\"Samo moje termine\"]'); const kopiraji=[...document.querySelectorAll('button[aria-label^=\"Kopiraj podrobnosti termina\"]')]; return JSON.stringify({naslov: !!naslov, samoMojeStikalo: !!samoMoje, pritisnjeno: samoMoje?samoMoje.getAttribute('aria-pressed'):null, kopirajGumbi: kopiraji.length});})()" 2>&1 | tail -1

echo "--- E2E 2: intercept odložišča + klik kopiraj → deterministično besedilo ---"
agent-browser eval "(()=>{navigator.clipboard.writeText=(t)=>{window.__r167copied=t;return Promise.resolve();}; return 'intercept postavljen';})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label^=\"Kopiraj podrobnosti termina\"]'); if(!b) return 'ni gumba'; b.click(); return b.getAttribute('aria-label');})()" 2>&1 | tail -1
sleep 2
agent-browser eval "JSON.stringify({kopirano: window.__r167copied ? window.__r167copied.split('\\n').slice(0,3) : null, vrstic: window.__r167copied ? window.__r167copied.split('\\n').length : 0})" 2>&1 | tail -1

echo "--- E2E 3: stanje pred filtrom (število vrstic v kartici) ---"
agent-browser eval "(()=>{const kartica=[...document.querySelectorAll('[data-slot=card]')].find(c=>(c.textContent||'').includes('Termini — naslednjih 7 dni')); if(!kartica) return 'ni kartice'; const vrstice=kartica.querySelectorAll('button[aria-label^=\"Kopiraj podrobnosti termina\"]').length; const moja=(kartica.textContent||'').includes('Moja montaža'); return JSON.stringify({vrstice: vrstice, mojaMontazaVidna: moja});})()" 2>&1 | tail -1

echo "--- E2E 4: klik 'Samo moje' → aria-pressed true, moj termin ostane ---"
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Samo moje termine\"]'); if(!b) return 'ni stikala'; b.click(); return 'kliknjeno';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Samo moje termine\"]'); const kartica=[...document.querySelectorAll('[data-slot=card]')].find(c=>(c.textContent||'').includes('Termini — naslednjih 7 dni')); return JSON.stringify({pritisnjeno: b?b.getAttribute('aria-pressed'):null, mojaMontazaVidna: kartica?(kartica.textContent||'').includes('Moja montaža'):null, praznoBesedilo: kartica?(kartica.textContent||'').includes('Ni vaših terminov'):null});})()" 2>&1 | tail -1

echo "--- E2E 5: temna tema + screenshot ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const opake=[...document.querySelectorAll('[class*=bg-white]')].filter(el=>!/bg-white\\//.test(el.className)); const stikalo=document.querySelector('button[aria-label=\"Samo moje termine\"]'); return JSON.stringify({bodyBg: getComputedStyle(document.body).backgroundColor, opakaBelaPovrsina: opake.length, stikaloBg: stikalo?getComputedStyle(stikalo).backgroundColor:null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r167-local-termini-filtri.png > /dev/null 2>&1 && echo "screenshot OK"

echo "--- E2E 6: konzola + pospravljanje ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep -c ':3100' || echo "port 3100 sproščen"
rm -f /tmp/r167-e2e-server.log
echo "R167 E2E KONEC"
