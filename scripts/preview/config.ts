// Page configuration injected by scripts/lib/kit.mjs (pageConfig + renderPage) as window.__PREVIEW__,
// plus small helpers shared by the preview, the brand editor and the test page.

import type { Messages } from './browser-mock'

export interface EditorConfig {
  token: string
  api: { status: string; save: string; build: string; openFolder: string; closed: string }
  nameMax: number
  descriptionMax: number
}

export interface PageConfig {
  // preview - presentation; editor - preview + brand form (served by scripts/brand-editor.mjs); test - test page
  page: 'preview' | 'editor' | 'test'
  lang: string
  messenger: string
  version: string
  // marker the page uses in postMessage (src/shared/config.ts CONNECTOR_SOURCE) - test page only
  connectorSource: string
  // data: URLs of public/icons/icon{16,32,48,128}.png, embedded so every page is a single file
  icons: Record<string, string>
  // problems with the icon files found by the generator (wrong size, missing, not PNG)
  iconIssues: string[]
  // --primary-color from theme.css (light / dark)
  colors: { primary: string; primaryDark: string }
  locales: Record<string, Messages>
  // cross-links inside a release folder (preview.html <-> test/test-page.html)
  testPageHref?: string
  previewHref?: string
  editor?: EditorConfig
}

declare global {
  interface Window {
    __PREVIEW__?: PageConfig
  }
}

export const config: PageConfig = window.__PREVIEW__ ?? {
  page: 'preview', lang: 'en', messenger: 'WhatsApp', version: '', connectorSource: 'green-api-connector',
  icons: {}, iconIssues: [], colors: { primary: '#3b9702', primaryDark: '#3b9702' }, locales: {},
}

export const langs = Object.keys(config.locales)

const LANG_KEY = 'connector-preview-lang'

// Language priority: ?lang= in the URL > the user's last choice > the generator's --lang.
export function initialLang(): string {
  const fromUrl = new URLSearchParams(location.search).get('lang')
  let saved: string | null = null
  try { saved = localStorage.getItem(LANG_KEY) } catch { /* storage may be blocked */ }
  return [fromUrl, saved, config.lang].find((l): l is string => !!l && l in config.locales) ?? langs[0] ?? 'en'
}

export function rememberLang(lang: string): void {
  try { localStorage.setItem(LANG_KEY, lang) } catch { /* ignore */ }
}

// theme.css declares --primary-color under :root and under prefers-color-scheme: dark; this later <style>
// overrides both, so the brand colors apply to the real extension components and the page itself.
export function applyColors(colors: PageConfig['colors']): void {
  let style = document.getElementById('pv-brand-colors')
  if (!style) {
    style = document.createElement('style')
    style.id = 'pv-brand-colors'
    document.head.appendChild(style)
  }
  style.textContent = `:root { --primary-color: ${colors.primary}; }
@media (prefers-color-scheme: dark) { :root { --primary-color: ${colors.primaryDark}; } }`
}
