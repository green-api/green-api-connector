;(function () {
  'use strict'

  // This script runs in the MAIN world, i.e. inside the page's own execution context
  // (see manifestContribution.pageScript). It has no access to any extension API
  // (no `browser.*`, no `chrome.*`) - it only sees what the page itself sees
  // (window, localStorage, indexedDB, the page's in-memory modules, etc).
  //
  // The package talks to it via browser.scripting.executeScript({ world: 'MAIN' }),
  // see page-scripts.ts. Communication is one-way and stateless: the extension calls
  // a function exposed on `window`, and reads its return value from the injection result.

  async function dumpSession() {
    // TODO: read whatever the real messenger keeps in the page (localStorage,
    // indexedDB, in-memory modules, ...) and return a plain JSON-serializable value.
    return null
  }

  window.__templateWebSessionDump = async function () {
    return dumpSession()
  }
})()
