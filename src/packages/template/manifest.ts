// This file is loaded in Node at build time (see manifest.config.ts), not in the browser.
// DO NOT import runtime code here - in particular, never import 'webextension-polyfill':
// it throws "This script should only be loaded in a browser extension" the moment it's
// imported outside a browser, and that would crash the build. Runtime code (anything that
// touches `browser.*`) belongs in page-scripts.ts / session.ts / index.ts, not here.

// Fictitious origin - replace with the real web origin.
export const TEMPLATE_ORIGIN = 'https://example.com'

export const manifestContribution = {
  origin: TEMPLATE_ORIGIN,
  matches: [`${TEMPLATE_ORIGIN}/*`],
  pageScript: 'src/packages/template/page-script-template.js',
}
