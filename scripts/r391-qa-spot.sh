#!/usr/bin/env bash
# r391-qa-spot.sh — R391 produkcija QA spot seja (spot-r173/30; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch + Radix sheet odpiranje po kanonu;
# NIČ klikov na odjavo/preklic/revoke/izvoz/obvestilne vrstice/označi prebrano;
# setup bootstrapa NIKOLI ne sprožimo).
# Fokus: val 67 POST-deploy verifikacija — 2 needleja r389.tsv (era preverba
# TRIINŠTIRIDESIJNA R391 dokazuje 173/173 ŽIVO; ta sonda dokumentira MONTIRANO
# DOM resnico z mounted + className LOČENO, LEKCIJA R365 (4)):
#   A prijava → top-bar 'Obvestila' sheet (kanon odpiranje) → N1 notification
#     L811 ChevronRight — property-list nadgradnja transition-[transform,color]
#     + group-hover:translate-x-0.5 + group-hover:text-roksal-amber; vrstice se
#     samo MERIJO (ZERO-MUTACIJA: NIČ klikov na vrstice/označi prebrano);
#     POGOJNA resnica (sheet vrstice obstajajo SAMO z vsaj enim obvestilom —
#     iskreno poročanje praznine z razlogom).
#   B 'more'→'safety' tab → N2 Button L254 'Kopiraj varnostno poročilo' —
#     nadgradnja transition-[transform,background-color,box-shadow] +
#     duration-200; SAMO className split MERITEV BREZ KLIKA (klik = clipboard
#     mutacija — kanon r390 handover); gumb je renderan tudi disabled
#     (!windData) — iskreno poročilo stanja.
#   C sonde (navy + red štetje) + kolektor ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R391 QA spot seja (spot-r173/30 — val 67 POST-deploy) ==="

echo "--- A: prijava → Obvestila sheet → N1 notification L811 ChevronRight (className LOČENO, vrstice samo MERJENE) ---"
agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r390err
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!z) return 'ni zvoncka'; z.click(); return 'klik';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "JSON.stringify({
  n1Chevron: [...document.querySelectorAll('[role=\"dialog\"] button svg, [data-state=\"open\"] button svg')].filter(s=>{const c=s.getAttribute('class')||'';return ['h-4','w-4','shrink-0','text-muted-foreground/50','transition-[transform,color]','group-hover:translate-x-0.5','group-hover:text-roksal-amber'].every(t=>c.split(/\\s+/).includes(t))}).length,
  n1Tokeni: ['transition-[transform,color]','group-hover:translate-x-0.5','group-hover:text-roksal-amber'].map(t=>[...document.querySelectorAll('[role=\"dialog\"] button svg')].filter(s=>((s.getAttribute('class')||'').split(/\\s+/)).includes(t)).length),
  vrsticVSheet: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.className||'').includes('group flex w-full')).length,
  prazenSeznam: document.body.textContent.includes('Ni obvestil') || document.body.textContent.includes('ni obvestil'),
  razlog: 'POGOJNA resnica: L811 ChevronRight je renderan SAMO znotraj obvestilnih vrstic (seznam obvestil); vrstice samo MERJENE — ZERO-MUTACIJA: NIČ klikov na vrstice, NIČ označi prebrano; iskrena praznina, če seznam prazen; needle ŽIVO v buildu (era need_static TRIINŠTIRIDESIJNA 173/173); SVG className branje po getAttribute (SVGAnimatedString lekcija R390)'
})" 2>&1 | tail -1
agent-browser eval "(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" > /dev/null 2>&1
sleep 1

echo "--- B: more→safety tab → N2 Button L254 (className split, BREZ klika — clipboard mutacija) ---"
eb_dispatch '{"tab":"more","more":"safety","subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser eval "JSON.stringify({
  n2Report: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Kopiraj varnostno poročilo na odložišče').length,
  n2Tokeni: (function(){const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Kopiraj varnostno poročilo na odložišče'); if(!b) return null; const c=(b.className||'').split(/\\s+/); return ['h-9','px-3','bg-roksal-navy','hover:bg-roksal-navy/90','text-white','gap-1.5','transition-[transform,background-color,box-shadow]','duration-200','active:scale-95','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2'].map(t=>c.includes(t));})(),
  n2Disabled: (function(){const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Kopiraj varnostno poročilo na odložišče'); return b?b.disabled:null;})(),
  razlog: 'L254 Button je VEDNO renderan (disabled brez vetra — vrata !windData); className split 12 tokenov LOČENO; NI klika — klik bi bil clipboard mutacija (kanon R391 handover); mounted + className LOČENO (LEKCIJA R365 (4))'
})" 2>&1 | tail -1

echo "--- C: sonde (navy + red štetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- D: kolektor ---"
eb_preberi_kolektor r390err

agent-browser close --all >/dev/null 2>&1
echo "=== R391 spot KONEC ==="
