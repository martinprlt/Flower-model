import { ROSE_PARAMS, roseSpine, roseWhorl, rosePosition } from '../src/math/rose.ts'
const base = ROSE_PARAMS.high
for (const cb of [0.1, 0.25, 0.45, 0.95]) {
  const p = { ...base, curlBase: cb }
  console.log(`\n=== curlBase=${cb} ===`)
  console.log('n wh  kh    rBase hBase  l    tip.r tip.h  tipPsi')
  for (const n of [0,1,2,3,8,15,24,33]) {
    const wh=roseWhorl(p,n); const s0=roseSpine(p,n,0.001); const s1=roseSpine(p,n,1)
    console.log(`${String(n).padStart(2)} ${wh.k}  ${wh.kh.toFixed(3)} ${s0.r.toFixed(2)} ${s0.h.toFixed(1)} ${s1.l.toFixed(1)} ${s1.r.toFixed(2)} ${s1.h.toFixed(2)} ${(s1.phi*180/Math.PI).toFixed(0)}`)
  }
  const out=[0,0,0]
  for (const n of [0,1,2,3,8,15,24,33]) {
    let maxY=-1e9,maxR=0
    for(let qi=0;qi<p.qSeg;qi++){const q=qi/(p.qSeg-1);for(let c=0;c<=p.arcSeg;c+=2){rosePosition(p,n,q,c/p.arcSeg,out);maxY=Math.max(maxY,out[1]);maxR=Math.max(maxR,Math.hypot(out[0],out[2]))}}
    console.log(`   petal ${n}: maxY ${maxY.toFixed(1)} maxR ${maxR.toFixed(1)}`)
  }
}
