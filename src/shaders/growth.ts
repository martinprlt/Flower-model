/**
 * growth.ts — Cómo nace la rosa.
 *
 * Se parchea MeshPhysicalMaterial con onBeforeCompile en vez de escribir un
 * ShaderMaterial propio, porque la flor necesita PBR de verdad: tres luces,
 * recepción y proyección de sombras, tone mapping y conversión de espacio de
 * color. Todo eso son unos cientos de líneas que no tiene sentido reescribir
 * para ganar tres líneas de desplazamiento en el vértice.
 *
 * NOTA DE VERSIÓN (three r186, comprobado leyendo WebGLProgram): para los
 * materiales incluidos three siempre emite `#version 300 es` e inyecta
 * `#define attribute in`, `#define varying out` (vértice) y `#define varying in`
 * / `#define gl_FragColor pc_fragColor` (fragmento). Por eso aquí se escribe
 * sintaxis GLSL1 aunque el resultado sea GLSL3. Además `resolveIncludes` se
 * ejecuta DESPUÉS de onBeforeCompile, así que los `#include` del código
 * inyectado también funcionan.
 *
 * La rosa no aparece con opacity: cada vértice tiene un aProgress (0 en el
 * centro, 1 en el borde) y se revela con un smoothstep que se desplaza. Al
 * mismo tiempo, el frente que está generando geometría emite un resplandor
 * gaussiano MUY tenue que se apaga al terminar.
 */

import {
  AdditiveBlending,
  Color,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshPhysicalMaterial,
  RGBADepthPacking,
  ShaderMaterial,
  Vector3,
} from 'three'

export interface GrowthUniforms {
  uProgress: { value: number }
  uWidth: { value: number }
  uBase: { value: Vector3 }
  uTime: { value: number }
  uGlowColor: { value: Color }
  uGlowStrength: { value: number }
  uHitPoint: { value: Vector3 }
  uHitTime: { value: number }
  uHitGain: { value: number }
}

export function createGrowthUniforms(base: Vector3, glow: Color, band: number): GrowthUniforms {
  return {
    uProgress: { value: 0 },
    uWidth: { value: band },
    uBase: { value: base.clone() },
    uTime: { value: 0 },
    uGlowColor: { value: glow.clone() },
    uGlowStrength: { value: 0 },
    uHitPoint: { value: new Vector3(0, 0, 0) },
    // Muy en el pasado ⇒ el pulso inicial es invisible en vez de disparar un
    // anillo en el frame uno.
    uHitTime: { value: -1000 },
    uHitGain: { value: 0.5 },
  }
}

const VERT_COMMON = /* glsl */ `
  attribute float aProgress;
  attribute float aPetal;
  uniform float uProgress;
  uniform float uWidth;
  uniform vec3 uBase;
  varying float vGrowth;
  varying float vProg;
  varying float vPetal;
  varying vec3 vWorld;
`

// El desplazamiento: el pétalo nace de uBase (un punto) y se despliega.
// Además se "abre" en ángulo: al principio está aplastado contra el eje y
// gira hasta su posición final, que es lo que da la sensación de despliegue y
// no de fundido.
//
// El smoothstep es smoothstep(aProgress, aProgress + uWidth, uProgress):
// LOS ARGUMENTOS VAN ASÍ Y NO AL REVÉS. Con (uProgress - w, uProgress,
// aProgress) la condición de crecimiento se invierte y la rosa entera queda
// visible desde grow = 0. Aquí un vértice sólo empieza a existir cuando
// uProgress alcanza su aProgress, y termina al llegar a aProgress + uWidth.
// Por eso además se tiene que empujar uProgress hasta 1 + uWidth al final, o
// el último anillo (aProgress = 1) nunca terminaría de crecer.
const VERT_BODY = /* glsl */ `
  float g = smoothstep(aProgress, aProgress + uWidth, uProgress);
  g = g * g * (3.0 - 2.0 * g);
  vGrowth = g;
  vProg = aProgress;
  vPetal = aPetal;

  vec3 off = position - uBase;
  // unfurl = g · mix(0.3, 1, g) es 0 EXACTO en g = 0 y 1 EXACTO en g = 1, así
  // que el pétalo nace y acaba donde tiene que. Como va más lento que g en los
  // primeros frames, lo que pasa primero es la altura y sólo después la
  // separación azimutal: el pétalo se despliega en vez de aparecer girado.
  float unfurl = g * mix(0.30, 1.0, g);
  transformed = vec3(
    uBase.x + off.x * unfurl,
    uBase.y + off.y * g,
    uBase.z + off.z * unfurl
  );
  vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

const FRAG_COMMON = /* glsl */ `
  uniform float uProgress;
  uniform float uWidth;
  uniform float uTime;
  uniform vec3 uGlowColor;
  uniform float uGlowStrength;
  uniform vec3 uHitPoint;
  uniform float uHitTime;
  uniform float uHitGain;
  varying float vGrowth;
  varying float vProg;
  varying float vPetal;
  varying vec3 vWorld;
