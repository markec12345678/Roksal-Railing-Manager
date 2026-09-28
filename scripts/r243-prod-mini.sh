#!/bin/bash
# R243 prod mini-probe — R238 fail-closed NA PRAVI TAB (CRM, kjer DealPipeline
# živi — lekcija: gumb NI na Domovu; r241 vzorec je kliknil po CRM dispaču).
set -u
source /home/z/my-project/scripts/e2e-lib.sh

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== R2c: CRM tab → plošča CSV fail-closed (0 projektov) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi prodajno ploščo kot CSV\"]');})()" 24
sleep 1
eb_csv_capture csvP
eb_csv_reset csvP
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_cakaj 2
agent-browser eval "(()=>{const csvP=window.__csvP; if(typeof csvP!=='string'||csvP.length===0){ const fail=document.body.textContent.includes('Ni projektov na plošči za izvoz'); return JSON.stringify({csvNastal:false, failClosedToastPri0:fail, err:window.__err??null}); } return JSON.stringify({csvNastal:true, dolzina:csvP.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r243-prod-plosca-crm.png > /dev/null 2>&1

echo "=== ZAKLJUČEK ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R243 MINI-PROBE KONEC ==="
