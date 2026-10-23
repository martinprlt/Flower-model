import { readFileSync, writeFileSync } from 'node:fs'

let content = readFileSync('src/config.ts', 'utf8')

// Replace PALETTE
const oldPalette = `export const PALETTE = {
  /** Centro del capullo. */
  core: '#5A0716',
  /** Color base de los pétalos. */
  petal: '#8F1028',
  /** Zonas iluminadas. */
  lit: '#C72543',
  /** Bordes y brillos. */
  highlight: '#E14B63',
  /** Color del resplandor durante el crecimiento y del pulso al tocar. */
  glow: '#FF5A6E',
  /** Luz de contra. */
  rim: '#FF8A94',

  /** Fondo: degradado vertical de tres paradas. Nunca negro puro. */
  bgTop: '#070304',
  bgMid: '#100408',
  bgBottom: '#16060B',
  /** Halo radial detrás de la rosa. */
  halo: '#3A0A16',

  /** Estructura matemática visible. */
  wire: '#FF7A8C',
  point: '#FFB3BE',

  /** Luz key cálida, fill rojiza y ambiente. */
  lightAmbient: '#2A0A12',
  lightKey: '#FFD9C2',
  lightFill: '#7A0E22',
} as const`

const newPalette = `export const PALETTE = {
  /** Centro del capullo aterciopelado: carmesí oscuro profundo. */
  core: '#3A030D',
  /** Color base aterciopelado de los pétalos. */
  petal: '#8E0F28',
  /** Zonas iluminadas aterciopeladas. */
  lit: '#BD1B3B',
  /** Bordes y destellos de terciopelo. */
  highlight: '#DC3656',
  /** Color del resplandor durante el crecimiento y del pulso al tocar. */
  glow: '#FF4D6B',
  /** Luz de contra aterciopelada. */
  rim: '#FF758C',

  /** Fondo: degradado vertical de tres paradas. Nunca negro puro. */
  bgTop: '#070304',
  bgMid: '#100408',
  bgBottom: '#16060B',
  /** Halo radial detrás de la rosa. */
  halo: '#3A0A16',

  /** Estructura matemática visible. */
  wire: '#FF7A8C',
  point: '#FFB3BE',

  /** Luz key cálida, fill rojiza y ambiente. */
  lightAmbient: '#22060E',
  lightKey: '#FFF0E6',
  lightFill: '#6E0A1E',
} as const`

if (content.includes("core: '#5A0716'")) {
  content = content.replace(/export const PALETTE = \{[\s\S]*?\} as const/, newPalette)
  writeFileSync('src/config.ts', content, 'utf8')
  console.log('src/config.ts updated!')
} else {
  console.log('src/config.ts already updated or pattern not found')
}
