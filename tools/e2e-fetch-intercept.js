#!/usr/bin/env node
// R213 (P1-g) — skupni helper za E2E fetch intercept (agent-browser eval).
// Vzorec je bil do zdaj podvojen inline v r211/r212 E2E skriptah — zdaj EN vir.
//
// Uporaba v E2E skriptah (preko command substitution):
//   agent-browser eval "$(node tools/e2e-fetch-intercept.js patch '/api/material-orders' 500 'R213 E2E izklop naročil')"
//   agent-browser eval "$(node tools/e2e-fetch-intercept.js restore)"
//
// Delovanje:
//   patch   — zamenja window.fetch; klici, katerih URL vsebuje <url-del>, dobi
//             odgovor { error: <sporočilo> } z <status>. Prejšnji patch se
//             najprej varno povrne (brez ugnezdenih izgub originala).
//   restore — povrne originalen window.fetch ('not-patched', če ni bil patchan).
//
// Fail-closed CLI: manjkajoči/neveljavni argumenti → exit 2, brez izhoda.
'use strict'

const PATCH_TEMPLATE =
  '(()=>{if(window.__e2eFetchRestore){window.__e2eFetchRestore();}' +
  'const of_=window.fetch;' +
  'window.__e2eFetchRestore=()=>{window.fetch=of_;delete window.__e2eFetchRestore;return "restored";};' +
  'window.fetch=(u,...a)=>String(u).includes(__URL__)?Promise.resolve(new Response(JSON.stringify({error:__MSG__}),{status:__STATUS__})):of_(u,...a);' +
  'return "patched:"+__URL__+":"+__STATUS__;})()'

const RESTORE_SNIPPET =
  '(()=>{return window.__e2eFetchRestore?window.__e2eFetchRestore():"not-patched";})()'

function patchSnippet(urlPart, status, message) {
  return PATCH_TEMPLATE.replace(/__URL__/g, JSON.stringify(urlPart))
    .replace(/__STATUS__/g, String(status))
    .replace(/__MSG__/g, JSON.stringify(message))
}

const [, , cmd, urlPart, statusRaw, ...messageParts] = process.argv

if (cmd === 'patch') {
  const message = messageParts.join(' ')
  const status = Number(statusRaw)
  if (!urlPart || !statusRaw || !message) {
    console.error('uporaba: e2e-fetch-intercept.js patch <url-del> <status> <sporočilo> | restore')
    process.exit(2)
  }
  if (!Number.isInteger(status) || status < 200 || status > 599) {
    console.error('status mora biti celo število 200–599')
    process.exit(2)
  }
  process.stdout.write(patchSnippet(urlPart, status, message) + '\n')
} else if (cmd === 'restore') {
  process.stdout.write(RESTORE_SNIPPET + '\n')
} else {
  console.error('uporaba: e2e-fetch-intercept.js patch <url-del> <status> <sporočilo> | restore')
  process.exit(2)
}
