// Shared helpers for the client tooling scripts (WhatsApp-only client flows):
//   scripts/brand-editor.mjs  - White label editor: install deps -> Save brand -> Build release   (npm run brand-editor)
//   scripts/release.mjs       - release folder with the current brand / quick preview          (npm run release / preview)
//
// Brand = defaults (GREEN-API: public/_locales, public/icons, src/shared/theme.css) + the client's overrides in
// branding/ (see scripts/lib/branding.mjs). The defaults are never modified; Save writes only branding/.
// Only Node built-ins are imported at the top level, so the dependency check works before `npm ci` ran.

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync } from 'node:zlib'
import { BRANDING_DIR, ICON_SIZES, brandMessagesJson, brandThemeCss, loadBranding } from './branding.mjs'

export { ICON_SIZES }

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const RELEASE_DIR = join(ROOT, 'release')
export const CONFIG_PATH = join(ROOT, 'src/shared/config.ts')
export const THEME_PATH = join(ROOT, 'src/shared/theme.css')
export const LOCALES_DIR = join(ROOT, 'public/_locales')
export const ICONS_DIR = join(ROOT, 'public/icons')
export const BRANDING_PATH = join(ROOT, BRANDING_DIR)
export const NAME_MAX = 45
export const DESCRIPTION_MAX = 132
export const MESSENGER_NAMES = { whatsapp: 'WhatsApp', max: 'MAX' }
// Client flows (preview, release, brand editor, AGENTS.md scenarios) are WhatsApp-only.
// Other messengers (build:max) are for maintainers: node scripts/release.mjs --messenger max
export const CLIENT_MESSENGER = 'whatsapp'
export const MIN_NODE_MAJOR = 18

const DEV_MODE_RE = /const DEV_MODE\s*=\s*(true|false)\s*;?/

// ---- basics -----------------------------------------------------------------------------------------------------

export function fail(message, tag = 'kit') {
  console.error(`[${tag}] ${message}`)
  process.exit(1)
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

export function getArg(argv, name, fallback) {
  const i = argv.indexOf(name)
  return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}

export function localeLangs() {
  return readdirSync(LOCALES_DIR).filter((d) => !d.startsWith('.'))
}

// Locale messages as they end up in the build: defaults with the branding/ name and description on top.
export function readLocales() {
  const branding = loadBranding(ROOT)
  const locales = {}
  for (const lang of localeLangs()) {
    const json = readFileSync(join(LOCALES_DIR, lang, 'messages.json'), 'utf-8')
    locales[lang] = JSON.parse(brandMessagesJson(json, branding, lang))
  }
  return locales
}

// Messengers that have a build:<name> script in package.json.
export function availableMessengers() {
  const scripts = readJson(join(ROOT, 'package.json')).scripts ?? {}
  return Object.keys(scripts).filter((s) => /^build:/.test(s)).map((s) => s.slice('build:'.length))
}

// Opens a file, folder or URL with the OS default app (browser / file manager).
export function openWithOs(target) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', target]]
    : process.platform === 'darwin' ? ['open', [target]]
      : ['xdg-open', [target]]
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true, cwd: ROOT }).on('error', () => {}).unref()
  } catch { /* nothing to open with - the path is printed anyway */ }
}

// ---- dependencies -------------------------------------------------------------------------------------------------

export function nodeVersionOk() {
  return Number(process.versions.node.split('.')[0]) >= MIN_NODE_MAJOR
}

// Packages from package.json that are not present in node_modules.
export function missingDependencies() {
  const pkg = readJson(join(ROOT, 'package.json'))
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  return names.filter((name) => !existsSync(join(ROOT, 'node_modules', name, 'package.json')))
}

// npm is a .cmd on Windows - it has to go through the shell there.
const NPM_SPAWN = { cwd: ROOT, shell: process.platform === 'win32' }

