import { buildRoseArrays, ROSE_PARAMS } from '../src/math/rose.ts'

// Let's test current rose
const g = buildRoseArrays(ROSE_PARAMS.high, { skipNormalize: true })
const d = Math.max(g.bounds.max[0] - g.bounds.min[0], g.bounds.max[2] - g.bounds.min[2])
const h = g.bounds.max[1] - g.bounds.min[1]
console.log('Current High:', {
  verts: g.vertexCount,
  tris: g.triangleCount,
  dh: (d / h).toFixed(3),
  d: d.toFixed(2),
  h: h.toFixed(2),
  bounds: g.bounds,
})
