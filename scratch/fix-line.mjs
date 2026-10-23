import fs from 'node:fs'
const p='src/math/rose.ts'
const lines=fs.readFileSync(p,'utf8').split(/\r?\n/)
lines[414]='  // Torsi?n espiral del capullo: los p?talos centrales se enrollan helicoidalmente'
fs.writeFileSync(p, lines.join('\n'), 'utf8')
console.log(lines[414])
