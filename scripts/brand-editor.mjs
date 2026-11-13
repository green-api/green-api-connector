// White label brand editor: a local page with the live extension preview and the brand form (logo, name,
// description, colors). The main button walks the client through three steps:
//   1. "Install dependencies" - only if node_modules is incomplete (a light page is served until then)
//   2. "Save"                 - validates the brand and writes it to branding/ (brand.json + icons/);
//                               the default GREEN-API files are never changed - builds apply branding/ on top
//   3. "Build extension"      - creates release/<name>-<version>/ (chrome/, firefox/, zips, preview.html, test/)
// After the build the page stays open but read-only: the release path (click to copy) and "Open folder".
// The process prints `[brand-editor] release: <path>` right after the build and EXITS when the user closes the
// editor tab - code 0 if the release was built, code 2 if the tab was closed without building. The exit is the
// signal for the AI agent waiting on it.
//
//   npm run brand-editor                 opens the editor in the default browser
//   npm run brand-editor -- --lang ru    page language (en / ru)
//   npm run brand-editor -- --no-open    just print the URL
//
// Listens on 127.0.0.1 only; the page and every API call carry a random one-time token.

import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import {
  BRANDING_PATH, CLIENT_MESSENGER, DESCRIPTION_MAX, MIN_NODE_MAJOR, NAME_MAX, RELEASE_STEPS, bundlePages, saveBranding,
  createRelease, fail, getArg, installDependencies, localeLangs, missingDependencies, nodeVersionOk, openWithOs,
  pageConfig, readBrand, renderPage, validateBrand,
} from './lib/kit.mjs'

const TAG = 'brand-editor'
const MAX_BODY = 8 * 1024 * 1024
// The page sends a beacon when it is closed; a reload sends one too, so wait a bit for the page to come back.
const CLOSE_GRACE_MS = 3000
// After the build the page pings /api/status every few seconds (background tabs: about once a minute).
// No request for this long = the tab is gone (e.g. the browser was killed and the beacon was lost).
const IDLE_EXIT_MS = 3 * 60 * 1000

const argv = process.argv.slice(2)
const lang = getArg(argv, '--lang', 'en')
const openBrowser = !argv.includes('--no-open')

if (!localeLangs().includes(lang)) fail(`unsupported --lang "${lang}", use one of: ${localeLangs().join(', ')}`, TAG)
if (!nodeVersionOk()) {
  fail(`Node.js ${MIN_NODE_MAJOR}+ is required, found ${process.versions.node}. Install the LTS version from https://nodejs.org`, TAG)
}

// The editor always edits the client brand in branding/ - never a maintainer preset from brands/.
delete process.env.CONNECTOR_BRAND
const token = randomBytes(16).toString('hex')

// Everything the page polls via GET /api/status.
const state = {
  deps: { state: 'checking', missing: [], log: '', node: process.versions.node },
  ready: false, // the React page bundle is built - the full editor can be served
  saved: null, // { changed: [...] } after a successful Save
  build: { state: 'idle', step: null, steps: RELEASE_STEPS, dir: null, error: null },
}
let pages = null
let lastSeen = Date.now()
let closeTimer = null

function shutdown(reason) {
  if (state.build.state === 'done') {
    console.log(`[${TAG}] ${reason} - done. release: ${state.build.dir}`)
    process.exit(0)
  }
  console.log(`[${TAG}] ${reason} without building the extension (brand saved: ${state.saved ? 'yes' : 'no'})`)
  process.exit(2)
}

async function preparePages() {
  pages = await bundlePages()
  state.ready = true
}

function startInstall() {
  if (state.deps.state === 'installing' || state.deps.state === 'ok') return
  state.deps = { ...state.deps, state: 'installing', log: '' }
  console.log(`[${TAG}] installing dependencies...`)
  installDependencies((chunk) => { state.deps.log = (state.deps.log + chunk).slice(-4000) })
    .then(async () => {
      state.deps = { ...state.deps, state: 'ok', missing: [] }
      console.log(`[${TAG}] dependencies: installed`)
      await preparePages()
    })
    .catch((error) => {
      state.deps = { ...state.deps, state: 'error', missing: missingDependencies(), log: `${state.deps.log}\n${error.message}`.slice(-4000) }
      console.error(`[${TAG}] ${error.message}`)
    })
}

