#!/bin/bash
# R242 prod QA (spot = MONTER, samo bralni tokovi — ZERO-MUTACIJA):
# Naročila tab — vlogo-osveščen vodič VIDEN (spot nima procurement pravic) +
# CSV viden (branje) + R241/R239 ogledala ostajajo.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: prod health žig ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

echo "=== Z2: R242 ogledalo ŽIVO za MONTER — Naročila vodič VIDEN ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const csv=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); const vodic=document.body.textContent.includes('Pregled naročil je samo za branje'); const approve=vodic&&document.body.textContent.includes('procurement.approve'); const receive=vodic&&document.body.textContent.includes('procurement.receive'); const csvPS=csv?csv.className.includes('press-scale'):false; return JSON.stringify({csvViden:!!csv, vodicViden:vodic, vodicImeApprove:approve, vodicImeReceive:receive, pressScalePariteta:csvPS, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r242-prod-narocila-monter.png > /dev/null 2>&1

echo "=== Z3: regresije — Računi ogledalo + Nov projekt odsoten ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('(FURS)');})()" 24
sleep 1
agent-browser eval "(()=>{const nov=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov račun')); const vodicR=document.body.textContent.includes('Pregled računov je samo za branje'); return JSON.stringify({novRacunOdsoten:!nov, racuniVodicViden:vodicR, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== ZAKLJUČEK ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R242 PROD QA KONEC ==="
