import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './styles/global.css'
import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Falta #root')

// Sin <StrictMode>: R3F + React 19 invocan los efectos dos veces y cada
// montaje limpia la geometría compartida en el return del effect, lo que deja
// el lienzo en negro en el segundo montaje. La escena no necesita probar nada
// doble.
createRoot(container).render(<App />)