function startBuild() {
  state.build = { ...state.build, state: 'running', step: null, dir: null, error: null }
  console.log(`[${TAG}] building release...`)
  createRelease({ lang, messenger: CLIENT_MESSENGER, bundle: pages, onStep: (step) => { state.build.step = step } })
    .then((release) => {
      state.build = { ...state.build, state: 'done', step: null, dir: release.dir }
      console.log(`[${TAG}] release: ${release.dir}`)
      console.log(`[${TAG}] 2 versions are available: for Chrome (chrome/, ${release.zipChrome}) and for Firefox (firefox/, ${release.zipFirefox})`)
      console.log(`[${TAG}] the editor stays open (read-only) until the user closes the tab`)
      setInterval(() => { if (Date.now() - lastSeen > IDLE_EXIT_MS) shutdown('editor page is gone') }, 10_000).unref()
    })
    .catch((error) => {
      state.build = { ...state.build, state: 'error', error: error.message.slice(0, 3000) }
      console.error(`[${TAG}] build failed: ${error.message}`)
    })
}

// ---- light page served until dependencies are installed (no React bundle available yet) ----

const SETUP_TEXT = {
  en: {
    title: 'Brand editor',
    intro: 'Before the editor can start, the project dependencies (npm packages) have to be installed. It takes a minute or two and needs internet access.',
    missing: 'Missing packages',
    install: 'Install dependencies',
    installing: 'Installing…',
    failed: 'Installation failed. Check the internet connection / npm access and try again.',
    ready: 'Done! Opening the editor…',
  },
  ru: {
    title: 'Редактор бренда',
    intro: 'Перед запуском редактора нужно установить зависимости проекта (npm-пакеты). Это займёт минуту-две и требует доступа в интернет.',
    missing: 'Не хватает пакетов',
    install: 'Установить зависимости',
    installing: 'Устанавливаем…',
    failed: 'Установка не удалась. Проверьте интернет / доступ к npm и попробуйте ещё раз.',
    ready: 'Готово! Открываем редактор…',
  },
}

function setupPage() {
  const t = SETUP_TEXT[lang] ?? SETUP_TEXT.en
  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t.title}</title>