// Async install for the editor server: npm ci, falling back to npm install. Resolves with the output tail.
export function installDependencies(onOutput = () => {}) {
  const run = (args) => new Promise((resolvePromise) => {
    const child = spawn('npm', args, { ...NPM_SPAWN, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (d) => onOutput(String(d)))
    child.stderr.on('data', (d) => onOutput(String(d)))
    child.on('error', (error) => { onOutput(String(error)); resolvePromise(1) })
    child.on('close', (code) => resolvePromise(code ?? 1))
  })
  return (async () => {
    let code = await run(['ci', '--no-audit', '--no-fund'])
    if (code !== 0) {
      onOutput('\nnpm ci failed - trying npm install\n')
      code = await run(['install', '--no-audit', '--no-fund'])
    }
    const missing = missingDependencies()
    if (code !== 0 || missing.length) {
      throw new Error(`could not install dependencies${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`)
    }
  })()
}

// CLI variant: checks Node.js and installs missing packages, printing npm output. Exits on failure.
export function ensureDependencies(tag) {
  if (!nodeVersionOk()) {
    fail(`Node.js ${MIN_NODE_MAJOR}+ is required, found ${process.versions.node}. Install the LTS version from https://nodejs.org`, tag)
  }
  let missing = missingDependencies()
  if (!missing.length) {
    console.log(`[${tag}] dependencies: ok (Node.js ${process.versions.node})`)
    return
  }
  console.log(`[${tag}] installing dependencies - ${missing.length} missing`)
  let result = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { ...NPM_SPAWN, stdio: 'inherit' })
  if (result.status !== 0) {
    console.warn(`[${tag}] npm ci failed - trying npm install`)
    result = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { ...NPM_SPAWN, stdio: 'inherit' })
  }
  missing = missingDependencies()
  if (result.status !== 0 || missing.length) {
    fail(`could not install dependencies${missing.length ? ` (still missing: ${missing.join(', ')})` : ''}. Check the network / npm access and run "npm install" manually.`, tag)
  }
  console.log(`[${tag}] dependencies: installed`)
}

// ---- brand in the repo ---------------------------------------------------------------------------------------------

// Primary colors as built (theme.css + branding/): the first declaration is the light theme, the second the dark one.
export function readPrimaryColors() {
  const theme = brandThemeCss(readFileSync(THEME_PATH, 'utf-8'), loadBranding(ROOT))
  const values = [...theme.matchAll(/--primary-color:\s*([^;]+);/g)].map((m) => m[1].trim())
  return { primary: values[0] ?? '#3b9702', primaryDark: values[1] ?? values[0] ?? '#3b9702' }
}

// Current brand, read from the same files the extension is built from.
export function readBrand({ messenger = CLIENT_MESSENGER, lang }) {
  const locales = readLocales()
  const config = readFileSync(CONFIG_PATH, 'utf-8')
  const { version } = readJson(join(ROOT, 'package.json'))
  const connectorSource = config.match(/CONNECTOR_SOURCE\s*=\s*'([^']+)'/)?.[1]
  if (!connectorSource) throw new Error('CONNECTOR_SOURCE not found in src/shared/config.ts')

  return {
    name: locales[lang]?.extName?.message ?? 'Connector',
    nameEn: (locales.en ?? locales[lang])?.extName?.message ?? 'Connector',
    messenger: MESSENGER_NAMES[messenger] ?? messenger,
    version,
    lang,
    connectorSource,
  }
}

// Width/height of a PNG buffer, or null if it is not a PNG.
export function pngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

// Icons as built (branding/icons, else public/icons) as data: URLs (so pages are self-contained),
// plus size problems if any.
export function readIcons() {
  const branding = loadBranding(ROOT)
  const icons = {}
  const issues = []
  for (const size of ICON_SIZES) {
    const file = `icon${size}.png`
    let data
    try {
      data = readFileSync(branding?.icons[size] ?? join(ICONS_DIR, file))
    } catch {
      issues.push(`${file}: missing`)
      continue
    }
    const dims = pngSize(data)
    if (!dims) issues.push(`${file}: not a PNG file`)
    else if (dims.width !== size || dims.height !== size) issues.push(`${file}: ${dims.width}x${dims.height}, expected ${size}x${size}`)
    icons[size] = `data:image/png;base64,${data.toString('base64')}`
  }
  return { icons, issues }
}

// ---- brand data from the brand editor -> branding/ -------------------------------------------------------------------
//
// The editor posts { schema: 1, name: {en, ru}, description: {en, ru}, colors: {primary, primaryDark},
// icons: {16|32|48|128: "data:image/png;base64,..."} }; saveBranding() validates nothing itself - call
// validateBrand() first - and writes branding/brand.json (texts + colors) and branding/icons/*.png.

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function iconBufferFromDataUrl(dataUrl) {
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)
  return m ? Buffer.from(m[1], 'base64') : null
}

