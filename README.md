# Una rosa que no puede marchitarse

Una rosa 3D generada **íntegramente a partir de ecuaciones paramétricas**.
No hay modelos externos, ni imágenes, ni geometría descargada: cada vértice de
la flor es la evaluación de una fórmula.

La experiencia es una sola pantalla. Al abrir el enlace:

```
pantalla oscura
  → "Las flores se marchitan…"
  → un pequeño punto rojo
  → nacen puntos y aristas matemáticas
  → la superficie, el volumen, el material y las luces
  → la rosa, girando lentamente
  → "…así que te hice una que no puede hacerlo."
```

## Arrancar

```bash
npm install
npm run dev
```

## Comprobar que nada está roto

```bash
npm run validate   # 44 + 36 comprobaciones; sale con código != 0 si falla
npm run typecheck
npm run build      # producción, listo para Vercel
```

`npm run validate` es la parte importante si vas a tocar la matemática. Hay
dos scriptos por una razón: la geometría se valida en terminal **antes** de
toca nada más, y un fallo en la parametrización es exactamente lo que no se
nota hasta que se ve.

| Comando | Qué comprueba |
|---|---|
| `npm run validate:rose` | `X(φ)` contra sus valores exactos, ortonormalidad del marco, ausencia de NaN, triángulos degenerados, proporción d/h, orden centro→exterior, presupuesto de vértices, y **renders ASCII de la silueta** (3/4, perfil y cenital) para que puedas ver la forma desde un terminal |
| `npm run validate:experience` | Ordenamiento del crecimiento del shader, duración de la secuencia narrativa, y encuadre de cámara en 360×640 / 390×844 / 430×932 / 1366×768 / 1920×1080 (¿la rosa se recorta en móvil? era un fallo real que encontró esta comprobación) |
| `npm run render` | PNG de cuatro vistas para mirar la forma en un visor: `npm run render out.png` |

## Dónde cambiar qué

Todo lo textual, de color, de tiempo y de cámara vive en **`src/config.ts`**.
Ningún componente tiene estos valores hardcodeados.

### Personas y frases — `src/config.ts › GIFT` y `COPY`

```ts
export const GIFT = {
  recipient: 'Bárbara',
  sender: 'Emi',
  heart: '♡',
}

export const COPY = {
  introLead: 'Las flores se marchitan…',
  message:   'Las flores se marchitan,\nasí que te hice una\nque no puede hacerlo.',
  dedication: `Para ${GIFT.recipient} ${GIFT.heart}`,
  signoff:    `— ${GIFT.sender}`,
  hint: 'Arrástrala · tócala',
  // ...
}
```

`dedication` y `signoff` se derivan de `GIFT`, así que cambiar sólo el nombre
basta.

### Colores — `src/config.ts › PALETTE`

| Clave | Uso | Valor actual |
|---|---|---|
| `core` | centro del capullo | `#5A0716` |
| `petal` | color base de los pétalos | `#8F1028` |
| `lit` | zonas iluminadas | `#C72543` |
| `highlight` | bordes y brillos | `#E14B63` |
| `glow` | resplandor del crecimiento y pulso al tocar | `#FF5A6E` |
| `rim` | luz de contra | `#FF8A94` |
| `bgTop` / `bgMid` / `bgBottom` | fondo degradado, nunca negro puro | `#070304` / `#100408` / `#16060B` |
| `halo` | halo radial tras la rosa | `#3A0A16` |
| `wire` / `point` | estructura matemática | `#FF7A8C` / `#FFB3BE` |

Si cambias `bgTop`, recuerda que `index.html` tiene una copia del valor en CSS
en línea (está ahí para evitar el flash blanco). Ambos tienen que coincidir.

### Duraciones — `src/config.ts › TIMING` y `REDUCED`

Milisegundos. `REDUCED` es la misma tabla comprimida para
`prefers-reduced-motion`.

| Clave | ms | Qué |
|---|---|---|
| `introDark` | 750 | oscuridad antes de la frase |
| `introHold` | 2050 | cuánto se queda la frase |
| `introGap` | 400 | silencio después |
| `glowLead` | 250 | encendido del punto central |
| `grow` | 6200 | florecimiento |
| `bloomHold` | 700 | pausa con la rosa ya formada |
| `pushIn` | 2600 | acercamiento de cámara |
| `messageFade` | 1200 | fundido del mensaje |
| `hintLife` | 5200 | vida de la pista "arrástrala" |

### Cámara — `src/config.ts › CAMERA`

`secondsPerRevolution: 78` es la rotación automática (ajústalo entre 60 y
100). `minDistanceScale` / `maxDistanceScale` limitan el zoom, y
`minPolarDeg` / `maxPolarDeg` impiden poner la cámara por debajo del borde o
en cenital puro.

