#!/usr/bin/env bash
# R329 — QA spot seja (ZERO-MUTACIJA): prijava → inventory → cena zgodovina panel
# (iskrena ničelna veja pričakovana: OBA izvozna gumba SKRITA + dobavitelji panel ODSOTEN)
# → vodja (val 15/16 površine) → screenshot dokaz.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R329 QA spot seja ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "--- dispatch inventory ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3

echo "--- cena zgodovina panel stanje (ničelna veja) ---"
agent-browser eval "JSON.stringify({
  zgodovinaPanel: !!document.querySelector('[data-testid=\"cena-zgodovina-dokaz\"]'),
  dobaviteljiPanel: !!document.querySelector('[data-testid=\"cena-dobavitelji-dokaz\"]'),
  csvGumbi: document.querySelectorAll('button[aria-label=\"Izvozi zgodovino cen kot CSV\"]').length,
  pdfGumbi: document.querySelectorAll('button[aria-label=\"Izvozi zgodovino cen kot PDF\"]').length,
  dobaviteljiGumbi: document.querySelectorAll('button[aria-label=\"Izvozi primerjavo dobaviteljev kot CSV\"]').length,
  praznoBesedilo: document.body.includes ? null : (document.body.innerText.includes('Ni še zabeleženih cen') ? 'iskrena ničelna veja ŽIVO' : 'besedilo ni najdeno')
})" 2>&1 | tail -1

echo "--- wire GET zgodovina ( pari=0 pričakovano na spot seji ) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/material-prices/zgodovina')).length)" 2>&1 | tail -1

echo "--- dispatch vodja (val 15/16 površine) ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
sleep 3

echo "--- vodja val 15/16 registry žetoni ---"
agent-browser eval "JSON.stringify({
  avtomatizacijaDokaz: !!document.querySelector('[data-testid=\"avtomatizacija-dokaz\"]'),
  prihodkiAria: document.body.innerText.includes('Prihodki po mesecih'),
  tedenskiRazgled: document.body.innerText.includes('Tedenski razgled')
})" 2>&1 | tail -1

echo "--- screenshot dokaz ---"
mkdir -p /tmp/r329-qa
agent-browser screenshot /tmp/r329-qa/r329-vodja-spot.png 2>&1 | tail -1
ls -la /tmp/r329-qa/ 2>/dev/null | tail -2

agent-browser close --all >/dev/null 2>&1
echo "=== R329 QA spot KONEC ==="