`

// Variación de color entre pétalos, sin ni una textura: sale del atributo
// matemático aPetal. ±14 %, suficiente para que unas capas se lean distintas
// de otras sin que parezca un degradado pintado.
const FRAG_COLOR = /* glsl */ `
  diffuseColor.rgb *= mix(0.86, 1.14, vPetal) * (0.94 + 0.06 * sin(vPetal * 37.0));
`

// Dos adiciones al emisivo, ambas deliberadamente pequeñas:
//  · el frente de crecimiento, una gaussiana estrecha sobre aProgress;
//  · un anillo que se expande desde el punto tocado y se apaga.
const FRAG_EMISSIVE = /* glsl */ `
  float band = exp(-pow((vProg - uProgress) / uWidth, 2.0) * 3.0);
  totalEmissiveRadiance += uGlowColor * band * uGlowStrength * (1.0 - vGrowth);

  float age = uTime - uHitTime;
  if (age >= 0.0 && age < 2.2) {
    float dist = distance(vWorld, uHitPoint);
    float wave = age * 0.9;
    float ring = exp(-pow((dist - wave) / 0.22, 2.0)) * exp(-age * 1.15);
    totalEmissiveRadiance += uGlowColor * ring * uHitGain;
  }
`

function injectVertex(shader: { vertexShader: string }, body: string): void {
  if (!shader.vertexShader.includes('#include <begin_vertex>')) {
    throw new Error('growth.ts: falta #include <begin_vertex>. La versión de three cambió.')
  }
  if (!shader.vertexShader.includes('#include <common>')) {
    throw new Error('growth.ts: falta #include <common>. La versión de three cambió.')
  }
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_COMMON}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${body}`)
}

/**
 * Aplica el mismo crecimiento a cualquier material que tenga su propio shader.
 *
 * Se usa para el wireframe de la estructura, que es un MeshBasicMaterial: si
 * no llevara el parche, el modo MATEMÁTICA mostraría la rosa entera mientras
 * la superficie sigue creciendo y la sincronía entre ambos se rompería.
 *
 * Los `varying` que declara VERT_BODY no se leen en el fragmento básico; eso
 * es legal en GLSL ES 3.00 (un `out` sin `in` correspondiente simplemente no
 * se consume).
 */
export function patchGrowth(
  material: MeshBasicMaterial | MeshPhysicalMaterial,
  uniforms: Record<string, { value: unknown }>,
  key: string,
): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    injectVertex(shader, VERT_BODY)
  }
  material.customProgramCacheKey = () => key
}

export interface RoseMaterials {
  surface: MeshPhysicalMaterial
  depth: MeshDepthMaterial
  uniforms: GrowthUniforms
  dispose(): void
}

export interface SurfaceOptions {
  color: string
  core: string
  rim: string
  glow: string
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
  sheen: number
  sheenRoughness: number
  emissiveIntensity: number
  base: Vector3
  band: number
  transparent: boolean
}

/**
 * Los dos materiales que hacen que las sombras coincidan con la rosa que se
 * está formando. Si sólo se parcheara el material de superficie, el pase de
 * sombras seguiría viendo la rosa completa y proyectaría una sombra flotante
 * de una flor que todavía no existe.
 */
export function createRoseMaterials(o: SurfaceOptions): RoseMaterials {
  const uniforms = createGrowthUniforms(o.base, new Color(o.glow), o.band)

  const surface = new MeshPhysicalMaterial({
    color: new Color(o.color),
    roughness: o.roughness,
    metalness: 0,
    clearcoat: o.clearcoat,
    clearcoatRoughness: o.clearcoatRoughness,
    // sheen es el BRDF correcto para el terciopelo de un pétalo. Es lo que
    // impide que la flor parezca plástico, y por eso el clearcoat es tan bajo.
    sheen: o.sheen,
    sheenRoughness: o.sheenRoughness,
    sheenColor: new Color(o.rim),
    emissive: new Color(o.core),
    emissiveIntensity: o.emissiveIntensity,
    side: 2, // DoubleSide: los pétalos se solapan y hay que ver sus dos caras.
    shadowSide: 2,
    transparent: o.transparent,
    depthWrite: true,
  })

  surface.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    injectVertex(shader, VERT_BODY)
    if (!shader.fragmentShader.includes('#include <emissivemap_fragment>')) {
      throw new Error('growth.ts: falta #include <emissivemap_fragment>.')
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_COMMON}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`,
      )
  }
  // Sin esto three cachea el programa por el código del material y dos rosas
  // distintas comparten compilación.
  surface.customProgramCacheKey = () => 'rose-surface-v1'

  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
  depth.onBeforeCompile = (shader) => {
    // Sólo la posición: en un pase de profundidad no hay color ni emisivo, y
    // guardar las uniformes de color ahí sería trabajo perdido.
    Object.assign(shader.uniforms, {
      uProgress: uniforms.uProgress,
      uWidth: uniforms.uWidth,
      uBase: uniforms.uBase,
    })
    if (!shader.vertexShader.includes('#include <common>')) {
      throw new Error('growth.ts: falta #include <common> en el material de profundidad.')
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_COMMON}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${VERT_BODY}`,
      )
  }
  depth.customProgramCacheKey = () => 'rose-depth-v1'

  return {
    surface,
    depth,
    uniforms,
    dispose() {
      surface.dispose()
      depth.dispose()
    },
  }
}