### La rosa — `src/math/rose.ts › ROSE_PARAMS`

**Es el único archivo que hay que tocar para cambiar la forma.** Los tres
tiers (`low`, `mid`, `high`) comparten los parámetros de forma y sólo cambian
la resolución, así que la rosa se ve igual en un teléfono y en un portátil.

| Parámetro | Qué hace |
|---|---|
| `thetaMap`, `phiExp` | cómo se abre la flor. φ va de 90° en el centro a ~12° en el borde; `phiExp = 2.2` concentra la apertura en el último tercio, que es lo que hace que el perfil lateral sea un cuenco y no un embudo. **Es el knob principal** |
| `chiMax`, `rbMin`, `rbMax`, `yTop`, `yDrop` | cúpula del receptáculo: dónde se atan los pétalos. Un perfil cónico (bases alineadas en una vertical) produce justo el cono que no quieres |
| `l0`, `lBias`, `lExp` | longitud del pétalo: corto y erguido en el centro, largo y abierto en el borde |
| `hExp > rExp` | el curl: la punta cae más rápido de lo que avanza, así que el pétalo se recurre en lugar de ser una rampa recta |
| `wFrac`, `wTip`, `wMin`, `ringExp` | ancho. **El semiancho escala con `l0`, no con el radio global**: si escala con el radio, los 18 pétalos interiores se quedan todos clavados en `wMin` y amontonan el 60 % de los vértices en un radio de 2 |
| `cup`, `psiOpen` | profundidad del cuenco y cuánto se abre el barrido de la sección (2π = tubo casi sellado, 0.58π = cuenco) |
| `azJit`, `tw0`, `tw1`, `tw2` | ondulación y torción **deterministas** (sin `Math.random()` en ningún sitio) |
| `petals`, `qSeg`, `arcSeg` | resolución. Alta = 34 × 4 × 112 ≈ 15 k vértices; baja ≈ 2.3 k |

Después de cambiar cualquiera de esto, corre `npm run validate:rose` y mira
los renders ASCII. Es exactamente para lo que está.

## Matemáticas

Todo vive en `src/math/rose.ts`, que **no importa three.js** — devuelve números
y typed arrays, de ahí que se pueda validar en Node sin navegador. El paso a
`THREE.BufferGeometry` ocurre en `src/math/geometry.ts`.

Las dos ecuaciones originales están sin modificar:

```
φ(θ) = (π/2)·e^(−θ/8π)     elevación del pétalo
X(θ) = 1 − ½·[(5/4)(1 − (θ mod 2π)/π)² − ¼]²     perfil de contorno
```

`φ` se lee como el ángulo de elevación del plano de cada pétalo: 90° en el
centro (verticales, capullo), 12° en el borde (abiertos).

`X` **no** es una rosa multipétalo, y eso está verificado numéricamente en
`validate:rose`: rango `[0.5, 1.0]`, dos crestas en `θ/π = 1 ± 1/√5`, una
cúspide en el límite de período con pendiente ∓2.5. Es un perfil de **un**
pétalo con su meseta y su cúspide justo en la costura.

La tercera ecuación original se **descarta**, por tres motivos
independientes:

1. usa `y` antes de haberlo definido (está en ambos lados del par ordenado);
2. resta un ángulo (`θ·cos φ`) a una coordenada (`y·sin φ`);
3. toma `X(...)` como `z` directamente, y con `X ∈ [0.5, 1]` eso da un disco
   ondulado de media unidad de alto con `r` nunca asignado.

La sustitución documentada en el propio archivo es una espiral filotáxica de
cáscaras cóncavas sobre una cúpula:

```
θ = 2π(n + q/2)                 X barre medio período por pétalo
βₙ = n·π(3−√5) ≈ n·137.507°     ángulo áureo, sin costuras
marco e1, e2, e3                 en forma cerrada, sin productos cruzados
```

El marco merece una nota: el `e2 = up × e1` que se suele usar colapsa cuando
`φ = 90°`, que es justo dentro del capullo. Aquí `e2 = (sinβ, 0, −cosβ)` es
siempre horizontal, así que no hay ninguna orientación en la que el marco se
degenera. Está verificado a 1e-12 en el validador.

Las ecuaciones completas, incluida la parametrización final, se muestran en
la aplicación (botón **π**) renderizadas con KaTeX.

## Arquitectura

