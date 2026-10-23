import { ROSE_PARAMS, roseSpine, roseWhorl, rosePosition } from '../src/math/rose.ts'
const p = ROSE_PARAMS.high
const out=[0,0,0]
console.log('n  whorl j/m  kh    rBase  hBase   l     w(q=1)  psiMax  tip.r  tip.h  tipW')
for (const n of [0,1,2,3,7,8,12,13,19,20,25,26,33]) {
  const wh = roseWhorl(p,n)
  const s0 = roseSpine(p,n,0.001)
  const s1 = roseSpine(p,n,1)
  const st = roseSpine(p,n,0)
  console.log(`${String(n).padStart(2)}  ${wh.k}    ${wh.j}/${wh.m}  ${wh.kh.toFixed(3)}  ${st.r.toFixed(2)}  ${st.h.toFixed(2)}  ${st.l.toFixed(1)}  ${s1.w.toFixed(2)}   ${s1.psiMax.toFixed(2)}   ${s1.r.toFixed(2)}  ${s1.h.toFixed(2)}  ${(s1.w).toFixed(2)}`)
}
for (const n of [0,1,2,3,8,20,33]) {
  let minY=1e9,maxY=-1e9,maxR=0,minR=1e9
  for(let qi=0;qi<p.qSeg;qi++){const q=qi/(p.qSeg-1);for(let c=0;c<=p.arcSeg;c++){rosePosition(p,n,q,c/p.arcSeg,out);minY=Math.min(minY,out[1]);maxY=Math.max(maxY,out[1]);const r=Math.hypot(out[0],out[2]);maxR=Math.max(maxR,r);minR=Math.min(minR,r)}}
  console.log(`petal ${n}: y[${minY.toFixed(1)},${maxY.toFixed(1)}] r[${minR.toFixed(2)},${maxR.toFixed(2)}]`)
}
