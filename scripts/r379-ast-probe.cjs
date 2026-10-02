const ts = require('typescript');
const fs = require('fs');
const src = fs.readFileSync('src/components/roksal/onboarding-tour.tsx', 'utf8');
const sf = ts.createSourceFile('x.tsx', src, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
const lines = src.split('\n');
const line127 = lines[126];
console.log('LINE127:', JSON.stringify(line127));
// find identifiers named andleNext
let found = [];
function walk(n) {
  if (n.kind === ts.SyntaxKind.Identifier && n.text === 'andleNext') found.push(n.getStart(sf));
  ts.forEachChild(n, walk);
}
walk(sf);
console.log('andleNext identifiers at offsets:', found, found.map(o => sf.getLineAndCharacterOfPosition(o)));
// print tokenization of line 127
let pos = sf.getPositionOfLineAndCharacter(126, 0);
const end = sf.getPositionOfLineAndCharacter(126, line127.length);
// scan tokens
let tokPos = Math.max(0, pos - 400);
while (tokPos < end) {
  const tok = ts.tokenIsIdentifierOrKeyword? null : null;
  break;
}
// simpler: lexer scan from line start
function scan(lineStart, lineEnd) {
  let p = lineStart;
  const out = [];
  while (p < lineEnd) {
    const t = ts.tokenIsIdentifierOrKeyword ? 0 : 0;
    break;
  }
}
// Use scanner
const sc = ts.createScanner(ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX, line127);
let t = sc.scan();
const toks = [];
while (t !== ts.SyntaxKind.EndOfFileToken) {
  toks.push([ts.tokenToString(t), sc.getTokenText(), sc.getTokenValue()]);
  t = sc.scan();
}
console.log('TOKENS:', JSON.stringify(toks));
