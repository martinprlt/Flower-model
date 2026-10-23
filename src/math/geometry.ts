/**
 * geometry.ts — El único módulo que traduce la matemática a three.js.
 *
 * src/math/rose.ts no importa three (para poder validarla en Node sin
 * navegador); aquí se envuelve en un THREE.BufferGeometry real y se memoiza
 * por tier, porque construirla cuesta ~140 ms en high.
 */

import { BufferAttribute, BufferGeometry } from 'three'
import {
  buildRoseArrays,
  ROSE_PARAMS,
  type RoseBounds,
  type RoseParams,
  type Tier,
  type Vec3,
} from './rose.ts'

export interface RoseBuild {
  params: RoseParams
  geometry: BufferGeometry
  bounds: RoseBounds
  /** Punto desde el que crece la rosa. */
  core: Vec3
  vertexCount: number
  triangleCount: number
}

const cache = new Map<Tier, RoseBuild>()

export function getRose(tier: Tier): RoseBuild {
  const hit = cache.get(tier)
  if (hit) return hit

  const params = ROSE_PARAMS[tier]
  const a = buildRoseArrays(params)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(a.position, 3))
  geometry.setAttribute('normal', new BufferAttribute(a.normal, 3))
  geometry.setAttribute('uv', new BufferAttribute(a.uv, 2))
  // Atributos propios: sin ellos el crecimiento y la variación de color por
  // pétalo no tienen de dónde sacarse.
  geometry.setAttribute('aProgress', new BufferAttribute(a.aProgress, 1))
  geometry.setAttribute('aPetal', new BufferAttribute(a.aPetal, 1))
  geometry.setIndex(new BufferAttribute(a.index, 1))
  // Los pétalos se solapan y se atraviesan: la caja envolvente no sirve para
  // culling, y el radio ya viene calculado de la malla.
  geometry.computeBoundingSphere()

  const build: RoseBuild = {
    params,
    geometry,
    bounds: a.bounds,
    core: a.core,
    vertexCount: a.vertexCount,
    triangleCount: a.triangleCount,
  }
  cache.set(tier, build)
  return build
}

/**
 * Encuadre de cámara a partir del bounding box.
 *
 * El enunciado pide no tener que ajustar coordenadas a mano cada vez que
 * cambia la ecuación: aquí sólo entra el bounding box, el fov y el aspecto, y
 * sale una distancia y un punto de interés.
 */
export interface Framing {
  distance: number
  target: [number, number, number]
  position: [number, number, number]
  minDistance: number
  maxDistance: number
}

export function frameRose(bounds: RoseBounds, fovDeg: number, aspect: number, headroom: number): Framing {
  const r = Math.max(bounds.radius, 1e-4)
  const halfFov = (fovDeg * Math.PI) / 360

  // La distancia mínima que encaja una esfera de radio r en dos direcciones.
  // En vertical es directo; en horizontal el ángulo útil NO es el FOV
  // vertical sino atan(tan(halfFov)·aspect) — confundirlos hace que en
  // pantallas verticales la rosa se recorte por los lados, que es exactamente
  // el caso que más importa. Aquí se comprueba con los aspectos reales
  // (360×640, 430×932, 1920×1080) en scripts/validate-experience.mjs.
  const fitV = r / Math.sin(halfFov)
  const halfH = Math.atan(Math.tan(halfFov) * Math.max(aspect, 1e-3))
  const fitH = r / Math.max(Math.sin(halfH), 1e-4)
  const distance = Math.max(fitV, fitH) * headroom

  const target: [number, number, number] = [bounds.center[0], bounds.center[1], bounds.center[2]]
  // 3/4 ligeramente superior: es el ángulo desde el que la rosa tiene más
  // información — se ve el centro y a la vez el volumen del cuenco. La
  // dirección se NORMALIZA: sin eso los tres componentes suman 0.9988 en
  // norma euclídea y la distancia real de la cámara no coincide con la que
  // calculó el encuadre.
  const dir: [number, number, number] = [0.3, 0.46, 0.83]
  const dl = Math.hypot(dir[0], dir[1], dir[2])
  const position: [number, number, number] = [
    target[0] + (distance * dir[0]) / dl,
    target[1] + (distance * dir[1]) / dl,
    target[2] + (distance * dir[2]) / dl,
  ]
  return {
    distance,
    target,
    position,
    minDistance: distance * 0.72,
    maxDistance: distance * 1.55,
  }
}