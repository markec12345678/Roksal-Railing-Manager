#!/bin/bash
# R243 prod REPROBE — 3 točke iz prvega zajema, ki jih je treba ponoviti z
# diagnostiko: (R1) Domov fingerprint (regex tipkarska napaka v 1. skripti);
# (R2) plošča CSV gumb — kje je, katari so Izvozi aria-labeli; (R3) Osnutek
# dialog — ali se odpre, kateri gumbi so v dialogu. Vse bralno — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== R1: Domov fingerprint (brez/pod/na + Nov projekt odsoten) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const m=k?k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/):null; const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); const telo=document.body.textContent; const pod=(telo.match(/(\d+)\s+pod\b/)||[])[1]||null; const na=(telo.match(/(\d+)\s+na\s+zalogi/)||[])[1]||null; return JSON.stringify({brezSt:m?m[1]:null, pod, na, zamujenaOdsotna:!zam, novProjektOdsoten:!np, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== R2: kje je 'Izvozi prodajno ploščo kot CSV' — popis vseh Izvozi aria-labelov ==="
agent-browser eval "(()=>{const vse=[...document.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'').filter(a=>a.includes('Izvozi')); const naPlosci=!!document.querySelector('button[aria-label=\"Izvozi prodajno ploščo kot CSV\"]'); return JSON.stringify({naPlosci, izvoziAria:vse.slice(0,12), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== R2b: plošča CSV klik + fail-closed toast (0 projektov) ==="
eb_csv_capture csvP
eb_csv_reset csvP
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_cakaj 2
agent-browser eval "(()=>{const csvP=window.__csvP; if(typeof csvP!=='string'||csvP.length===0){ const fail=document.body.textContent.includes('Ni projektov na plošči za izvoz'); return JSON.stringify({csvNastal:false, failClosedToastPri0:fail, err:window.__err??null}); } return JSON.stringify({csvNastal:true, dolzina:csvP.length, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== R3: Osnutek dialog — počakaj dlje, diagnostika ob neuspehu ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
sleep 3
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
sleep 4
agent-browser eval "(()=>{const dialog=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.getAttribute('data-state')==='open'); const pill=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); const gumbi=dialog?[...dialog.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||b.textContent.trim()).filter(Boolean).slice(0,14):[]; return JSON.stringify({dialogOdp:!!dialog, pillViden:!!pill, pillDisabled:pill?pill.disabled:null, dialogGumbi:gumbi, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== R3b: če dialog odprt — PDF zajem (%PDF + dolžina) ==="
agent-browser eval "(()=>{const pill=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); if(!pill) return 'ni pilule'; window.__pdf=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(buf=>{ const u=new Uint8Array(buf); let s=''; for(let i=0;i<u.length;i+=8192){ s+=String.fromCharCode.apply(null,u.subarray(i,Math.min(i+8192,u.length))); } window.__pdf=btoa(s); }); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== ZAKLJUČEK ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R243 REPROBE KONEC ==="