// Returns a list of human-readable problems; empty list = valid.
export function validateBrand(brand) {
  const errors = []
  if (!brand || typeof brand !== 'object') return ['brand.json must be a JSON object']
  if (brand.schema !== 1) errors.push('schema must be 1')
  for (const lang of localeLangs()) {
    const name = brand.name?.[lang]
    const description = brand.description?.[lang]
    if (typeof name !== 'string' || !name.trim()) errors.push(`name.${lang} is empty`)
    else if (name.length > NAME_MAX) errors.push(`name.${lang} is longer than ${NAME_MAX} characters`)
    if (typeof description !== 'string' || !description.trim()) errors.push(`description.${lang} is empty`)
    else if (description.length > DESCRIPTION_MAX) errors.push(`description.${lang} is longer than ${DESCRIPTION_MAX} characters`)
  }
  for (const key of ['primary', 'primaryDark']) {
    if (!HEX_RE.test(brand.colors?.[key] ?? '')) errors.push(`colors.${key} must be a #rrggbb color`)
  }
  for (const size of ICON_SIZES) {
    const buffer = iconBufferFromDataUrl(brand.icons?.[size])
    const dims = buffer && pngSize(buffer)
    if (!dims) errors.push(`icons.${size} must be a PNG data URL`)
    else if (dims.width !== size || dims.height !== size) errors.push(`icons.${size} is ${dims.width}x${dims.height}, expected ${size}x${size}`)
  }
  return errors
}

// Writes a validated brand into branding/ (the default brand files are not touched).
// Returns the list of written files (repo-relative).
export function saveBranding(brand) {
  const iconsDir = join(BRANDING_PATH, 'icons')
  mkdirSync(iconsDir, { recursive: true })
  const langs = localeLangs()
  const data = {
    name: Object.fromEntries(langs.map((l) => [l, brand.name[l].trim()])),
    description: Object.fromEntries(langs.map((l) => [l, brand.description[l].trim()])),
    colors: { primary: brand.colors.primary.toLowerCase(), primaryDark: brand.colors.primaryDark.toLowerCase() },
  }
  const written = []
  const write = (path, content) => {
    writeFileSync(path, content)
    written.push(relative(ROOT, path).replace(/\\/g, '/'))
  }
  write(join(BRANDING_PATH, 'brand.json'), JSON.stringify(data, null, 2) + '\n')
  for (const size of ICON_SIZES) write(join(iconsDir, `icon${size}.png`), iconBufferFromDataUrl(brand.icons[size]))
  return written
}

// ---- builds ---------------------------------------------------------------------------------------------------------

// Runs `vite build` in a child process (async, so the editor server keeps answering meanwhile).
export function runViteBuild(outDir, messenger) {
  return new Promise((resolvePromise, reject) => {
    const viteBin = join(ROOT, 'node_modules/vite/bin/vite.js')
    const child = spawn(process.execPath, [viteBin, 'build', '--outDir', outDir, '--emptyOutDir'], {
      cwd: ROOT,
      env: { ...process.env, MESSENGER: messenger },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (d) => { output += d })
    child.stderr.on('data', (d) => { output += d })
    child.on('error', reject)
    child.on('close', (code) => (code === 0
      ? resolvePromise(output)
      : reject(new Error(`vite build exited with code ${code}\n${output.slice(-3000)}`))))
  })
}

export function isDevModeOn() {
  const match = readFileSync(CONFIG_PATH, 'utf-8').match(DEV_MODE_RE)
  if (!match) throw new Error(`DEV_MODE declaration not found in ${CONFIG_PATH}`)
  return match[1] === 'true'
}

// Runs fn with DEV_MODE = true in src/shared/config.ts and always restores the file (also on Ctrl+C).
export async function withDevMode(fn) {
  const original = readFileSync(CONFIG_PATH, 'utf-8')
  const restore = () => writeFileSync(CONFIG_PATH, original)
  const onSignal = () => { restore(); process.exit(130) }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)
  try {
    writeFileSync(CONFIG_PATH, original.replace(DEV_MODE_RE, 'const DEV_MODE = true;'))
    return await fn()
  } finally {
    restore()
    process.removeListener('SIGINT', onSignal)
    process.removeListener('SIGTERM', onSignal)
  }
}

// ---- pages (preview / editor / test page - one React bundle, scripts/preview) ---------------------------------------

