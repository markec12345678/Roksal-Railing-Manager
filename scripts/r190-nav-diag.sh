#!/bin/bash
set -u
PROD="https://roksal-railing-manager.vercel.app"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{const bs=[...document.querySelectorAll('button')].map(b=>({t:b.textContent.trim().slice(0,30), a:b.getAttribute('aria-label')})).slice(0,25); return JSON.stringify({url:location.pathname, gumbi:bs});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
