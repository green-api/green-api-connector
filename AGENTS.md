# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, etc.) working in this repository.
Human-facing docs live in [README.md](README.md) / [README.ru.md](README.ru.md); this file covers how to *change* the code safely.

Reply to the user in the language they write in. Code, comments, commit messages and identifiers stay in English.

## What this project is

**GREEN-API Connector** is a cross-browser (Chrome + Firefox, single MV3 build) extension. A trusted web page
(`*.green-api.com`, `*.greenapi.com`) asks it via `window.postMessage` to open a messenger's web client
(WhatsApp Web, MAX) in a popup window. After the user logs in, the extension reads the session data from the
page and POSTs it to the endpoint URL the page supplied (normally `https://api.green-api.com/waInstance{id}/setAuthCreds/{token}`).

The messenger is chosen **at build time**: one build = one messenger.

Stack: TypeScript (strict), React 18 (popup/popout UI), Vite 5 + `@crxjs/vite-plugin`, `webextension-polyfill`.

## Start here: offer the client scenarios first

Most people who open this repo with an AI agent are **GREEN-API clients**, not maintainers. They usually want one
of two scenarios, and usually work in a **fork** of `https://github.com/green-api/green-api-connector`.

At the start of a session, if the user has not asked for something specific (or asks something like "what can I do
here", "help me with this repo", "how do I install it"), offer **exactly these two** scenarios (in the user's
language) and let them pick:

> **1. Build & install** - build the WhatsApp extension as is (GREEN-API brand) and install it in your browser
>    (Chrome / Edge / Firefox).
>
> **2. White label** - build the WhatsApp extension under **your** brand: I'll open a visual editor where you upload
>    your logo, enter the name and description, pick colors and see the extension live; then you press Save and
>    Build extension and get a ready release folder. Best done in your fork, so you can keep pulling our updates.

Rules for this menu:
- **Only these two options.** Don't add other items - no "change the code", "develop / integrate", "publish to the
  store" or anything derived from the maintainer sections below. Those sections are reference for when a user
  explicitly asks for a code change; never present code work as an option to a client.
- **Publication in the Chrome Web Store (Scenario 3) is offered only AFTER a successful build** (end of Scenario 1
  or 2). Don't mention it in the start menu.
- Describing the repository is fine (one or two sentences on what the extension does), but don't summarise the
  tooling internals, git state or unreleased work unless asked - go to the menu.