/**
 * Materiales de la representación matemática: aristas y puntos, sin
 * iluminación.
 *
 * Los tres comparten el MISMO aProgress y el MISMO crecimiento que la rosa,
 * así que nacen y se deshacen en sincronía. Eso es lo que hace que la
 * transición ROSA → MATEMÁTICA se lea como un regreso al origen en vez de
 * como un cambio de objeto: es la misma flor con menos capas encima.
 *
 * Van en dos objetos porque `mode: LINES` (aristas de los triángulos, lo que
 * three llama `wireframe: true`) y `mode: POINTS` son modos primitivos
 * distintos: no puede emitirse un único drawElements que cubra los dos.
 */
const POINTS_VERT = /* glsl */ `
  attribute float aProgress;
  uniform float uProgress;
  uniform float uWidth;
  uniform vec3 uBase;
  uniform float uPixelRatio;
  uniform float uSize;
  varying float vProg;
  varying float vGrowth;

  void main() {
    float g = smoothstep(aProgress, aProgress + uWidth, uProgress);
    g = g * g * (3.0 - 2.0 * g);
    vProg = aProgress;
    vGrowth = g;

    vec3 off = position - uBase;
    float unfurl = g * mix(0.30, 1.0, g);
    vec3 p = vec3(
      uBase.x + off.x * unfurl,
      uBase.y + off.y * g,
      uBase.z + off.z * unfurl
    );

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (1.0 / max(-mv.z, 0.001));
  }
`

// Punto con degradado radial: el gl_PointCoord es obligatorio, así que hay
// que hacer fuera el círculo. Sin esto cada punto sería un cuadrado duro y la
// representación se vería como una textura de píxeles en vez de como
// matemática.
const POINTS_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uGlow;
  uniform float uProgress;
  uniform float uWidth;
  uniform float uGlowStrength;
  uniform float uOpacity;
  varying float vProg;
  varying float vGrowth;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float r = length(c) * 2.0;
    float a = 1.0 - smoothstep(0.30, 1.0, r);
    if (a <= 0.0) discard;

    vec3 col = uColor;
    float band = exp(-pow((uProgress - vProg) / uWidth, 2.0) * 3.0);
    col = mix(col, uGlow, clamp(band * uGlowStrength * 3.0, 0.0, 0.85));

    gl_FragColor = vec4(col, a * uOpacity);
    #include <colorspace_fragment>
  }
`

export interface StructureMaterials {
  wireframe: MeshBasicMaterial
  points: ShaderMaterial
  uniforms: {
    uProgress: { value: number }
    uWidth: { value: number }
    uBase: { value: Vector3 }
    uPixelRatio: { value: number }
    uSize: { value: number }
    uColor: { value: Color }
    uGlow: { value: Color }
    uGlowStrength: { value: number }
    uOpacity: { value: number }
  }
  dispose(): void
}

export function createStructureMaterials(
  wire: string,
  point: string,
  glow: string,
  base: Vector3,
  size: number,
  pixelRatio: number,
): StructureMaterials {
  const uniforms = {
    // 1e6 al arrancar: con uProgress gigante todo el mesh está crecido, que
    // es lo que quiere la estructura cuando se pide a mano en modo rosa.
    uProgress: { value: 1e6 },
    uWidth: { value: 0.13 },
    uBase: { value: base.clone() },
    uPixelRatio: { value: pixelRatio },
    uSize: { value: size },
    uColor: { value: new Color(point) },
    uGlow: { value: new Color(glow) },
    uGlowStrength: { value: 0 },
    uOpacity: { value: 0 },
  }

  // gl.lineWidth está clampeado a 1 en casi todas las plataformas. El
  // wireframe no se puede engrosar: no es un defecto que haya que pelear, y
  // con depthWrite desactivado 1 px sobre el fondo oscuro se lee con nitidez.
  const wireframe = new MeshBasicMaterial({
    color: new Color(wire),
    wireframe: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  // Sin este parche el wireframe mostraría la rosa entera mientras la
  // superficie sigue creciendo, y la sincronía entre los dos modos se rompería.
  patchGrowth(wireframe, uniforms, 'rose-structure-wire-v1')

  const points = new ShaderMaterial({
    vertexShader: POINTS_VERT,
    fragmentShader: POINTS_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    // Additivo: sobre el fondo casi negro hace que la estructura parezca
    // dibujarse con luz en lugar de pintarse encima.
    blending: AdditiveBlending,
  })

  return {
    wireframe,
    points,
    uniforms,
    dispose() {
      wireframe.dispose()
      points.dispose()
    },
  }
}
