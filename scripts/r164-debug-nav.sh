#!/bin/bash
# R164 debug: zakaj "Več" ni najden na produkciji
set -u
PROD="https://roksal-railing-manager.vercel.app"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r164@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR164Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 7
agent-browser eval "JSON.stringify({url: location.pathname, w: innerWidth, h: innerHeight})" 2>&1 | tail -1
echo "--- vsi aria-labeli gumbov ---"
agent-browser eval "JSON.stringify([...document.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||b.textContent.trim().slice(0,20)).filter(Boolean).slice(0,30))" 2>&1 | tail -1
echo "--- nav obstaja? ---"
agent-browser eval "(()=>{const nav=document.querySelector('nav'); const fixed=[...document.querySelectorAll('nav')].map(n=>({cls: n.className.slice(0,50), btns: n.querySelectorAll('button').length})); return JSON.stringify({navCount: document.querySelectorAll('nav').length, fixed});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
echo DEBUG KONEC
