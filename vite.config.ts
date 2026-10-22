import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` deja el build independiente del path de despliegue:
// funciona igual en la raíz de un dominio, en un subdirectorio de Vercel
// o abierto directamente desde el disco.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        // Separar three.js del resto: es el trozo que tarda más en parsear y
        // dejarlo en su propio caché-inmutable mejora el primer pintado en
        // cargas siguientes. Windows pasa las rutas con barras invertidas,
        // así que se normaliza antes de comparar.
        manualChunks(id: string) {
          const p = id.split('\\').join('/')
          if (p.includes('node_modules/three/')) return 'three'
          if (
            p.includes('node_modules/@react-three/') ||
            p.includes('node_modules/postprocessing/') ||
            p.includes('node_modules/three-stdlib/')
          ) {
            return 'r3f'
          }
          if (p.includes('node_modules/katex/')) return 'katex'
          if (p.includes('node_modules/framer-motion/')) return 'motion'
          return undefined
        },
      },
    },
  },
})