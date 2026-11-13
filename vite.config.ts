import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'

import manifest, { MESSENGER } from './manifest.config'
import { brandHtmlTitle, brandMessagesJson, brandThemeCss, loadBranding } from './scripts/lib/branding.mjs'

// White label: applies branding/ (if present) on top of the default brand in the BUILD OUTPUT only -
// public/_locales, public/icons, src/shared/theme.css and the HTML titles in the repo stay untouched.
function brandingOverrides(): Plugin {
    const branding = loadBranding(__dirname)
    return {
        name: 'branding-overrides',
        enforce: 'pre',
        transform(code, id) {
            if (branding && id.split('?')[0].replace(/\\/g, '/').endsWith('/src/shared/theme.css')) {
                return { code: brandThemeCss(code, branding), map: null }
            }
            return undefined
        },
        transformIndexHtml(html) {
            return branding ? brandHtmlTitle(html, branding) : html
        },
        writeBundle(options) {
            const outDir = options.dir
            if (!branding || !outDir) return

            const localesDir = join(outDir, '_locales')
            for (const lang of existsSync(localesDir) ? readdirSync(localesDir) : []) {
                const path = join(localesDir, lang, 'messages.json')
                if (existsSync(path)) writeFileSync(path, brandMessagesJson(readFileSync(path, 'utf-8'), branding, lang))
            }
            for (const [size, source] of Object.entries(branding.icons)) {
                copyFileSync(source, join(outDir, 'icons', `icon${size}.png`))
            }
        },
    }
}

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
    plugins: [brandingOverrides(), react(), crx({ manifest }), crossBrowserManifest()],
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
