import { readFileSync, writeFileSync } from 'node:fs'

const norm = (s) => s.replace(/\r\n/g, '\n')

// 1. Update growth.ts
let growth = norm(readFileSync('src/shaders/growth.ts', 'utf8'))
const oldFragColor = norm(`const FRAG_COLOR = /* glsl */ \`
  diffuseColor.rgb *= mix(0.86, 1.14, vPetal) * (0.94 + 0.06 * sin(vPetal * 37.0));
\``)

const newFragColor = norm(`const FRAG_COLOR = /* glsl */ \`
  // Gradiente botánico aterciopelado: centro carmesí oscuro profundo, cuerpo carmesí rico y bordes cálidos
  vec3 cCore = vec3(0.22, 0.02, 0.05);
  vec3 cPetal = diffuseColor.rgb;
  vec3 cEdge = vec3(0.85, 0.18, 0.28);

  float pVar = 0.94 + 0.12 * sin(vPetal * 41.0 + 1.7);
  float grad = smoothstep(0.0, 0.85, vProg);
  vec3 velvetBase = mix(cCore, cPetal, 0.36 + 0.64 * grad);
  velvetBase = mix(velvetBase, cEdge, 0.15 * pow(grad, 2.0));
  diffuseColor.rgb = velvetBase * pVar;
\``)

if (growth.includes(oldFragColor)) {
  growth = growth.replace(oldFragColor, newFragColor)
  writeFileSync('src/shaders/growth.ts', growth, 'utf8')
  console.log('growth.ts updated!')
} else {
  console.log('growth.ts pattern not found or already updated')
}

// 2. Update MathematicalRose.tsx
let mathRose = norm(readFileSync('src/components/Rose/MathematicalRose.tsx', 'utf8'))
const oldMatParams = norm(`        roughness: 0.55,
        // Clearcoat bajo y muy rugoso: brillo de punta de pétalo sin plástico.
        // El terciopelo lo aporta \`sheen\`, que es el BRDF correcto aquí.
        clearcoat: 0.28,
        clearcoatRoughness: 0.72,
        sheen: 0.5,
        sheenRoughness: 0.85,
        emissiveIntensity: 0.12,`)

const newMatParams = norm(`        roughness: 0.78,
        // Acabado carmesí aterciopelado: CERO laca plástica (clearcoat = 0),
        // alta micro-rugosidad difusa y BRDF sheen de terciopelo completo.
        clearcoat: 0.0,
        clearcoatRoughness: 1.0,
        sheen: 1.0,
        sheenRoughness: 0.48,
        emissiveIntensity: 0.06,`)

if (mathRose.includes(oldMatParams)) {
  mathRose = mathRose.replace(oldMatParams, newMatParams)
  writeFileSync('src/components/Rose/MathematicalRose.tsx', mathRose, 'utf8')
  console.log('MathematicalRose.tsx updated!')
} else {
  console.log('MathematicalRose.tsx pattern not found or already updated')
}

// 3. Update CameraRig.tsx
let camRig = norm(readFileSync('src/components/Scene/CameraRig.tsx', 'utf8'))
const oldCamSetup = norm(`    if (!controls) return
    controls.target.set(f.target[0], f.target[1], f.target[2])
    targetV.current.set(f.target[0], f.target[1], f.target[2])
    controls.minDistance = f.distance * CAMERA.minDistanceScale
    controls.maxDistance = f.distance * CAMERA.maxDistanceScale

    // Sólo se coloca de cero si el usuario todavía no la ha tocado: un
    // resize no puede darle la vuelta a la flor que le estaba mirando.
    if (!touched.current) {
      camera.position.set(f.position[0], f.position[1], f.position[2])
      camera.lookAt(f.target[0], f.target[1], f.target[2])
    }`)

const newCamSetup = norm(`    if (!controls) return
    // Composición armónica: en vertical (móvil) y horizontal (escritorio),
    // desplazamos suavemente el objetivo hacia abajo para que la flor viva en la
    // zona superior y NUNCA se superponga con la dedicatoria en la zona inferior.
    const isPortrait = aspect < 1
    const yShift = isPortrait ? -bounds.radius * 0.24 : -bounds.radius * 0.10
    const targetY = f.target[1] + yShift

    controls.target.set(f.target[0], targetY, f.target[2])
    targetV.current.set(f.target[0], targetY, f.target[2])
    controls.minDistance = f.distance * CAMERA.minDistanceScale
    controls.maxDistance = f.distance * CAMERA.maxDistanceScale

    if (!touched.current) {
      camera.position.set(f.position[0], f.position[1] + yShift, f.position[2])
      camera.lookAt(f.target[0], targetY, f.target[2])
    }`)

if (camRig.includes(oldCamSetup)) {
  camRig = camRig.replace(oldCamSetup, newCamSetup)
  writeFileSync('src/components/Scene/CameraRig.tsx', camRig, 'utf8')
  console.log('CameraRig.tsx updated!')
} else {
  console.log('CameraRig.tsx pattern not found or already updated')
}

// 4. Update global.css for dedication positioning
let css = norm(readFileSync('src/styles/global.css', 'utf8'))
const oldDedCss = norm(`.dedication {
  position: absolute;
  left: 50%;
  bottom: calc(17% + var(--safe-b));
  transform: translateX(-50%);
  z-index: 4;
  width: min(90vw, 32rem);
  text-align: center;
  pointer-events: none;
}

.dedication__message {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: clamp(1.02rem, 4vw, 1.5rem);
  line-height: 1.62;
  letter-spacing: 0.01em;
  color: var(--ink);
  white-space: pre-line;
  text-wrap: balance;
}

.dedication__to {
  margin: clamp(1.1rem, 4.5vh, 2rem) 0 0;
  font-family: var(--font-sans);
  font-size: clamp(0.72rem, 3vw, 0.88rem);
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  opacity: 0.86;
}

.dedication__from {
  margin: 0.5rem 0 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: clamp(0.66rem, 2.6vw, 0.78rem);
  letter-spacing: 0.05em;
  color: var(--ink-faint);
}`)

const newDedCss = norm(`.dedication {
  position: absolute;
  left: 50%;
  bottom: calc(4% + var(--safe-b));
  transform: translateX(-50%);
  z-index: 4;
  width: min(88vw, 30rem);
  text-align: center;
  pointer-events: none;
}

.dedication__message {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: clamp(0.92rem, 3.4vw, 1.35rem);
  line-height: 1.55;
  letter-spacing: 0.01em;
  color: var(--ink);
  white-space: pre-line;
  text-wrap: balance;
}

.dedication__to {
  margin: clamp(0.75rem, 2.2vh, 1.35rem) 0 0;
  font-family: var(--font-sans);
  font-size: clamp(0.68rem, 2.5vw, 0.82rem);
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  opacity: 0.88;
}

.dedication__from {
  margin: 0.35rem 0 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: clamp(0.62rem, 2.2vw, 0.72rem);
  letter-spacing: 0.05em;
  color: var(--ink-faint);
}`)

if (css.includes(oldDedCss)) {
  css = css.replace(oldDedCss, newDedCss)
  css = css.replace('bottom: calc(5% + var(--safe-b));', 'bottom: calc(1.8% + var(--safe-b));')
  writeFileSync('src/styles/global.css', css, 'utf8')
  console.log('global.css updated!')
} else {
  console.log('global.css pattern not found or already updated')
}
