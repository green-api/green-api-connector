import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'

import manifest, { MESSENGER } from './manifest.config'

// @crxjs/vite-plugin builds a manifest that only works in Chrome, so we patch it
function crossBrowserManifest(): Plugin {
    return {
        name: 'cross-browser-manifest',
        writeBundle(options) {
            const outDir = options.dir
            if (!outDir) {
                throw new Error('cross-browser-manifest: output directory is not set')
            }

            const manifestPath = join(outDir, 'manifest.json')
            const manifestJson = JSON.parse(readFileSync(manifestPath, 'utf-8'))
            const serviceWorker = manifestJson.background?.service_worker
            if (!serviceWorker) {
                throw new Error('cross-browser-manifest: manifest.background.service_worker not found')
            }

            manifestJson.background.scripts = [serviceWorker]

            for (const entry of manifestJson.web_accessible_resources ?? []) {
                if (entry.use_dynamic_url === true) {
                    throw new Error(
                        `cross-browser-manifest: web_accessible_resources entry for ${JSON.stringify(entry.resources)} has use_dynamic_url: true, refusing to drop it`
                    )
                }
                delete entry.use_dynamic_url
            }

            writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2) + '\n')
        },
    }
}

export default defineConfig({
    plugins: [react(), crx({ manifest }), crossBrowserManifest()],
    publicDir: 'public',
    build: {
        outDir: 'dist',
        modulePreload: false,
        rollupOptions: {
            input: {
                popout: 'popout.html',
            },
        },
    },
    resolve: {
        alias: {
            '@messenger': resolve(__dirname, `src/packages/${MESSENGER}`),
        },
    }
})
