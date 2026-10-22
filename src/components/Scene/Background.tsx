import { useEffect, useMemo } from 'react'
import { BackSide, BufferAttribute, Color, MeshBasicMaterial, SphereGeometry } from 'three'

import { PALETTE } from '../../config'

const SKY_RADIUS = 40
const SEGMENTS = { width: 48, height: 32 }

/**
 * Fondo degradado: una esfera grande vista por dentro, con el color
 * calculado por vértice y MeshBasicMaterial.
 *
 * Elegido a propósito en lugar de un shaderMaterial propio. Un material propio
 * tiene que resolver él mismo el espacio de color — es exactamente el sitio
 * donde un fondo sale demasiado oscuro o demasiado magenta y no se nota hasta
 * que se ve en el navegador. MeshBasicMaterial ya sabe dónde vive el color.
 *
 * El degradado son tres paradas (#070304 → #100408 → #16060B) y hay un halo
 * radial extremadamente suave apuntando hacia donde está la rosa. Nunca hay
 * negro puro. El vignette va aparte, en CSS, porque no cuesta pasada.
 */
export function Background({ haloDir }: { haloDir: [number, number, number] }) {
  const { geometry, material } = useMemo(() => {
    const stops: [number, Color][] = [
      [-1, new Color(PALETTE.bgBottom)],
      [0, new Color(PALETTE.bgMid)],
      [1, new Color(PALETTE.bgTop)],
    ]
    const halo = new Color(PALETTE.halo)
    const hx = haloDir[0], hy = haloDir[1], hz = haloDir[2]
    const hl = Math.hypot(hx, hy, hz) || 1
    const ax = hx / hl, ay = hy / hl, az = hz / hl

    const geo = new SphereGeometry(SKY_RADIUS, SEGMENTS.width, SEGMENTS.height)
    const pos = geo.getAttribute('position') as BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const tmp = new Color()

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const len = Math.hypot(x, y, z) || 1
      const h = y / len
      // Tres paradas con smoothstep en cada tramo: los medianos quedan bien
      // repartidos en vez de tener un escalón en el ecuador.
      const t = h < 0 ? h + 1 : h
      if (h >= 0) {
        const k = smoothstep(0.45, 1, h)
        tmp.copy(stops[1][1]).lerp(stops[2][1], k)
      } else {
        const k = smoothstep(0, 0.55, t)
        tmp.copy(stops[0][1]).lerp(stops[1][1], k)
      }
      // Halo: cuadrado del producto punto con la dirección de la rosa, con la
      // potencia alta para que no alcance media esfera.
      const d = (x / len) * ax + (y / len) * ay + (z / len) * az
      if (d > 0) tmp.lerp(halo, Math.pow(d, 8) * 0.18)

      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3))

    return {
      geometry: geo,
      material: new MeshBasicMaterial({
        vertexColors: true,
        side: BackSide,
        // Se descarta a mano: la esfera envuelve la escena entera y nunca
        // debería cachearse ni cortarse.
        depthWrite: false,
        toneMapped: true,
      }),
    }
  }, [haloDir])

  useMemo(() => void material, [material])

  // La esfera sólo se crea si cambia el halo, que es nunca: la limpieza
  // existe por si algún día se deja de montar el lienzo.
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <mesh geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} />
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