```
src/
├── config.ts                     TODO el texto, los colores, los tiempos
├── state.ts                      máquina de estados + línea de tiempo
├── math/
│   ├── rose.ts                   la matemática (cero three.js)
│   └── geometry.ts               BufferGeometry + encuadre de cámara
├── shaders/
│   └── growth.ts                 cómo nace la rosa (onBeforeCompile)
├── hooks/                        useQuality, useReducedMotion
├── components/
│   ├── Experience.tsx            el Canvas y la escena
│   ├── Rose/                     MathematicalRose, MathModel, CoreGlow, partículas
│   ├── Scene/                    Background, Lighting, CameraRig, Effects, debug
│   └── UI/                       Intro, Dedication, MathPanel, hint, botones
└── styles/global.css
scripts/
├── validate-rose.mjs
├── validate-experience.mjs
└── render-rose.mjs
```

### Estados

`LOADING → INTRO → GROWING → BLOOMED → INTERACTIVE`

Un único `requestAnimationFrame` en `App.tsx` decide cuándo pasa cada cosa.
No hay un solo `setTimeout` repartido por los componentes.

Los valores que van a 60 fps (`grow`, el resplandor del frente, la
disolución) **no** pasan por `setState`: se escriben en `state.ts › timeline`,
un objeto mutable, y se leen dentro de `useFrame`. Si fueran props, React
remontaría la escena cientos de veces durante el florecimiento.

### Cómo crece la rosa

No es `opacity: 0 → 1`. Cada vértice lleva un atributo `aProgress` (0 en el
centro, 1 en el borde) y un `smoothstep(aProgress, aProgress + w, uProgress)`
lo revela. Los argumentos van en ese orden: al revés, la rosa entera se ve
desde el primer frame. Por eso además `uProgress` se empuja hasta `1 + w` al
final, o el último anillo nunca terminaría de crecer.

Se parchea `MeshPhysicalMaterial` con `onBeforeCompile` en vez de escribir un
`ShaderMaterial` propio, para conservar PBR, sombras, tone mapping y
colorspace sin reimplementarlos. La sombra necesita su propio gemelo
(`MeshDepthMaterial` con el mismo parche) porque si no, el pase de profundidad
ve la rosa completa y proyecta una flor que todavía no existe.

### Modo MATEMÁTICA

Tres objetos comparten **la misma `BufferGeometry`**: la superficie, su
wireframe y su nube de puntos. La transición cruza sus opacidades, así que no
se sustituye nada de golpe.

```
sólido → semitransparente + wireframe → wireframe + puntos
```

El wireframe lleva el mismo parche de crecimiento que la superficie; sin él,
mostraría la rosa entera mientras la superficie sigue creciendo.

`gl.lineWidth` está clampeado a 1 en casi todas las plataformas: el wireframe
no se puede engrosar, y no hace falta — 1 px sobre el fondo oscuro se lee
bien.

## Comportamiento y accesibilidad

- **Rotación automática**: no usa `controls.autoRotate`. Leído el código de
  three y drei, es dependiente del framerate y su delta comparte el buffer de
  inercia con el arrastre, así que al reanudar salta. Aquí se rota la cámara
  a mano y la velocidad pasa por `MathUtils.damp`, que es continua: arrancar
  y parar son C0 **por diseño**.
- **`prefers-reduced-motion`**: la secuencia completa se comprime de 12.9 s a
  3.2 s, sin acercamiento de cámara, sin partículas, sin bloom.
- **Rendimiento**: tier detectado una sola vez al arrancar (`low` / `mid` /
  `high`). El tier `low` desactiva las sombras — en móvil el coste real no
  son los triángulos sino la pasada de sombras — y baja el DPR a 1.5.
  Máximo 15 513 vértices en `high`.
- **`100dvh`**, `viewport-fit=cover`, `env(safe-area-inset-*)`, sin scroll.
- **Audio**: nunca se reproduce nada automáticamente. Sin pista configurada
  en `AUDIO.trackUrl` el botón no aparece y no se carga ni un byte de audio.
  Para añadir música: pon una ruta en esa clave.

## Despliegue

```bash
npm run build
```

`vite.config.ts` usa `base: './'`, así que `dist/` funciona igual en la raíz
de un dominio, en un subdirectorio o abierto desde el disco. Subirlo a Vercel
como proyecto estático de Vite no necesita configuración: detecta el comando
y la salida automáticamente.

`vercel.json` opcional está incluido sólo para dar `Cache-Control` inmutable a
`/assets/`.

## Depuración

```
?debug=true
```

Muestra ejes, bounding box, y un panel con FPS, tier, DPR, vértices,
triángulos, bbox, aspecto, φ del borde y fase actual. En producción no se
ejecuta una sola línea de esto.

## Lo que NO hay

Sin modelos 3D externos. Sin imágenes. Sin rosa CSS. Sin navbar, footer ni
secciones debajo. Sin corazones. Sin glitter. Sin audio automático. Sin
`Math.random()` en ningún sitio — las motas usan un LCG sembrado para que la
escena sea idéntica en cada carga.