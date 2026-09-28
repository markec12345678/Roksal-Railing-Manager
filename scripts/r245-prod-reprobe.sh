#!/bin/bash
# R245 prod reprobe — 3 ozki repriberi po prvi rundi:
# (1) Logistika → pod-zavihek OPREMA: vodič 'Pregled opreme je samo za branje'
#     + note aria (subtab pogoj — prvi pregled je gledal privzeti podzavihek);
# (2) Meritve: 'Shrani meritev' CTA press-scale needle;
# (3) Ekipa: 'Povabi' CTA press-scale needle.
# Vse samo za branje — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== R1: Logistika → OPREMA podzavihek — vodič + note aria ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Termini montaž');})()" 24
sleep 2
# klik na podzavihek Oprema (r199/r200 Radix vzorec — poišči gumb z besedilom Oprema)
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('Oprema')); if(!b) return 'ni podzavihka Oprema'; const r=b.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o)); b.dispatchEvent(new MouseEvent('click',o)); return 'klik Oprema';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Pregled opreme je samo za branje');})()" 14
sleep 1
agent-browser eval "(()=>{const b=document.body.textContent; const vodic=b.includes('Pregled opreme je samo za branje'); const pravica=b.includes('production.manage'); const noteO=[...document.querySelectorAll('[role=\"note\"]')].some(n=>(n.getAttribute('aria-label')||'').includes('Upravljanje opreme zahteva pravico')); const novO=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().includes('Nova oprema')); return JSON.stringify({vodicOpremaViden:vodic, pravicaVidna:pravica, noteOpremaAria:noteO, novaOpremaOdsotna:!novO, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r245-prod-oprema-subtab.png" > /dev/null 2>&1

echo "=== R2: Meritve — 'Shrani meritev' press-scale needle ==="
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 4
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().includes('Shrani meritev')); if(!b) return JSON.stringify({gumb:false, err:window.__err??null}); return JSON.stringify({gumb:true, pressScale:b.className.includes('press-scale'), needle:b.className.includes('flex-1 h-9 bg-roksal-navy hover:bg-roksal-navy/90 text-white press-scale'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r245-prod-meritve.png" > /dev/null 2>&1

echo "=== R3: Ekipa — 'Povabi' press-scale needle ==="
eb_dispatch '{"tab":"more","more":"team","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 4
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('Povabi')); if(!b) return JSON.stringify({gumb:false, err:window.__err??null}); return JSON.stringify({gumb:true, pressScale:b.className.includes('press-scale'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r245-prod-ekipa.png" > /dev/null 2>&1

echo "=== ZAKLJUČEK ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R245 REPROBE KONEC ==="
