import { rosePhi, roseElevation } from '../src/math/rose.ts'

// Gauss-Legendre 5-point nodes and weights on [-1, 1]
const GL_X = [
  0.0,
  -0.5384693101056831,
   0.5384693101056831,
  -0.9061798459386640,
   0.9061798459386640,
]
const GL_W = [
  0.5688888888888889,
  0.4786286704993665,
  0.4786286704993665,
  0.2369268850561891,
  0.2369268850561891,
]

function integrateSpine(psi0, curl, q) {
  let sumCos = 0
  let sumSin = 0
  const halfQ = q * 0.5
  for (let i = 0; i < 5; i++) {
    const s = halfQ * (1 + GL_X[i])
    const psi = psi0 - curl * s * s
    sumCos += GL_W[i] * Math.cos(psi)
    sumSin += GL_W[i] * Math.sin(psi)
  }
  return {
    intCos: halfQ * sumCos,
    intSin: halfQ * sumSin,
  }
}

console.log('q=1, psi0=1.57, curl=1.5:', integrateSpine(1.57, 1.5, 1))
console.log('q=0.5:', integrateSpine(1.57, 1.5, 0.5))
console.log('q=0:', integrateSpine(1.57, 1.5, 0))