// Bundles scripts/preview/main.tsx (real popup/popout components + mock browser chrome, test page, brand editor)
// into one classic IIFE script + CSS, so it can be inlined into single HTML files that open from disk (file://).
export async function bundlePages() {
  const { build } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  const tmpDir = mkdtempSync(join(tmpdir(), 'connector-pages-'))
  try {
    await build({
      configFile: false,
      root: ROOT,
      publicDir: false,
      logLevel: 'warn',
      mode: 'production',
      plugins: [react()],
      resolve: { alias: { 'webextension-polyfill': join(ROOT, 'scripts/preview/browser-mock.ts') } },
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        outDir: tmpDir,
        emptyOutDir: true,
        cssCodeSplit: false,
        lib: { entry: join(ROOT, 'scripts/preview/main.tsx'), formats: ['iife'], name: 'ConnectorPages', fileName: () => 'pages.js' },
      },
    })
    const js = readFileSync(join(tmpDir, 'pages.js'), 'utf-8')
    const css = readdirSync(tmpDir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(tmpDir, f), 'utf-8')).join('\n')
    return { js, css }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

// JSON that is safe to put inside an inline <script>: "<" is escaped so no "</script>" can appear.
export function toInlineJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

// Config read by scripts/preview/main.tsx as window.__PREVIEW__ (see PageConfig there).
// page: 'preview' | 'editor' | 'test'; extra: testPageHref / previewHref / editor.
export function pageConfig(brand, page, extra = {}) {
  const { icons, issues } = readIcons()
  return {
    page,
    lang: brand.lang,
    messenger: brand.messenger,
    version: brand.version,
    connectorSource: brand.connectorSource,
    icons,
    iconIssues: issues,
    colors: readPrimaryColors(),
    locales: readLocales(),
    ...extra,
  }
}

export function renderPage(config, { js, css }) {
  // A literal "</script" inside the bundle would end the inline <script> early.
  const safeJs = js.split('</script').join('<' + String.fromCharCode(92) + '/script') // 92 = backslash
  return `<!DOCTYPE html>
<html lang="${config.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connector</title>
  <link rel="icon" href="${config.icons?.[32] ?? ''}">
  <style>${css}</style>
</head>
<body>
  <div id="preview-root"></div>
  <script>window.__PREVIEW__ = ${toInlineJson(config)}</script>
  <script>${safeJs}</script>
</body>
</html>
`
}

// ---- zip (no dependencies: deflate from node:zlib + a minimal ZIP writer) -------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function listFiles(dir, base = dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? listFiles(full, base) : [relative(base, full).replace(/\\/g, '/')]
  }).sort()
}

