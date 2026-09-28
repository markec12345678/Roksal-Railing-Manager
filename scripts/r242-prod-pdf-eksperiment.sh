#!/bin/bash
# R242 prod PDF eksperiment (spot seja, samo bralni tokovi — ZERO-MUTACIJA):
# 2 zajema Osnutek PDF v ISTI rundi + base64 artefakta za pdftotext
# primerjavo z lokalnim E2E (r242-e2e-pdf-eksperiment.sh). Pričakovanje iz
# glifnega zaklepa: dolžina = f(števke v žigu) — zajema v isti minuti = ISTA
# dolžina, RAZLIČNI bajti.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: prod health žig (pred zajemi) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

echo "=== Z2: Osnutek PDF zajem ×2 (spot) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]'); return !!g && !g.disabled;})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 14
sleep 1
agent-browser eval "(()=>{const d=document.querySelector('[role=\"dialog\"]'); if(!d) return JSON.stringify({dialog:false}); const vrstice=[...d.querySelectorAll('.flex.items-center.justify-between')].map(r=>r.textContent.trim()); const opombe=document.getElementById('osnutek-opombe'); return JSON.stringify({dialog:true, vrstice, opombe:opombe?opombe.value:null});})()" 2>&1 | tail -1
# ZAJEM 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
P1=$(agent-browser eval "(()=>{const bin=atob(window.__pdf); return JSON.stringify({bajtov:bin.length, magija:bin.substring(0,5), ura:new Date().toLocaleTimeString('sl-SI',{hour:'2-digit',minute:'2-digit'})});})()" 2>&1 | tail -1)
echo "  prod zajem 1: $P1"
agent-browser eval "(()=>{window.__b64a=window.__pdf; return 'a';})()" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1
# ZAJEM 2 — svež dialog
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 14
sleep 1
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
P2=$(agent-browser eval "(()=>{const bin=atob(window.__pdf); return JSON.stringify({bajtov:bin.length, magija:bin.substring(0,5), ura:new Date().toLocaleTimeString('sl-SI',{hour:'2-digit',minute:'2-digit'}), istiKotPrvi:window.__pdf===window.__b64a});})()" 2>&1 | tail -1)
echo "  prod zajem 2: $P2"
agent-browser eval "(()=>{return window.__b64a;})()" 2>&1 | tail -1 | tr -d '\n' > "$SS/r242-pdf-prod-a.b64"
agent-browser eval "(()=>{return window.__pdf;})()" 2>&1 | tail -1 | tr -d '\n' > "$SS/r242-pdf-prod-b.b64"
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1

echo "=== Z3: spot ogledalo regresija (R241/R239) — Računi samo-za-branje + Nov projekt odsoten ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('(FURS)');})()" 24
sleep 1
agent-browser eval "(()=>{const nov=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov račun')); const vodic=document.body.textContent.includes('Pregled računov je samo za branje'); return JSON.stringify({novRacunOdsoten:!nov, vodicViden:vodic, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R242 PROD EKSPERIMENT KONEC ==="
