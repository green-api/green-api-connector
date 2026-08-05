import { createRoot } from 'react-dom/client'
import { App } from './App'
import '../shared/theme.css'
import '../content/app-bridge'
createRoot(document.getElementById('root')!).render(<App />)
