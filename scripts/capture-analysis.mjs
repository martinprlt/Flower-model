/**
 * capture-analysis.mjs — Capturas comparables flor / fondo.
 *
 * Genera, para cada ángulo, dos PNG con EXACTAMENTE la misma cámara y el mismo
 * viewport:
 *
 *   analysis/bg-<vista>.png       escena sin la rosa (fase INTRO, uProgress = 0)
 *   analysis/flower-<vista>.png   rosa completa (?skip=true)
 *
 * La diferencia entre ambas es la máscara real de la flor: permite medir qué
 * parte de la flor está casi negra en la app, sin adivinar el encuadre.
 *
 *   node scripts/capture-analysis.mjs
 */

import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9231
const OUT = 'analysis'
if (!existsSync(OUT)) mkdirSync(OUT)

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
  if (!existsSync(filePath)) filePath = join('dist', 'index.html')
  const mime = MIME[extname(filePath)] || 'application/octet-stream'
  try {
    res.writeHead(200, { 'Content-Type': mime })
    res.end(readFileSync(filePath))
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})
await new Promise((r) => server.listen(PORT, r))

const HIDE_UI = `
  .intro-text, .dedication, .hint, .corners, .vignette,
  .loading-dot, .debug-panel { display: none !important; }
`

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

const VIEWS = [
  { name: 'tres-cuartos', az: 34, el: 24 },
  { name: 'frontal', az: 0, el: 12 },
  { name: 'superior', az: 0, el: 72 },
  { name: 'lateral', az: 90, el: 8 },
]

async function waitForHook(page) {
  await page.waitForFunction('!!window.__ROSE_CAMERA__', { timeout: 20000 })
}

async function setView(page, az, el) {
  await page.evaluate((a, e) => window.__ROSE_CAMERA__.setAngles(a, e), az, el)
  await new Promise((r) => setTimeout(r, 180))
}

// ── Fondo: INTRO antes de que exista el capullo ──────────────────────────────
{
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
  // El headless suele reportar 4 núcleos y haría caer la app en tier low.
  // Para AUDITAR la experiencia de escritorio se fuerza high de forma
  // determinista; si no, se mediría una versión sin sombras ni bloom.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 16 })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 })
  })
  // Se intercepta el primer render con la UI oculta. La intro dura >3 s antes
  // del punto de luz, así que a esta altura la escena es sólo fondo.
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.addStyleTag({ content: HIDE_UI })
  await waitForHook(page)
  for (const v of VIEWS) {
    await setView(page, v.az, v.el)
    await page.screenshot({ path: `${OUT}/bg-${v.name}.png`, type: 'png' })
    console.log(`  bg ${v.name}`)
  }
  await page.close()
}

// ── Fondo móvil: mismo encuadre, tier low ────────────────────────────────────
{
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 })
    const real = window.matchMedia.bind(window)
    window.matchMedia = (q) =>
      q.includes('pointer: coarse')
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} }
        : real(q)
  })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.addStyleTag({ content: HIDE_UI })
  await waitForHook(page)
  for (const v of VIEWS) {
    await setView(page, v.az, v.el)
    await page.screenshot({ path: `${OUT}/bg-mobile-${v.name}.png`, type: 'png' })
    console.log(`  bg-mobile ${v.name}`)
  }
  await page.close()
}

// ── Flor: modo interactivo, misma cámara ─────────────────────────────────────
async function flowerPage(width, height, name) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  const mobile = width < 600
  await page.evaluateOnNewDocument((isMobile) => {
    if (isMobile) {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 })
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 })
      const real = window.matchMedia.bind(window)
      window.matchMedia = (q) =>
        q.includes('pointer: coarse')
          ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} }
          : real(q)
    } else {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 16 })
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 })
    }
  }, mobile)
  await page.goto(`http://localhost:${PORT}/?skip=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page.addStyleTag({ content: HIDE_UI })
  await waitForHook(page)
  await new Promise((r) => setTimeout(r, 1200))
  for (const v of VIEWS) {
    await setView(page, v.az, v.el)
    await page.screenshot({ path: `${OUT}/${name}-${v.name}.png`, type: 'png' })
    console.log(`  ${name} ${v.name}`)
  }
  await page.close()
}

await flowerPage(1920, 1080, 'flower')
await flowerPage(390, 844, 'flower-mobile')

await browser.close()
server.close()
console.log(`\nCapturas en ${OUT}/`)
