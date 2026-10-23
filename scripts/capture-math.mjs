/**
 * capture-math.mjs — Regresión del panel matemático y del modo MATEMÁTICA.
 *
 *   node scripts/capture-math.mjs
 *
 * Guarda analysis/math-panel.png y analysis/math-mode.png y falla si KaTeX
 * dejó alguna fórmula con error.
 */

import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9232
if (!existsSync('analysis')) mkdirSync('analysis')

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
}
const server = createServer((req, res) => {
  const urlPath = req.url.split('?')[0]
  let filePath = join('dist', urlPath === '/' ? 'index.html' : urlPath)
  if (!existsSync(filePath)) filePath = join('dist', 'index.html')
  try {
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(readFileSync(filePath))
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})
await new Promise((r) => server.listen(PORT, r))

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 16 })
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 })
})
await page.goto(`http://localhost:${PORT}/?skip=true`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction('!!window.__ROSE_CAMERA__', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 1200))

await page.click('.corner-btn--math')
await new Promise((r) => setTimeout(r, 900))
const texErrors = await page.evaluate(() => document.querySelectorAll('.katex-error').length)
await page.screenshot({ path: 'analysis/math-panel.png', type: 'png' })
console.log(`math-panel.png  errores KaTeX: ${texErrors}`)

await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.mode-tab')]
  const math = tabs.find((t) => t.textContent?.includes('MATEM'))
  math?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 400))
await page.click('.math-close')
await new Promise((r) => setTimeout(r, 1200))
await page.screenshot({ path: 'analysis/math-mode.png', type: 'png' })
console.log('math-mode.png')

await browser.close()
server.close()
if (texErrors > 0) process.exit(1)
