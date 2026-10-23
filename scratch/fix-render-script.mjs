import { readFileSync, writeFileSync } from 'node:fs'

let content = readFileSync('scripts/render-rose.mjs', 'utf8')
content = content.replace(
  'const res = process.argv[4] ? JSON.parse(process.argv[4]) : { qSeg: 4, arcSeg: 90 }\r\nconst params = { ...ROSE_PARAMS[tier], ...res }',
  'const res = process.argv[4] ? JSON.parse(process.argv[4]) : {}\r\nconst params = { ...ROSE_PARAMS[tier], ...res }'
)
content = content.replace(
  'const res = process.argv[4] ? JSON.parse(process.argv[4]) : { qSeg: 4, arcSeg: 90 }\nconst params = { ...ROSE_PARAMS[tier], ...res }',
  'const res = process.argv[4] ? JSON.parse(process.argv[4]) : {}\nconst params = { ...ROSE_PARAMS[tier], ...res }'
)
writeFileSync('scripts/render-rose.mjs', content, 'utf8')
console.log('scripts/render-rose.mjs updated!')
