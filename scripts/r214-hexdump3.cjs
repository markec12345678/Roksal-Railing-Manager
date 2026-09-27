// R214 diag 3 — križni preverek v ENEM teku (brez dvomov o menjavi datoteke)
const crypto = require('crypto')
const fs = require('fs')
const s = fs.readFileSync('src/app/page.tsx', 'utf8')
console.log('sha256:', crypto.createHash('sha256').update(s).digest('hex').slice(0, 16))
console.log('bytes:', Buffer.byteLength(s))
console.log("indexOf('const aterialSubTab'):", s.indexOf('const aterialSubTab'))
console.log("indexOf('const [materialSubTab'):", s.indexOf('const [materialSubTab'))
console.log("indexOf('aterialSubTab, setMaterialSubTab'):", s.indexOf('aterialSubTab, setMaterialSubTab'))
// vse pojavitve 'setMaterialSubTab'
let idx = s.indexOf('setMaterialSubTab')
while (idx >= 0) {
  const ls = s.lastIndexOf('\n', idx) + 1
  const le = s.indexOf('\n', idx)
  console.log('--- occurrence @', idx, ':', JSON.stringify(s.slice(ls, le)))
  idx = s.indexOf('setMaterialSubTab', idx + 1)
}
