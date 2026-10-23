/**
 * validate-experience.mjs — Gate 1: el contrato de la experiencia.
 *
 * Comprueba tres cosas que se rompen en silencio y cuestan un navegador para
 * detectarlas: el ordenamiento del crecimiento, la duración de la secuencia y
 * el encuadre de la cámara a partir del bounding box.
 *
 *   node --experimental-strip-types scripts/validate-experience.mjs
 */

import { frameRose } from '../src/math/geometry.ts'
import { CAMERA } from '../src/config.ts'

let fails = 0
const ok = (label, cond, detail = '') => {
  if (!cond) fails++
  console.log(`[${cond ? '  ok  ' : ' FAIL '}] ${label}${detail ? '   ' + detail : ''}`)
}
const section = (t) => {
  console.log('\n\x1b[1m' + t + '\x1b[0m')
  console.log('─'.repeat(78))
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Ordenamiento del crecimiento
//
// Es el bug más caro del proyecto: si los argumentos del smoothstep van al
// revés, la rosa entera se ve desde el primer frame y la secuencia narrativa
// no existe.
// ─────────────────────────────────────────────────────────────────────────────
section('1 · Crecimiento — smoothstep(aProgress, aProgress + w, uProgress)')

const W = 0.13
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const g = (uProgress, ap) => smoothstep(ap, ap + W, uProgress)

{
  ok('uProgress = 0: el centro no se ve', g(0, 0) === 0, `g=${g(0, 0)}`)
  ok('uProgress = 0: el borde no se ve', g(0, 1) === 0, `g=${g(0, 1)}`)
  ok('uProgress = 1: el centro sí se ve', g(1, 0) === 1, `g=${g(1, 0)}`)

  // La razón de que se empuje uProgress hasta 1 + w al final.
  ok('uProgress = 1 deja el último anillo en 0', g(1, 1) === 0, `g=${g(1, 1)}`)
  ok('uProgress = 1 + w completa el último anillo', g(1 + W, 1) === 1, `g=${g(1 + W, 1)}`)

  const mid = g(0.5 + W * 0.5, 0.5)
  ok('a la mitad sólo el centro está crecido', g(0.5 + W * 0.5, 0) === 1 && mid > 0 && g(0.5 + W * 0.5, 1) === 0,
    `centro=1 medio=${mid.toFixed(2)} borde=0`)

  let mono = true
  for (let k = 0; k <= 40; k++) {
    const up = (k / 40) * (1 + W)
    let prev = 2
    for (const ap of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
      const v = g(up, ap)
      if (v > prev + 1e-9) mono = false
      prev = v
    }
  }
  ok('un vértice del centro nunca va por detrás de uno del borde', mono)

  // Las derivadas: sin suavizar, el frente salta.
  // Suavidad: en 0.01 de progreso el frente nunca debe saltar más de 0.15.
  // (El máximo teórico es 1.5/0.13 · 0.01 = 0.115, así que este umbral
  // deja comprobar que no es un escalón sin exigirle más que su derivada.)
  const e1 = g(0.4, 0.35) - g(0.39, 0.35)
  ok('el frente se desplaza de forma continua (sin escalones)', e1 > 0 && e1 < 0.15,
    `Δ=${e1.toFixed(4)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Duración de la secuencia
// ─────────────────────────────────────────────────────────────────────────────
section('2 · Secuencia narrativa')

const TIMING = {
  introDark: 750, introHold: 2050, introGap: 400, glowLead: 250,
  grow: 6200, bloomHold: 700, pushIn: 2600, messageFade: 1200, hintLife: 5200,
}
const REDUCED = {
  introDark: 200, introHold: 1400, introGap: 150, glowLead: 80,
  grow: 1100, bloomHold: 300, pushIn: 0, messageFade: 400, hintLife: 3200,
}

const total = (t) => t.introDark + t.introHold + t.introGap + t.glowLead + t.grow + t.bloomHold + t.pushIn

console.log(`   normal  ${(total(TIMING) / 1000).toFixed(1)} s`)
console.log(`   reduced ${(total(REDUCED) / 1000).toFixed(1)} s`)

ok('llega a INTERACTIVE en 11–14 s', total(TIMING) >= 11000 && total(TIMING) <= 14000, `${total(TIMING)} ms`)
ok('con reduced-motion se adelanta a menos de 6 s', total(REDUCED) < 6000, `${total(REDUCED)} ms`)
ok('oscuridad inicial 600–900 ms', TIMING.introDark >= 600 && TIMING.introDark <= 900, `${TIMING.introDark} ms`)
ok('la frase se queda ~2 s', TIMING.introHold >= 1800 && TIMING.introHold <= 2200, `${TIMING.introHold} ms`)
ok('oscuridad tras la frase 400–500 ms', TIMING.introGap >= 400 && TIMING.introGap <= 500, `${TIMING.introGap} ms`)
ok('florecimiento 5–7 s', TIMING.grow >= 5000 && TIMING.grow <= 7000, `${TIMING.grow} ms`)
ok('acercamiento de cámara < 4 s', TIMING.pushIn > 0 && TIMING.pushIn < 4000, `${TIMING.pushIn} ms`)
ok('la pista vive menos que la dedicatoria', TIMING.hintLife > 3000 && TIMING.hintLife < 7000, `${TIMING.hintLife} ms`)
ok('en reduced-motion NO hay acercamiento de cámara', REDUCED.pushIn === 0)

// ─────────────────────────────────────────────────────────────────────────────
// 3. Encuadre automático
// ─────────────────────────────────────────────────────────────────────────────
section('3 · Encuadre a partir del bounding box')

for (const [name, fov, aspect] of [
  ['360×640', 34, 360 / 640],
  ['390×844', 34, 390 / 844],
  ['430×932', 34, 430 / 932],
  ['1366×768', 34, 1366 / 768],
  ['1920×1080', 34, 1920 / 1080],
]) {
  const r = Math.SQRT2 / 2
  const b = { min: [-1, -1, -1], max: [1, 1, 1], center: [0, 0, 0], radius: r, aspect: 1.6 }
  const f = frameRose(b, fov, aspect, CAMERA.headroom)

  const halfFov = (fov * Math.PI) / 360
  const halfH = Math.atan(Math.tan(halfFov) * aspect)
  // Fracción del semieje que ocupa la esfera que contiene la rosa.
  const coverV = r / (f.distance * Math.sin(halfFov))
  const coverH = r / (f.distance * Math.sin(halfH))

  // Sin recorte en ninguna dimensión: era el fallo real que encontró esta
  // comprobación en móvil vertical.
  ok(`${name}: la rosa ENCAJA sin recorte`, coverV <= 1 + 1e-9 && coverH <= 1 + 1e-9,
    `vert=${(coverV * 100).toFixed(1)}%  horiz=${(coverH * 100).toFixed(1)}%`)

  // La dimensión que manda queda entre 60 % y 90 % llena: suficiente
  // protagonismo y suficiente aire alrededor.
  const dominant = Math.max(coverV, coverH)
  ok(`${name}: la dimensión que manda queda 60–90 % llena`, dominant >= 0.6 && dominant <= 0.9,
    `${(dominant * 100).toFixed(1)} %`)

  const d = Math.hypot(
    f.position[0] - f.target[0],
    f.position[1] - f.target[1],
    f.position[2] - f.target[2],
  )
  ok(`${name}: la posición está exactamente a la distancia calculada`, Math.abs(d - f.distance) < 1e-6, d.toFixed(4))
  ok(`${name}: la cámara queda por encima del objetivo`, f.position[1] > f.target[1])
}

{
  const b = { min: [-1, -1, -1], max: [1, 1, 1], center: [0, 0, 0], radius: Math.SQRT2 / 2, aspect: 1.6 }
  const f = frameRose(b, CAMERA.fov, 1920 / 1080, CAMERA.headroom)
  ok('la distancia es mayor que el radio de la rosa', f.distance > b.radius,
    `${f.distance.toFixed(3)} > ${b.radius.toFixed(3)}`)
  ok('el zoom nunca permite entrar en la geometría', f.minDistance / f.distance > 0.6, `${(f.minDistance / f.distance).toFixed(2)}×`)
  ok('el zoom nunca permite alejarse demasiado', f.maxDistance / f.distance < 1.6, `${(f.maxDistance / f.distance).toFixed(2)}×`)
  const horiz = Math.hypot(f.position[0] - f.target[0], f.position[2] - f.target[2])
  const vert = f.position[1] - f.target[1]
  const elev = (Math.atan2(vert, horiz) * 180) / Math.PI
  ok('vista 3/4 entre 15° y 30° de elevación', elev > 15 && elev < 30, `${elev.toFixed(1)}°`)
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n\x1b[1mResumen\x1b[0m')
console.log('─'.repeat(78))
console.log(`${fails === 0 ? 'Todo correcto.' : `${fails} FALLO(S)`}`)
process.exit(fails === 0 ? 0 : 1)