<style>
  :root { --primary: #3b9702; --bg: #eef1f5; --card: #fff; --text: #1f2937; --muted: #6b7280; --border: #dfe3ea; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0d0f12; --card: #17191d; --text: #e5e7eb; --muted: #9ca3af; --border: #2a2d33; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--text);
    font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .card { width: min(480px, calc(100vw - 32px)); box-sizing: border-box; padding: 28px; background: var(--card);
    border: 1px solid var(--border); border-radius: 14px; }
  h1 { margin: 0 0 8px; font-size: 22px; }
  p { margin: 0 0 16px; color: var(--muted); font-size: 14px; }
  .missing { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
  button { width: 100%; height: 44px; border: none; border-radius: 10px; background: var(--primary); color: #fff;
    font: inherit; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  pre { display: none; max-height: 200px; overflow: auto; margin: 16px 0 0; padding: 10px; border-radius: 8px;
    background: #0f172a; color: #cbd5e1; font-size: 11px; white-space: pre-wrap; }
  .msg { margin-top: 12px; font-size: 13px; font-weight: 600; }
  .err { color: #dc2626; } .ok { color: #16a34a; }
</style></head>
<body><div class="card">
  <h1>${t.title}</h1>
  <p>${t.intro}</p>
  <div class="missing">${t.missing}: <span id="missing"></span> · Node.js ${process.versions.node}</div>
  <button id="install">${t.install}</button>
  <div id="msg" class="msg"></div>
  <pre id="log"></pre>
</div>
<script>
  const TOKEN = ${JSON.stringify(token)}, T = ${JSON.stringify(t)};
  const $ = (id) => document.getElementById(id);
  const api = (path, method = 'GET') => fetch(path, { method, headers: { 'X-Brand-Token': TOKEN } }).then((r) => r.json());
  function render(s) {
    $('missing').textContent = s.deps.missing.length ? s.deps.missing.length + ' (' + s.deps.missing.slice(0, 4).join(', ') + (s.deps.missing.length > 4 ? ', …' : '') + ')' : '0';
    const installing = s.deps.state === 'installing' || (s.deps.state === 'ok' && !s.ready);
    $('install').disabled = installing || s.ready;
    $('install').textContent = installing ? T.installing : T.install;
    $('log').style.display = s.deps.log ? 'block' : 'none';
    $('log').textContent = s.deps.log;
    $('log').scrollTop = $('log').scrollHeight;
    $('msg').className = 'msg ' + (s.deps.state === 'error' ? 'err' : 'ok');
    $('msg').textContent = s.deps.state === 'error' ? T.failed : s.ready ? T.ready : '';
    if (s.ready) setTimeout(() => location.reload(), 600);
  }
  async function poll() { try { const s = await api('/api/status'); render(s); if (s.ready) return; } catch {} setTimeout(poll, 1000); }
  $('install').onclick = async () => { await api('/api/install', 'POST'); poll(); };
  poll();
</script></body></html>`
}

function editorPage() {
  const brand = readBrand({ messenger: CLIENT_MESSENGER, lang })
  return renderPage(pageConfig(brand, 'editor', {
    editor: {
      token,
      api: { status: '/api/status', save: '/api/save', build: '/api/build', openFolder: '/api/open-folder', closed: '/api/closed' },
      nameMax: NAME_MAX,
      descriptionMax: DESCRIPTION_MAX,
    },
  }), pages)
}

// ---- HTTP ----

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function readBody(req, res) {
  return new Promise((resolvePromise) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        send(res, 413, { ok: false, errors: ['too large'] })
        req.destroy()
        resolvePromise(null)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (res.writableEnded) return resolvePromise(null)
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}'))
      } catch {
        send(res, 400, { ok: false, errors: ['invalid JSON'] })
        resolvePromise(null)
      }
    })
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  lastSeen = Date.now()
  if (closeTimer && url.pathname !== '/api/closed') { clearTimeout(closeTimer); closeTimer = null }

  if (req.method === 'GET' && url.pathname === '/') {
    if (url.searchParams.get('token') !== token) return send(res, 403, 'Forbidden', 'text/plain')
    return send(res, 200, state.ready ? editorPage() : setupPage(), 'text/html; charset=utf-8')
  }

  if (!url.pathname.startsWith('/api/')) return send(res, 404, 'Not found', 'text/plain')
  const { port } = server.address()
  const origin = req.headers.origin
  // sendBeacon (page closed) can't set headers - it carries the token in the query
  const reqToken = req.headers['x-brand-token'] ?? url.searchParams.get('token')
  if (reqToken !== token || (origin && origin !== `http://127.0.0.1:${port}`)) {
    return send(res, 403, { ok: false, errors: ['forbidden'] })
  }

  if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, state)

  if (req.method === 'POST' && url.pathname === '/api/install') {
    startInstall()
    return send(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/save') {
    if (state.build.state === 'running') return send(res, 409, { ok: false, errors: ['build is running'] })
    const data = await readBody(req, res)
    if (!data) return undefined
    const errors = validateBrand(data)
    if (errors.length) return send(res, 400, { ok: false, errors })
    try {
      const changed = saveBranding(data)
      state.saved = { changed }
      if (state.build.state !== 'running') state.build = { ...state.build, state: 'idle', dir: null, error: null }
      console.log(`[${TAG}] saved ${BRANDING_PATH}: ${changed.join(', ')}`)
      return send(res, 200, { ok: true, changed })
    } catch (error) {
      return send(res, 500, { ok: false, errors: [error.message] })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/build') {
    if (!state.saved) return send(res, 409, { ok: false, errors: ['save the brand first'] })
    if (state.build.state === 'running') return send(res, 409, { ok: false, errors: ['build is already running'] })
    startBuild()
    return send(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/open-folder') {
    if (state.build.state !== 'done' || !state.build.dir) return send(res, 409, { ok: false, errors: ['nothing built yet'] })
    openWithOs(state.build.dir)
    return send(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/closed') {
    if (state.build.state !== 'running' && !closeTimer) {
      closeTimer = setTimeout(() => shutdown('editor tab closed'), CLOSE_GRACE_MS)
    }
    return send(res, 200, { ok: true })
  }

  return send(res, 404, { ok: false, errors: ['not found'] })
})

// ---- start ----

state.deps.missing = missingDependencies()
if (state.deps.missing.length) {
  state.deps.state = 'missing'
  console.log(`[${TAG}] ${state.deps.missing.length} dependencies missing - the page offers "Install dependencies"`)
} else {
  state.deps.state = 'ok'
  await preparePages()
}

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address()
  const pageUrl = `http://127.0.0.1:${port}/?token=${token}`
  console.log(`[${TAG}] brand editor: ${pageUrl}`)
  console.log(`[${TAG}] waiting for the user: (install dependencies) -> Save -> Build extension -> close the tab. Ctrl+C to cancel.`)
  if (openBrowser) openWithOs(pageUrl)
})
