/**
 * capture-all.mjs — Generación automatizada de capturas reales de la rosa y la experiencia.
 *
 * Utiliza puppeteer-core sobre Microsoft Edge para renderizar la aplicación web real
 * y capturar imágenes desde ángulos clave y en diferentes dispositivos:
 *   1. Vista Frontal
 *   2. Vista Superior (cenital)
 *   3. Vista Tres Cuartos (3/4)
 *   4. Vista Lateral (perfil)
 *   5. Vista Móvil (390×844 con dedicatoria interactiva completa)
 */

import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9229

// Servidor estático mínimo para dist/
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
}

const server = createServer((req, res) => {
  const urlPath = req.url.split('?')[0]
  let filePath = join('dist', urlPath === '/' ? 'index.html' : urlPath)
  if (!existsSync(filePath)) {
    filePath = join('dist', 'index.html')
  }
  const ext = extname(filePath)
  const mime = MIME[ext] || 'application/octet-stream'
  try {
    const data = readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': mime })
    res.end(data)
  } catch (err) {
    res.writeHead(404)
    res.end('Not found')
  }
})

await new Promise((resolve) => server.listen(PORT, resolve))
console.log(`Servidor local activo en http://localhost:${PORT}`)

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
})

// ── Capturas de Escritorio (1920×1080) ─────────────────────────────────────────
console.log('\nCapturando vistas de escritorio (1920×1080)...')
const pageDesktop = await browser.newPage()
await pageDesktop.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
await pageDesktop.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 16 })
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 })
})

await pageDesktop.goto(`http://localhost:${PORT}/?skip=true`, {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
})
// Esperar a que los shaders y texturas WebGL completen el primer render
await new Promise((r) => setTimeout(r, 2000))

// Encuadre inicial real (sin tocar la cámara): es el que ve el usuario al
// terminar el florecimiento.
await pageDesktop.screenshot({ path: 'capture-inicial.png', type: 'png' })
console.log('  ✓ Inicial (cámara por defecto) -> capture-inicial.png')

const desktopViews = [
  { name: 'capture-tres-cuartos.png', label: 'Tres Cuartos (3/4)', az: 34, el: 24 },
  { name: 'capture-frontal.png', label: 'Frontal', az: 0, el: 12 },
  { name: 'capture-superior.png', label: 'Superior (Cenital)', az: 0, el: 86 },
  { name: 'capture-lateral.png', label: 'Lateral (Perfil)', az: 90, el: 8 },
]

for (const v of desktopViews) {
  await pageDesktop.evaluate((az, el) => {
    if (window.__ROSE_CAMERA__) {
      window.__ROSE_CAMERA__.setAngles(az, el)
    }
  }, v.az, v.el)
  await new Promise((r) => setTimeout(r, 600))
  await pageDesktop.screenshot({ path: v.name, type: 'png' })
  console.log(`  ✓ ${v.label.padEnd(20)} -> ${v.name}`)
}

// ── Captura Móvil (390×844) ──────────────────────────────────────────────────
console.log('\nCapturando vista móvil (iPhone 12/13/14: 390×844)...')
const pageMobile = await browser.newPage()
await pageMobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await pageMobile.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 })
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 })
  const real = window.matchMedia.bind(window)
  window.matchMedia = (q) =>
    q.includes('pointer: coarse')
      ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} }
      : real(q)
})

await pageMobile.goto(`http://localhost:${PORT}/?skip=true`, {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
})
await new Promise((r) => setTimeout(r, 2000))

// Verificar overlap entre dedicatoria y flor
const overlapEval = await pageMobile.evaluate(() => {
  const ded = document.querySelector('.dedication')
  const dedRect = ded ? ded.getBoundingClientRect() : null
  return {
    dedicationRect: dedRect ? {
      top: dedRect.top,
      bottom: dedRect.bottom,
      height: dedRect.height,
    } : null,
    windowHeight: window.innerHeight,
  }
})

await pageMobile.screenshot({ path: 'capture-movil.png', type: 'png' })
console.log(`  ✓ Móvil con dedicatoria -> capture-movil.png`)

console.log('\nEvaluación de composición móvil:')
if (overlapEval.dedicationRect) {
  console.log(`  Dedicatoria top: ${overlapEval.dedicationRect.top.toFixed(1)}px de ${overlapEval.windowHeight}px (${((overlapEval.dedicationRect.top / overlapEval.windowHeight) * 100).toFixed(1)} % desde arriba)`)
  console.log(`  Espacio libre superior para la flor: ${((overlapEval.dedicationRect.top / overlapEval.windowHeight) * 100).toFixed(1)} % de la altura total de pantalla.`)
}

await browser.close()
server.close()
console.log('\nCapturas finalizadas con éxito.')