// Zips the CONTENTS of dir (manifest.json at the archive root - what browser stores expect).
export function zipDirectory(dir, zipPath) {
  const DOS_DATE_1980 = 0x21 // 1980-01-01: fixed timestamp keeps the archive reproducible
  const chunks = []
  const central = []
  let offset = 0
  let count = 0
  for (const rel of listFiles(dir)) {
    const data = readFileSync(join(dir, rel))
    const deflated = deflateRawSync(data)
    const stored = deflated.length >= data.length
    const body = stored ? data : deflated
    const name = Buffer.from(rel, 'utf-8')
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(stored ? 0 : 8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(DOS_DATE_1980, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, name, body)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(stored ? 0 : 8, 10)
    entry.writeUInt16LE(0, 12)
    entry.writeUInt16LE(DOS_DATE_1980, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(body.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, name)
    offset += local.length + name.length + body.length
    count += 1
  }
  const centralSize = central.reduce((sum, b) => sum + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(count, 8)
  end.writeUInt16LE(count, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  writeFileSync(zipPath, Buffer.concat([...chunks, ...central, end]))
}

// ---- release ----------------------------------------------------------------------------------------------------------

export function slugify(text) {
  const slug = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'connector'
}

const README = {
  en: (r) => `${r.name} ${r.version} - WhatsApp

Two versions of the extension are available: for Chrome and for Firefox.

chrome/                 The extension for Chrome (also works in Edge, Yandex Browser, Opera).
                          chrome://extensions -> Developer mode -> Load unpacked -> select this folder.
firefox/                The extension for Firefox.
                          about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> firefox/manifest.json
${r.zipChrome}
                        ZIP of chrome/ - upload it to the Chrome Web Store.
${r.zipFirefox}
                        ZIP of firefox/ - upload it to Firefox Add-ons (addons.mozilla.org).
preview.html            Presentation: how the extension looks (menu, authorization window, extension card).
                          Opens in any browser, nothing to install.
test/                   For testing only - DO NOT PUBLISH OR SEND TO USERS.
  chrome/                 Test build for Chrome: also works on local pages (file://, localhost).
  firefox/                Test build for Firefox.
  test-page.html          Test page: install the test build (Chrome: also enable "Allow access to file URLs"
                          on its Details page), open this page and run the authorization end-to-end.
                          Remove the test build afterwards and install the normal one.
`,
  ru: (r) => `${r.name} ${r.version} - WhatsApp

Доступны 2 версии расширения: для Chrome и для Firefox.

chrome/                 Расширение для Chrome (работает также в Edge, Яндекс Браузере, Opera).
                          chrome://extensions -> Режим разработчика -> Загрузить распакованное -> эта папка.
firefox/                Расширение для Firefox.
                          about:debugging#/runtime/this-firefox -> Загрузить временное дополнение -> firefox/manifest.json
${r.zipChrome}
                        ZIP папки chrome/ - для загрузки в Chrome Web Store.
${r.zipFirefox}
                        ZIP папки firefox/ - для загрузки в Firefox Add-ons (addons.mozilla.org).
preview.html            Презентация: как выглядит расширение (меню, окно авторизации, карточка расширения).
                          Открывается в любом браузере, ничего устанавливать не нужно.
test/                   Только для проверки - НЕ ПУБЛИКУЙТЕ И НЕ ОТПРАВЛЯЙТЕ ПОЛЬЗОВАТЕЛЯМ.
  chrome/                 Тестовая сборка для Chrome: работает и на локальных страницах (file://, localhost).
  firefox/                Тестовая сборка для Firefox.
  test-page.html          Тестовая страница: установите тестовую сборку (в Chrome также включите
                          «Разрешить доступ к URL файлов» в «Подробнее»), откройте страницу и пройдите авторизацию.
                          После проверки удалите тестовую сборку и установите обычную.
`,
}

// The vite build emits ONE manifest for both browsers (crossBrowserManifest in vite.config.ts adds
// background.scripts for Firefox next to service_worker). Chromium browsers older than Chrome 121 - and some
// Chromium-based ones, e.g. Yandex Browser - report "'background.scripts' requires manifest version of 2 or lower",
// so the release ships two folders: firefox/ as built, and chrome/ with the Firefox-only keys removed.
function splitByBrowser(chromeDir, firefoxDir) {
  rmSync(firefoxDir, { recursive: true, force: true })
  cpSync(chromeDir, firefoxDir, { recursive: true })
  const manifestPath = join(chromeDir, 'manifest.json')
  const manifest = readJson(manifestPath)
  if (manifest.background) delete manifest.background.scripts
  delete manifest.browser_specific_settings
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

export const RELEASE_STEPS = ['build', 'testBuild', 'pages', 'zip']

// Builds release/<slug>-<version>/ from the brand currently in the repo (defaults + branding/):
//   chrome/  firefox/  <name>-chrome.zip  <name>-firefox.zip  preview.html
//   test/chrome/  test/firefox/  test/test-page.html  README.txt
// onStep(key) is called before each of RELEASE_STEPS. Throws on failure.
export async function createRelease({ lang = 'en', messenger = CLIENT_MESSENGER, bundle, onStep = () => {} }) {
  const brand = readBrand({ messenger, lang })
  const slug = slugify(brand.nameEn)
  const folder = `${slug}-${brand.version}`
  const dir = join(RELEASE_DIR, folder)
  const zipChrome = `${folder}-chrome.zip`
  const zipFirefox = `${folder}-firefox.zip`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, 'test'), { recursive: true })

  onStep('build')
  if (isDevModeOn()) throw new Error('DEV_MODE is true in src/shared/config.ts - set it to false before building a release')
  await runViteBuild(join(dir, 'chrome'), messenger)
  splitByBrowser(join(dir, 'chrome'), join(dir, 'firefox'))

  onStep('testBuild')
  await withDevMode(() => runViteBuild(join(dir, 'test', 'chrome'), messenger))
  splitByBrowser(join(dir, 'test', 'chrome'), join(dir, 'test', 'firefox'))

  onStep('pages')
  const pages = bundle ?? await bundlePages()
  writeFileSync(join(dir, 'preview.html'), renderPage(pageConfig(brand, 'preview', { testPageHref: 'test/test-page.html' }), pages))
  writeFileSync(join(dir, 'test', 'test-page.html'), renderPage(pageConfig(brand, 'test', { previewHref: '../preview.html' }), pages))

  onStep('zip')
  zipDirectory(join(dir, 'chrome'), join(dir, zipChrome))
  zipDirectory(join(dir, 'firefox'), join(dir, zipFirefox))
  writeFileSync(join(dir, 'README.txt'), (README[lang] ?? README.en)({ name: brand.nameEn, version: brand.version, zipChrome, zipFirefox }))

  return { dir, folder, zipChrome, zipFirefox, name: brand.name, version: brand.version, messenger: brand.messenger }
}
