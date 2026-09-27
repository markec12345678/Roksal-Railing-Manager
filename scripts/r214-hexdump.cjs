// R214 diag — hexdump vrstice 'const aterialSubTab' (R213 MultiEdit lekcija)
const s = require('fs').readFileSync('src/app/page.tsx', 'utf8')
const i = s.indexOf('const aterialSubTab')
console.log('indexOf:', i)
if (i >= 0) {
  const j = s.indexOf('\n', i)
  const line = s.slice(i, j)
  console.log('len:', line.length)
  console.log('hex:', Buffer.from(line, 'utf8').toString('hex'))
  let out = []
  for (const ch of line) out.push(JSON.stringify(ch) + ':' + ch.codePointAt(0).toString(16))
  console.log(out.join(' '))
} else {
  // poskusi brez presledka — mrgoljni znaki med 'const' in identifikatorjem
  const k = s.indexOf('aterialSubTab')
  console.log('bare indexOf:', k)
  if (k >= 0) {
    const start = Math.max(0, k - 12)
    const line = s.slice(start, k + 30)
    let out = []
    for (const ch of line) out.push(JSON.stringify(ch) + ':' + ch.codePointAt(0).toString(16))
    console.log(out.join(' '))
  }
}
