import fs from 'node:fs'
const p='src/components/Scene/Lighting.tsx'
let s=fs.readFileSync(p,'utf8')
s=s.replace('color={PALETTE.lightAmbient}', 'color="#ffffff"')
s=s.replace('intensity={0.3}', 'intensity={2.5}')
fs.writeFileSync(p,s,'utf8')
console.log('diagnostic ambient applied')