If the request clearly matches a scenario ("build it", "install it" → 1; "my logo / my company name / my colors /
white label / rebrand" → 2), go straight into it without asking. If the user asks to publish to the Chrome Web Store
right away, go to Scenario 3 - its step 1 makes sure there is a release first. Run commands and edit files
yourself; ask the user only for what you cannot know.

Hint: `git remote -v` - if `origin` is not `green-api/green-api-connector`, the user is most likely in a client fork.

### Saved brand in `branding/` - check it first

Before building anything (in either scenario, and when offering the scenarios), check whether
`branding/brand.json` exists. If it does, the client already saved their brand earlier (see White label). Read
`name` from it and ask (in the user's language) - don't silently build one or the other:

> I found a saved extension brand **<name>** (folder `branding/`). What shall we do?
> 1. **Build the saved extension** - `npm run release -- --lang ru`
> 2. **Change it in the editor first** - White label, step 2 (the editor opens with the saved brand)
> 3. **Build the standard GREEN-API extension** - `npm run release -- --lang ru --default-brand`
>    (`branding/` is ignored for this build and stays as is)

To show the saved look before deciding, run `npm run preview -- --lang ru` and give the user
`release/preview.html`. `npm run release` prints which brand it builds (`[release] brand: ...`) - check it matches
the user's choice. Never delete or overwrite `branding/` unless the user asks.

### Messenger: WhatsApp only

All client scenarios use the extension for **WhatsApp** only (`npm run release`, `npm run brand-editor`,
`npm run preview` are all WhatsApp). **Don't ask the client which messenger** and don't offer MAX or other
messengers - the MAX package (`src/packages/max`, `npm run build:max`) exists in the repo for maintainers only.
If a client explicitly asks for MAX, say it isn't available in the client flow and suggest contacting GREEN-API
support.

The same goes for the **brand presets in `brands/`** (e.g. `brands/qr-connector`, `npm run release:qr`): they are
GREEN-API's own extra builds for maintainers. Never offer them to a client, never show them as an example of a
white label, never copy them into `branding/`. A client's brand always comes from the editor / their own data.

### What the client gets: the release folder

Scenarios 1 and 2 end with a **release folder** (Scenario 3 publishes it) (`release/` is gitignored):

```
release/<name>-<version>/          e.g. release/acme-connector-1.3.0/
  chrome/                          the extension for Chrome (also works in Edge, Yandex Browser, Opera)
  firefox/                         the extension for Firefox
  <name>-<version>-chrome.zip      ZIP of chrome/ (manifest.json at the root) for the Chrome Web Store
  <name>-<version>-firefox.zip     ZIP of firefox/ for Firefox Add-ons
  preview.html                     presentation: how the extension looks (toolbar menu, authorization window with
                                   all its states, extension card) - real components, opens in any browser
  test/chrome/                     TEST build for Chrome (DEV_MODE: trusts file:// and localhost) - never publish
  test/firefox/                    the same TEST build for Firefox
  test/test-page.html              test page (example of the client's web app) for the test build
  README.txt                       what is where and how to install (in the chosen language)
```

**After every build, tell the user explicitly that 2 versions are available - for Chrome (`chrome/`) and for
Firefox (`firefox/`)** - and which ZIP is for which store. **Only now** (after a successful build) offer the
[Chrome Web Store publication](#scenario-3---publish-to-the-chrome-web-store) as the next step.

Why two builds: the vite build emits one manifest for both browsers (`background.service_worker` + Firefox's
`background.scripts`). Chromium-based browsers older than Chrome 121 and some others (e.g. Yandex Browser) refuse
it with "'background.scripts' requires manifest version of 2 or lower", so the release removes the Firefox-only keys
(`background.scripts`, `browser_specific_settings`) from `chrome/`. Always give Chrome (and other Chromium browser)
users `chrome/` and Firefox users `firefox/` - never the other way round, and not `dist/`.

All pages are single self-contained HTML files with the client's name, colors and icons, an EN / RU switch and
links between them. The script checks Node.js and installs missing dependencies itself.

### Scenario 1 - Build & install

1. **Prerequisites.** Check `node -v` (Node.js 18+, LTS 20/22 recommended). If Node is missing, tell the user to
   install it from https://nodejs.org and stop. Dependencies are installed by the script.
2. **Build the release** (if `branding/brand.json` exists, first ask as in
   [Saved brand](#saved-brand-in-branding---check-it-first)):
   ```bash
   npm run release -- --lang ru      # --lang en for English speakers; add --open to open the folder
   ```
   It checks/installs dependencies, verifies `DEV_MODE` is `false`, builds `chrome/` and `firefox/`, the test builds, the pages
   and the ZIP, and prints the folder path. `src/shared/config.ts` is left unchanged (check `git diff`).
3. **Hand over** the absolute path of the release folder and explain (in their language):
   - **2 versions are available - for Chrome and for Firefox.**
   - **Install in Chrome** (also Edge, Yandex Browser, Opera): `chrome://extensions` → enable *Developer mode* →
     *Load unpacked* → select `chrome/`.
   - **Install in Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* →
     `firefox/manifest.json` (temporary add-ons disappear on restart; a permanent install needs signing on
     addons.mozilla.org - see White label, Firefox ID).
   - **Stores:** `*-chrome.zip` for the Chrome Web Store (see Scenario 3), `*-firefox.zip` for Firefox Add-ons.
   - **Look:** `preview.html`.
   - **Test the authorization end-to-end:** see [Testing with the test page](#testing-with-the-test-page).
4. **Smoke check** with the user: the toolbar icon appears; clicking it shows the name, description and the
   "Authorize Instance" button that opens the authorization form.

Don't commit `release/`, `dist/` or ZIPs.

### Scenario 2 - White label

Goal: the same extension under the client's brand (logo, name, description, colors), kept in **one separate
folder** so the fork can merge updates from upstream without conflicts.

**Where the brand lives.** The default brand (GREEN-API) is the example in the repo - `public/_locales`,
`public/icons`, `src/shared/theme.css`, the `<title>` of `index.html` / `popout.html` - and is **never modified for
a client**. The client's brand lives only in `branding/`:

```
branding/brand.json        { "name": {"en","ru"}, "description": {"en","ru"}, "colors": {"primary","primaryDark"} }
branding/icons/icon16.png  icon32.png  icon48.png  icon128.png
```

Every build (`npm run build:*`, `npm run release`, the editor's Build) applies `branding/` on top of the defaults in
the build output (`brandingOverrides` plugin in `vite.config.ts`, format in `scripts/lib/branding.mjs`); the
preview pages show the same. No `branding/brand.json` → the plain GREEN-API extension is built. `branding/` is meant
to be committed in the client's fork.

The client sets their brand in the **brand editor** - a local page with the live extension preview and a form next
to it. Don't ask for brand data in chat when the editor can run; don't edit brand files by hand.

**0. Fork hygiene (if the user is in a fork).** Make sure upstream is configured and the fork is up to date, so
the white label is a small diff on top of the latest code:
```bash
git remote add upstream https://github.com/green-api/green-api-connector.git   # once; skip if it exists
git fetch upstream
git merge upstream/master
```

**1. Optionally ask in chat:** will they publish to Firefox Add-ons (step 4), does their own web app on their own
domain call the extension (step 4). Everything else happens in the editor.

**2. Start the editor in the background** (a small local server that waits for the user):
```bash
npm run brand-editor -- --lang ru        # --lang en for English speakers
```
It opens the editor in the default browser and prints the URL (`http://127.0.0.1:<port>/?token=...`) - give it to
the user as well. Then tell them (in their language) what to do. The main button at the bottom of the form walks
them through three steps:

1. **"Install dependencies"** - only shown if `node_modules` is incomplete (e.g. a fresh clone): the editor first
   opens as a small page with this button; it runs `npm ci` (falls back to `npm install`) and then reloads into
   the full editor. If everything is installed, this step is already ticked.
2. **"Save"** - after uploading the logo (icons 16/32/48/128 are generated in the browser), entering the name and
   description (EN and RU, current GREEN-API values shown as examples) and picking colors; the preview on the right
   updates live. Save validates everything (lengths ≤ 45 / 132, valid colors, contrast warning, "still GREEN-API?"
   question) and writes **only** `branding/brand.json` and `branding/icons/icon*.png`. Nothing else changes.
3. **"Build extension"** (the Save button turns into it after saving; editing the form turns it back into Save) -
   builds the release folder and shows the progress. Then the form becomes read-only and shows the release path
   (click to copy) and the **"Open extension folder"** button; the page asks the user to close the tab to get back
   to you.

**3. Wait for the editor process to exit.** Right after a successful build it prints
`[brand-editor] release: <path>`; the process itself keeps running (for the "Open extension folder" button) and
**exits when the user closes the editor tab**: code 0 and `... - done. release: <path>` if the release was built,
code 2 and `... without building the extension (brand saved: yes|no)` if not. That exit is your signal to continue.
While it runs, don't build anything yourself. If your environment can't keep a background process and notify you,
run it in the foreground (it blocks) or ask the user to tell you when the build finished. If the user comes back
while the process still runs, ask them to close the editor tab (or stop the process - if `release:` was printed,
the build is complete). If the user saved but closed the editor without building, run
`npm run release -- --lang ru` yourself. Then: check `git status` (only `branding/` may be new/changed), hand
over the release folder like in Scenario 1, step 3. Pressing Save/Build in the editor **is** the user's approval
of the look - no extra confirmation round is needed. To change the brand later, run the editor again - it starts
from the current `branding/`. To go back to the GREEN-API brand, delete `branding/`.

**4. Rare manual extras** (then rebuild with `npm run release`):
- **Domains** - `TRUSTED_DOMAINS` in `src/shared/config.ts` lists the domains whose pages may control the extension
  (subdomains included). Add the client's domain **only if** their own web app will call the extension; this widens
  who can trigger an import, so confirm with the user. Keep the GREEN-API domains if they still use the GREEN-API
  console.
- **Firefox ID (only if publishing to Firefox Add-ons)** - `browser_specific_settings.gecko.id` in
  `manifest.config.ts` is `@green-api-connector` - the ID reserved for the official GREEN-API build. Add-on IDs on
  addons.mozilla.org are unique and the first upload claims one, so a fork that publishes its own Firefox build
  must use its own ID, e.g. `connector@acme.com`, and never upload under `@green-api-connector`. Not needed for
  local installs or for Chrome/Edge.

**5. Commit (if the user wants)** - `git add branding/` (+ any step 4 changes), one commit, e.g.
`chore(branding): Acme logo, name, colors`.

**Fallback - no browser / the editor can't run** (no browser on the machine, remote environment without port
access): in **one message** ask for the logo (square PNG/SVG, ≥128×128, 512×512 recommended, transparent
background), name EN/RU (≤ 45; current `GREEN-API Connector`), description EN/RU (≤ 132; show the current texts
from `public/_locales/*/messages.json` as examples), primary color in hex (optionally a separate dark-theme color;
current `#3b9702`). Don't invent brand data and don't silently keep GREEN-API values; the logo and name must be the
client's own. Write `branding/brand.json` and `branding/icons/icon{16,32,48,128}.png` yourself (format above; resize
the logo to the exact sizes with any available tool: ImageMagick, Python Pillow, `npx sharp-cli`; don't add image
libraries to `package.json`), then `npm run preview -- --lang ru` (only `release/preview.html`, no build) and
**wait for an explicit approval** of the preview before `npm run release`.

**Do NOT change in White label mode** (it breaks integration or makes upstream merges painful):
- The default brand files - `public/_locales/*/messages.json` (`extName`, `extDescription`), `public/icons/*`,
  `--primary-color` in `src/shared/theme.css`, `<title>` in `index.html` / `popout.html`. They are the GREEN-API
  example; the client's brand goes to `branding/` only.
- `CONNECTOR_SOURCE` in `src/shared/config.ts` (`green-api-connector`) - it's the marker the web pages use in
  `postMessage`; changing it breaks every page that talks to the extension unless the user also controls and
  updates those pages.
- The API URL in `src/popout/InstanceForm.tsx` (`https://api.green-api.com/...`) - it's the GREEN-API endpoint the
  instance credentials are sent to, and it is the same for every client. Never change it, even if the user asks to
  "replace all GREEN-API mentions" - explain why and leave it as is.
- Logic files (`src/background`, `src/content`, `src/packages`, `src/platform`) and `README*`.
- `LICENSE`: MIT requires keeping the existing copyright notice; the client may add their own line below it.

**Pulling upstream updates later** (the main reason to keep the diff small):
```bash
git fetch upstream
git merge upstream/master
```
The brand is only in `branding/`, which upstream doesn't have, so it merges cleanly. Conflicts are only possible in
step 4 edits (`TRUSTED_DOMAINS` in `config.ts`, the Firefox ID in `manifest.config.ts`): keep the client's value
**and** the upstream changes around it. Then `npm run release`.

### Scenario 3 - Publish to the Chrome Web Store

Offered only after a successful build (see above), or when the user asks for it directly.

Goal: the client's extension published (or updated) in the Chrome Web Store. The agent prepares everything and
guides; the client does the steps in their own Google account - **never ask for their Google password or 2FA codes,
and don't try to log in for them.**

1. **Release.** Make sure there is a fresh release (Scenario 1 or 2; mind the
   [Saved brand](#saved-brand-in-branding---check-it-first) question). The store gets `<name>-<version>-chrome.zip`.
   For an **update** of an already published item, the version must be higher than the published one: bump it with
   `npm version patch --no-git-tag-version` (ask first - it changes `package.json`/`package-lock.json`), then
   rebuild with `npm run release`.
2. **Check before upload** (fix what fails, then rebuild):
   - `chrome/manifest.json` has no `background.scripts` / `browser_specific_settings` (the release removes them);
   - name ≤ 45 and description ≤ 132 characters (the store takes them from the manifest / `_locales`);
   - `DEV_MODE` is `false` and the ZIP is NOT from `test/`;
   - icons are the client's own (`branding/icons` in White label) - the store rejects confusingly similar branding,
     so a white label must not use the GREEN-API name/logo unless the client is GREEN-API.
3. **Developer account** (once): the client registers at the Chrome Web Store Developer Dashboard
   (https://chrome.google.com/webstore/devconsole) with a Google account, pays the one-time registration fee and
   turns on 2-step verification. For a company, a group publisher account is recommended.
4. **Prepare the listing materials** (offer to do it):
   - **Description** (detailed, for the store page) in EN and RU - draft it from the extension's purpose; the client
     edits/approves.
   - **Screenshots** 1280×800 (or 640×400), at least one: if you can run a headless Chrome/Edge, render
     `preview.html` (e.g. `--window-size=1280,800`, `?state=...&lang=...`) and give the user the PNGs; otherwise ask
     them to take screenshots of the installed extension.
   - **Store icon** 128×128 - `chrome/icons/icon128.png`.
   - **Small promo tile** 440×280 if the dashboard asks for it.
   - **Privacy policy URL** - required because the extension handles authentication data; the client must provide
     a page on their site (offer a draft text: what is processed, that session data is sent only to the endpoint the
     user's own page specifies, nothing is collected by the extension author, data is cleared from the browser
     after the transfer).
5. **Privacy practices tab** - give the client ready texts:
   - *Single purpose:* "Transfers the WhatsApp Web session of the user's own account to the user's GREEN-API instance
     when the user starts the authorization."
   - *`scripting`:* injects a script into web.whatsapp.com to read the session data after the user logs in.
   - *`tabs`:* opens, focuses and closes the WhatsApp Web window used for the authorization.
   - *`browsingData`:* clears the WhatsApp Web data from the browser after the session has been transferred.
   - *Host permissions:* web.whatsapp.com - to read the session; the trusted domains from `TRUSTED_DOMAINS` - so only
     those pages can start the authorization.
   - *Remote code:* No.
   - *Data usage:* "Authentication information" is handled; it is sent only to the endpoint specified by the user's
     page, not sold or used for anything else. Tick the required certifications.
6. **Upload and submit:** Dashboard → *New item* (or the existing item → *Package* → *Upload new package*) → the
   `-chrome.zip` → fill *Store listing* (category: e.g. Productivity / Tools; language; description; screenshots)
   → *Privacy practices* → *Distribution*: **Unlisted** (only people with the link - usually right for a B2B
   tool), Public or Private → *Submit for review*.
7. **After submission:** review usually takes from a few days to a few weeks; the client gets an email. If
   rejected, read the reason in the dashboard, fix (often: permission justification, privacy policy, description),
   rebuild with a higher version and resubmit. Updates later: steps 1, 2, 6 with a bumped version.

### Testing with the test page

The release's `test/` folder lets the user check the real authorization flow without writing any code. Give them
these steps (in their language):

1. Disable/remove the normal build of the extension if it is installed (two copies would both react).
2. Install the **test build**: Chrome - *Load unpacked* → `test/chrome`; then on the extension's *Details* page turn
   on **Allow access to file URLs**. Firefox - *Load Temporary Add-on* → `test/firefox/manifest.json`.
3. Open `test/test-page.html` in the same browser. The status turns green: *Extension is connected*. If it doesn't
   (e.g. file URLs are blocked), serve the release folder locally and open it via localhost:
   `npx --yes http-server <release folder> -p 8080` → `http://localhost:8080/test/test-page.html`.
4. Enter `idInstance` and `apiTokenInstance` of a test instance → *Start authorization* → log in to WhatsApp in the
   opened window → expect `IMPORT_SENT`. Try `EXISTING_SESSION` → *Log in again* / *Keep session* / *Cancel*, and
   closing the window (`tab_closed`).
5. When done, remove the test build and install the normal one (`chrome/` or `firefox/`).

Rules:
- **Warn the user:** the test build trusts any local page - it's for testing only, **never publish or distribute
  `test/`**. Publish only `chrome/` / `firefox/` or their ZIPs.
- **Never ask the user for their `apiTokenInstance`** and never put real credentials into any file - the user types
  them into the test page themselves (the page masks the token in its log).
- If you can take browser screenshots (e.g. headless Chrome/Edge), look at `preview.html` before handing it over;
  `preview.html?state=<initial|sent|existing|hasCreds|failed|inProgress>&lang=<en|ru>` opens the authorization
  window in a given state.

---

The sections below are for **code changes** (contributors and maintainers). They are reference material for when
a user explicitly asks to change the code - **don't offer code changes to clients** and don't list them as an option.

## Commands

```bash
npm ci                     # install exact deps from package-lock.json
npx tsc --noEmit           # type check (there is no separate script for it)
npm run build              # build with default messenger (whatsapp) -> dist/
npm run build:whatsapp     # explicit WhatsApp build
npm run build:max          # MAX build
npm run release            # WhatsApp release: chrome/, firefox/, their ZIPs, preview.html, test/
npm run release -- --default-brand   # same, but ignore branding/ (plain GREEN-API build)
npm run release:qr         # maintainers: release of the QR Connector preset (brands/qr-connector), branding/ ignored
                           # (any preset: node scripts/release.mjs --brand <id>; add --preview-only for preview.html)
npm run preview            # WhatsApp: only release/preview.html, no build, src/ untouched
                           # (maintainers, other messenger: node scripts/release.mjs --messenger max [--preview-only])
npm run brand-editor       # White label editor: (install deps) -> Save (branding/) -> Build extension; exits when the tab is closed
```

There are **no automated tests and no linter**. "Verified" in this repo means:

1. `npx tsc --noEmit` exits 0.
2. `npm run build:<messenger>` succeeds for **every** messenger your change can affect. Anything outside
   `src/packages/<name>/` affects all messengers - build all of them.
3. For behaviour changes: manual check in a browser (see [Manual testing](#manual-testing)). If you cannot do it,
   say so explicitly to the user instead of claiming the change works.

On Windows, prefer the npm scripts (they use `cross-env`) over setting `MESSENGER=...` inline.

## Architecture

```
web page (trusted origin)
  │ window.postMessage {target:'green-api-connector', type:...}
  ▼
src/content/app-bridge.ts      content script on trusted hosts; validates & relays to the worker
  │ browser.runtime.sendMessage
  ▼
src/background/index.ts        service worker entry; origin check, routes message types
src/background/import-manager.ts   orchestrator: single import at a time, popup lifecycle, consent gate
src/background/messaging.ts    sends ImportEvents back to the origin tab (or to extension pages)
src/background/popout.ts       the extension's own "Authorize instance" window (OPEN_POPOUT)
  │ driver.startSession(ctx)        `@messenger` alias -> src/packages/<MESSENGER>/
  ▼
src/packages/<messenger>/      messenger-specific logic (the only place that knows about WhatsApp/MAX)
  index.ts        exports `driver: MessengerDriver` (name is fixed - the alias expects it)
  manifest.ts     origin + match patterns + MAIN-world page script path (loaded by Node at build time!)
  session.ts      class implementing MessengerSession - all import state lives here
  page-scripts.ts browser.scripting.executeScript({world:'MAIN'}) wrappers
  *.js            MAIN-world page script, injected at document_start into the messenger site
src/packages/types.ts          ImportEvent / ImportContext / MessengerSession / MessengerDriver contracts
src/platform/browser.ts        wrappers over browser.* (tabs, windows, browsingData) incl. Chrome/Firefox differences
src/shared/config.ts           CONNECTOR_SOURCE, TRUSTED_DOMAINS, DEV_MODE, origin checks
src/popup/, src/popout/        React UI (toolbar popup, standalone authorization form)
scripts/release.mjs            release folder / quick preview (npm run release, npm run preview)
scripts/brand-editor.mjs       White label editor server: deps install, Save (-> branding/), Build (release)
scripts/lib/kit.mjs            shared: deps check/install, brand validation/saving, builds, pages, zip, release
scripts/lib/branding.mjs       branding/ format + how it is applied on top of the defaults (used by vite.config.ts too)
branding/                      client brand overrides (White label forks only; absent upstream)
brands/<id>/                   maintainer brand presets (same format as branding/), e.g. brands/qr-connector;
                               built with --brand <id> / CONNECTOR_BRAND=<id>; not for clients
scripts/preview/               one React bundle for all pages: main.tsx (preview), editor.tsx (brand form),
                               test-page.tsx (test page), config.ts (page config), browser-mock.ts
public/_locales/{en,ru}/       i18n strings; public/icons/ - icons
manifest.config.ts             MV3 manifest; registry of messengers (MESSENGER_MANIFESTS)
vite.config.ts                 build; `brandingOverrides` applies branding/, `crossBrowserManifest` patches the manifest
example/index.html             manual test page for the postMessage protocol
```

## Rules and invariants

**Messenger packages**
- Code under `src/packages/<name>/` must not be imported from outside except through the `@messenger` alias
  (`driver`) and `manifest.ts` (from `manifest.config.ts`). Shared code must not depend on a specific messenger.
- `manifest.ts` is executed by Node during the build. Never import runtime code there (especially
  `webextension-polyfill` - it throws outside a browser and breaks the build).
- Use helpers from `src/platform/browser.ts` (`removeBrowsingData`, `reloadTab`, `waitForTabLoad`, `focusWindow`,
  `closeTab`) instead of calling `browser.*` directly; add a new helper there if one is missing. Cross-browser
  differences belong in `platform/`, not in packages.
- Session contract (see comments in `src/packages/types.ts` and `src/packages/template/session.ts`):
  - `start()` is called once; it waits for the tab itself.
  - `onUserConfirmedClear()` / `onUserConfirmedKeep()` are called at most once, mutually exclusive, only after
    the session emitted `EXISTING_SESSION`. Don't add guards for this - the orchestrator guarantees it.
  - `cancel()` only stops timers and sets a `cancelled` flag. It must **not** close the tab (orchestrator does).
  - After every `await`, check `this.cancelled` before emitting or continuing.
  - Every terminal path must `ctx.emit(...)` a result **and** call `ctx.finish()` exactly once.
  - Error `reason` values are a public API (`timeout`, `network`, `http_error` + `httpStatus`, `tab_closed`,
    `unexpected_error`, `import_already_in_progress`). Reuse them; adding one is a protocol change.
- MAIN-world page scripts (`*.js`) have no extension APIs; they expose one function on `window` and return
  JSON-serialisable data.

**Protocol (page ⇄ extension)** - this is a public contract used by GREEN-API web apps. A new or changed message
type must be updated in *all* of these places in the same change:
`src/content/app-bridge.ts` (type + guard + switch), `src/background/index.ts` (switch),
`src/background/import-manager.ts`, `src/packages/types.ts` (`ImportEvent` + `isImportEvent`),
`src/popout/InstanceForm.tsx` (if the popout must react), `example/index.html`,
`scripts/preview/test-page.tsx` (buttons + texts), and **both** READMEs.
Keep backward compatibility (e.g. `START_PASSKEY_IMPORT` is kept as an alias of `START_IMPORT`).

**Security** - the extension handles live messenger session credentials.
- Never relax `isTrustedOrigin` / `TRUSTED_DOMAINS` / `isFromOwnExtension` checks, and never widen
  `host_permissions` or `permissions` without the user explicitly asking.
- `DEV_MODE` in `src/shared/config.ts` must be `false` in committed code. If you turn it on for local testing,
  turn it off before committing and tell the user.
- Never log, persist, or send session dumps, API tokens or endpoint URLs anywhere except the endpoint supplied
  in the request. Don't add analytics or third-party network calls.
- After a successful send, packages clear the messenger's browsing data - keep that behaviour.

**Cross-browser**
- Use `webextension-polyfill` (`import browser from 'webextension-polyfill'`), never the `chrome.*` global.
- Firefox minimum is 128 (`browser_specific_settings.gecko`). `web_accessible_resources` entries must not use
  `use_dynamic_url: true` (the build plugin refuses it).
- If you change the manifest, check the built `dist/manifest.json` (it has both `service_worker` and `scripts`).

**UI / i18n**
- All user-visible strings go through `browser.i18n.getMessage`. Add every key to **both**
  `public/_locales/en/messages.json` and `public/_locales/ru/messages.json`.
- Colors come from CSS variables in `src/shared/theme.css`.
- The preview (`scripts/preview`) renders `src/popup` and `src/popout` with `scripts/preview/browser-mock.ts` in
  place of `webextension-polyfill`. If UI code starts using another `browser.*` API, add it to the mock, and
  check the preview still renders (`npm run preview`, open `release/preview.html`).

**Docs**
- `README.md` and `README.ru.md` are kept in sync: any user-facing change (protocol, build scripts, config,
  new messenger) goes into both.

## Common tasks

### Add a new messenger
1. Copy `src/packages/template/` to `src/packages/<name>/` and rename identifiers/`window.__...` function names.
2. Set the real origin in `manifest.ts`; implement `page-script.js`, `page-scripts.ts`, `session.ts`
   (use `src/packages/max/` as the smallest real example, `whatsapp/` as the full one).
3. Register `manifestContribution` in `MESSENGER_MANIFESTS` in `manifest.config.ts`.
4. Add `"build:<name>": "cross-env MESSENGER=<name> vite build"` to `package.json`.
5. Document the new build command in both READMEs.
6. Type check, build the new messenger **and** the existing ones.

### Change behaviour of one messenger
Edit only `src/packages/<name>/`. Build that messenger and do a manual check.

### Release / version bump
Version comes from `package.json` (the manifest reads it). Bump it with
`npm version <patch|minor|major> --no-git-tag-version` so `package-lock.json` stays in sync, as a separate
`chore: up version` commit. Only do this when asked.

## Manual testing

Quickest: `npm run release` (WhatsApp) or `node scripts/release.mjs --messenger max` and use the release's `test/`
folder (see [Testing with the test page](#testing-with-the-test-page)) - it handles
`DEV_MODE` for you. Manually:

1. Temporarily set `DEV_MODE = true` in `src/shared/config.ts` (allows `http://localhost` and `file://`).
2. `npm run build:<messenger>`.
3. Load `dist/`: Chrome - `chrome://extensions` → Developer mode → *Load unpacked*;
   Firefox - `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → `dist/manifest.json`.
4. Open `example/index.html` (file or local server), send `PING` → expect `CONNECTOR_READY`, then `START_IMPORT`
   with an endpoint URL, and watch the event log. Service-worker logs: the extension's "Inspect" / "Inspect views".
5. Revert `DEV_MODE` to `false`.

## Git workflow

- Default branch: `master`. Work on a branch named `feat/<TICKET>` or `fix/<TICKET>` (e.g. `feat/AND-33`);
  merge via Pull Request on GitHub (`green-api/...`).
- Commit messages: Conventional Commits, with the ticket as scope when there is one:
  `feat(SW-6029): move authorization form to popout window`, `fix: ...`, `refactor: ...`, `docs: ...`, `chore: ...`.
- Don't commit `dist/` or `node_modules/` (gitignored). Commit `package-lock.json` when dependencies change.
- Only commit, push or open PRs when the user asks.

## Code style

- TypeScript strict; avoid `any` - use `unknown` plus type guards (see `isImportEvent`, `isPageToBridgeMessage`).
- Follow the surrounding file's formatting: single quotes, mostly no semicolons in `src/background`,
  `src/packages`, `src/platform`; 2-space indent in `src/`, 4-space in `vite.config.ts`.
- Comments explain *why* / contracts, in English. Prefix `console.warn` messages with the module, e.g.
  `[platform/browser] ...`.
- Keep changes minimal and scoped; don't reformat unrelated code.
