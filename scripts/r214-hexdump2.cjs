// R214 diag 2 — hexdump useState vrstice (brez terminalskih umetnosti)
const s = require('fs').readFileSync('src/app/page.tsx', 'utf8')
const k = s.indexOf('useState<MaterialSubTabHint')
console.log('indexOf useState:', k)
const lineStart = s.lastIndexOf('\n', k) + 1
const line = s.slice(lineStart, k)
console.log('line-before-useState:', JSON.stringify(line))
for (const ch of line) {
  if (ch.codePointAt(0) > 126 || ch.codePointAt(0) < 32) {
    console.log('NON-ASCII/CTRL:', ch.codePointAt(0).toString(16))
  }
}
