#!/bin/bash
# R271 prod QA dopolnilo — Z0 health + Z1 LIVE mini tekst (kratki tek)
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
echo "=== Z0: prod health žig ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const t=document.body.textContent; const m=t.match(/Inventura \(viden seznam\):[^A-ZÅ½]{0,160}/); const dot=[...document.querySelectorAll('span')].find(s=>s.className.includes('roksal-red')||s.className.includes('roksal-amber')||s.className.includes('roksal-green')); return JSON.stringify({mini:m?m[0].trim():null, dotClass:dot?dot.className:null, pillViden:!!document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot PDF\"]'), pillNaslov:(document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot PDF\"]')||{}).title||null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1
echo "=== KONEC dopolnila ==="
