// White label overrides. The default brand (GREEN-API) lives in public/_locales, public/icons,
// src/shared/theme.css and the <title> of index.html / popout.html and is NEVER modified for a client.
// A client brand lives only in branding/ and is applied on top of the defaults at build time
// (vite.config.ts -> brandingOverrides) and by the preview pages (scripts/lib/kit.mjs):
//
//   branding/brand.json       { "name": {"en","ru"}, "description": {"en","ru"}, "colors": {"primary","primaryDark"},
//                               "firefoxId"?: "connector@company.com", "trustedDomains"?: ["partner.com"] }
//   branding/icons/icon{16,32,48,128}.png
//
// firefoxId (optional) replaces browser_specific_settings.gecko.id - needed only to publish on addons.mozilla.org,
// where the first upload claims the ID forever. Without it the build keeps the official OFFICIAL_FIREFOX_ID.
//
// trustedDomains (optional) - extra domains whose pages may control the extension, ADDED to TRUSTED_DOMAINS in
// src/shared/config.ts and trusted the same way: the domain and all its subdomains, https only.
//
// No branding/brand.json -> the default brand is built. CONNECTOR_BRANDING=off in the environment ignores branding/
// (npm run release -- --default-brand).
//
// brands/<id>/ - built-in brand presets for MAINTAINERS (e.g. brands/qr-connector), same format as branding/.
// CONNECTOR_BRAND=<id> builds that preset instead of branding/ (npm run release:qr). Never offered to clients.
//
// Only Node built-ins here (used by vite.config.ts too).

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const BRANDING_DIR = 'branding'
export const BRANDS_DIR = 'brands'
export const ICON_SIZES = [16, 32, 48, 128]

// browser_specific_settings.gecko.id in manifest.config.ts - reserved for the official GREEN-API build.
export const OFFICIAL_FIREFOX_ID = '@green-api-connector'
// Add-on ID formats accepted by Firefox: email-like ("name@domain", the name part may be empty) or a {GUID}.
export const FIREFOX_ID_RE = /^(?:[a-zA-Z0-9._-]*@[a-zA-Z0-9._-]+|\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\})$/
export const FIREFOX_ID_MAX = 80
// A trusted domain: lowercase dot-separated labels of letters, digits and inner hyphens (punycode "xn--" included).
export const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
export const isDomainList = (list) => Array.isArray(list) && list.every((d) => typeof d === 'string' && DOMAIN_RE.test(d))

/**
 * @typedef {{ name: Record<string,string>, description: Record<string,string>,
 *   colors: { primary?: string, primaryDark?: string }, firefoxId: string | null, trustedDomains: string[],
 *   icons: Record<string,string>, dir: string }} Branding
 */

/** Folder of the brand applied to builds (relative to root): brands/<id> (CONNECTOR_BRAND), branding, or null */
export function brandingSource(root) {
  const preset = process.env.CONNECTOR_BRAND
  if (preset) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(preset)) throw new Error(`invalid CONNECTOR_BRAND "${preset}"`)
    const dir = `${BRANDS_DIR}/${preset}`
    if (!existsSync(join(root, dir, 'brand.json'))) throw new Error(`brand preset not found: ${dir}/brand.json`)
    return dir
  }
  if (process.env.CONNECTOR_BRANDING === 'off') return null
  return existsSync(join(root, BRANDING_DIR, 'brand.json')) ? BRANDING_DIR : null
}

/** @returns {Branding | null} the brand from brands/<id> or branding/, or null when the default brand is built */
export function loadBranding(root) {
  const source = brandingSource(root)
  if (!source) return null
  const dir = join(root, source)
  const file = join(dir, 'brand.json')
  const data = JSON.parse(readFileSync(file, 'utf-8'))
  const icons = {}
  for (const size of ICON_SIZES) {
    const path = join(dir, 'icons', `icon${size}.png`)
    if (existsSync(path)) icons[size] = path
  }
  const firefoxId = typeof data.firefoxId === 'string' && data.firefoxId.trim() ? data.firefoxId.trim() : null
  if (firefoxId && !FIREFOX_ID_RE.test(firefoxId)) throw new Error(`${source}/brand.json: invalid firefoxId "${firefoxId}"`)
  const trustedDomains = data.trustedDomains ?? []
  if (!isDomainList(trustedDomains)) throw new Error(`${source}/brand.json: trustedDomains must be a list of domains like partner.com`)
  return { name: data.name ?? {}, description: data.description ?? {}, colors: data.colors ?? {}, firefoxId, trustedDomains, icons, dir }
}

/** manifest.json text with the brand Firefox add-on ID (unchanged when the brand has none) */
export function brandManifestJson(json, branding) {
  if (!branding?.firefoxId) return json
  const manifest = JSON.parse(json)
  if (!manifest.browser_specific_settings?.gecko) return json
  manifest.browser_specific_settings.gecko.id = branding.firefoxId
  return JSON.stringify(manifest, null, 2) + '\n'
}

// Replaces the "message" value of one key in a messages.json text, keeping the rest of the file as is.
function setMessage(json, key, value) {
  if (typeof value !== 'string' || !value) return json
  const re = new RegExp(`("${key}"\\s*:\\s*\\{\\s*"message"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`)
  return json.replace(re, (_, prefix) => prefix + JSON.stringify(value))
}

/** messages.json text of one locale with the brand name/description applied */
export function brandMessagesJson(json, branding, lang) {
  if (!branding) return json
  return setMessage(setMessage(json, 'extName', branding.name[lang]), 'extDescription', branding.description[lang])
}

/** theme.css text with the brand primary colors (1st declaration - light theme, 2nd - dark theme) */
export function brandThemeCss(css, branding) {
  const { primary, primaryDark } = branding?.colors ?? {}
  if (!primary && !primaryDark) return css
  let n = 0
  return css.replace(/(--primary-color:\s*)([^;]+);/g, (match, prefix, current) => {
    n += 1
    const value = n === 1 ? primary : (primaryDark ?? primary)
    return `${prefix}${value ?? current};`
  })
}

/** HTML with the brand name in <title> (English name - window titles are not localized) */
export function brandHtmlTitle(html, branding) {
  const name = branding?.name?.en ?? Object.values(branding?.name ?? {})[0]
  if (!name) return html
  const escaped = name.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escaped}</title>`)
}
