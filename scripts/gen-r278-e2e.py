#!/usr/bin/env python3
"""Izpelji scripts/r278-e2e-browser.sh iz r277-e2e-browser.sh:
- poti/logi/screenshot/tmp r277→r278, sekret, glava + KONEC žig;
- Z1 eval razširen: vir pill R278 stil (cursor-help + title 'Vir podatkov:');
  Z1 asserter razširen za virHelp/virTitle.
Kanon: ista struktura (Z1..Z5 + RESTORE + ODTIS) — ZERO-MUTACIJA ostaja."""
s = open('scripts/r277-e2e-browser.sh').read()

s = s.replace('''# R277 E2E ŽIVO (lokalni :3100, ADMIN) — TERENSKI PDF verzija+vir (issue #16
# §6) + panel thead title stil; R276 verzije tok = regresija:
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' (R276 regresija ŽIVO);''',
'''# R278 E2E ŽIVO (lokalni :3100, ADMIN) — R278 stil: vir pill title +
# cursor-help (hover parity z verzija pill — R275 kanon); R277 terenski PDF
# verzija+vir + R276 verzije tok = regresija:
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' + R278 vir pill title ŽIVO;''')

s = s.replace('r277-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r278-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!')
s = s.replace('/tmp/R277-server-e2e.log', '/tmp/R278-server-e2e.log')
s = s.replace('/tmp/r277-', '/tmp/r278-')
s = s.replace('qa-r277-e2e-', 'qa-r278-e2e-')
s = s.replace('qa-r276-e2e-v2.png', 'qa-r278-e2e-v2.png')
s = s.replace('=== R277 E2E KONEC ===', '=== R278 E2E KONEC ===')

# Z1 eval: dodaj vir stil probe
s = s.replace(
    "const vir=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const hist=document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]'); const popravi=document.querySelector('button[aria-label^=\"Popravi meritev \"]'); return JSON.stringify({pill:!!pill, pillHelp:pill?pill.className.includes('cursor-help'):false, pillTitle:pill?(pill.getAttribute('title')||'').includes('prvi vpis v verigi'):false, vir:!!vir, histBtn:!!hist, popraviBtn:!!popravi, err:window.__err??null});})()",
    "const vir=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const hist=document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]'); const popravi=document.querySelector('button[aria-label^=\"Popravi meritev \"]'); return JSON.stringify({pill:!!pill, pillHelp:pill?pill.className.includes('cursor-help'):false, pillTitle:pill?(pill.getAttribute('title')||'').includes('prvi vpis v verigi'):false, vir:!!vir, virHelp:vir?vir.className.includes('cursor-help'):false, virTitle:vir?(vir.getAttribute('title')||'').startsWith('Vir podatkov: Ročni vnos'):false, histBtn:!!hist, popraviBtn:!!popravi, err:window.__err??null});})()")

# Z1 assert: razširi za R278 stil
s = s.replace(
    "assert d['histBtn'] and d['popraviBtn'], 'Z1 gumba FAIL: '+json.dumps(d); print('Z1 OK — v1 pill (cursor-help + title) + vir Ročni vnos + zgodovina + Popravi gumb')",
    "assert d['histBtn'] and d['popraviBtn'], 'Z1 gumba FAIL: '+json.dumps(d); assert d['virHelp'] and d['virTitle'], 'Z1 R278 vir stil FAIL: '+json.dumps(d); print('Z1 OK — v1 pill (cursor-help + title) + vir Ročni vnos + R278 vir pill title (cursor-help + Vir podatkov: …) + gumba')")

open('scripts/r278-e2e-browser.sh', 'w').write(s)
print('r278-e2e-browser.sh generiran (Z1 razširen z R278 vir stil probe)')
