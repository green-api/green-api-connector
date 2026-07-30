import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'

import manifest from './manifest.config'

const target = process.env.TARGET === 'firefox' ? 'firefox' : 'chrome';
export default defineConfig({ 
    plugins: [react(), crx({ manifest, browser: target})], 
    publicDir: 'public' 
})
