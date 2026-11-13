// Release folder with the brand currently in the repo (WhatsApp):
//
//   npm run release                    release/<name>-<version>/: chrome/, firefox/, their ZIPs, preview.html, test/,
//                                      README.txt
//   npm run release -- --lang ru       language of preview/test pages and README (en / ru)
//   npm run preview                    ONLY release/preview.html - no build, nothing in src/ changes
//   npm run release -- --default-brand build the default GREEN-API brand even if branding/ exists (it stays as is)
//
// Checks Node.js and installs missing dependencies first. Maintainers only (never offered to clients):
//   node scripts/release.mjs --messenger max   another messenger
//   npm run release:qr                         brand preset brands/qr-connector (= --brand qr-connector);
//                                              branding/ is ignored, add --preview-only for just preview.html
// The brand is the default one plus branding/ if it exists (White label: `npm run brand-editor` writes branding/
// and its "Build extension" button runs the same release).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { brandingSource, loadBranding } from './lib/branding.mjs'
import {
  CLIENT_MESSENGER, RELEASE_DIR, ROOT, availableMessengers, bundlePages, createRelease, ensureDependencies, fail, getArg,
  localeLangs, openWithOs, pageConfig, readBrand, readIcons, renderPage,
} from './lib/kit.mjs'

const TAG = 'release'
const argv = process.argv.slice(2)
const lang = getArg(argv, '--lang', 'en')
const messenger = getArg(argv, '--messenger', CLIENT_MESSENGER)
const previewOnly = argv.includes('--preview-only')
const open = argv.includes('--open')
// Must be set before anything reads branding/ (also inherited by the vite child processes).
const preset = getArg(argv, '--brand', null)
if (preset && argv.includes('--default-brand')) fail('use either --brand or --default-brand', TAG)
if (preset) process.env.CONNECTOR_BRAND = preset
else delete process.env.CONNECTOR_BRAND
if (argv.includes('--default-brand')) process.env.CONNECTOR_BRANDING = 'off'

if (!localeLangs().includes(lang)) fail(`unsupported --lang "${lang}", use one of: ${localeLangs().join(', ')}`, TAG)
if (!availableMessengers().includes(messenger)) fail(`unknown --messenger "${messenger}"`, TAG)

ensureDependencies(TAG)
let branding
try {
  branding = loadBranding(ROOT)
} catch (error) {
  fail(error.message, TAG)
}
console.log(branding
  ? `[${TAG}] brand: ${branding.name.en ?? Object.values(branding.name)[0]} (from ${brandingSource(ROOT)}/)`
  : `[${TAG}] brand: default GREEN-API${existsSync(join(ROOT, 'branding', 'brand.json')) ? ' (branding/ ignored: --default-brand)' : ''}`)
for (const issue of readIcons().issues) console.warn(`[${TAG}] warning: icon ${issue}`)

try {
  if (previewOnly) {
    mkdirSync(RELEASE_DIR, { recursive: true })
    const file = join(RELEASE_DIR, 'preview.html')
    writeFileSync(file, renderPage(pageConfig(readBrand({ messenger, lang }), 'preview'), await bundlePages()))
    console.log(`[${TAG}] preview: ${file}`)
    if (open) openWithOs(file)
  } else {
    const release = await createRelease({ lang, messenger, onStep: (step) => console.log(`[${TAG}] ${step}...`) })
    console.log(`[${TAG}] done - ${release.name} ${release.version}, ${release.messenger}
[${TAG}] 2 versions are available: for Chrome and for Firefox
  ${release.dir}
    chrome/      ${release.zipChrome}    Chrome (also Edge, Yandex Browser, Opera)
    firefox/     ${release.zipFirefox}   Firefox
    preview.html                          presentation
    test/                                 test builds + test page (do not publish)
    README.txt`)
    if (open) openWithOs(release.dir)
  }
} catch (error) {
  fail(error.message, TAG)
}
