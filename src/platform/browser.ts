import browser, { BrowsingData, Windows } from 'webextension-polyfill'

const isFirefox = typeof browser.runtime.getBrowserInfo === 'function'

const POPUP_WIDTH = 800
const POPUP_HEIGHT = 600

// browser.browsingData.remove's typings from webextension-polyfill don't cover the
// Chrome-only ('origins') and Firefox-only ('hostnames') filter fields we rely on below.
export interface RemovalOptions extends BrowsingData.RemovalOptions {
  origins?: string[]
}

export interface DataTypeSet extends BrowsingData.DataTypeSet {
  cacheStorage?: boolean
  fileSystems?: boolean
  webSQL?: boolean
}

export async function closeTab(tabId: number): Promise<void> {
  try {
    await browser.tabs.remove(tabId)
  } catch (error) {
    console.warn('[platform/browser] closeTab failed', { tabId, error })
  }
}

export async function focusWindow(windowId: number): Promise<void> {
  try {
    await browser.windows.update(windowId, { focused: true })
  } catch (error) {
    console.warn('[platform/browser] focusWindow failed', { windowId, error })
  }
}

export async function reloadTab(tabId: number): Promise<void> {
  try {
    await browser.tabs.reload(tabId, {})
  } catch (error) {
    console.warn('[platform/browser] reloadTab failed', { tabId, error })
  }
}

export async function waitForTabLoad(tabId: number, timeoutMs = 60_000): Promise<void> {
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      browser.tabs.onUpdated.removeListener(onUpdated)
      resolve()
    }
    const onUpdated = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete')
        finish()
    }
    const timer = setTimeout(() => {
      console.warn('[platform/browser] waitForTabLoad timed out', { tabId, timeoutMs })
      finish()
    }, timeoutMs)

    // Subscribe before checking the current status, otherwise 'complete' fired in between is lost.
    browser.tabs.onUpdated.addListener(onUpdated)
    browser.tabs.get(tabId).then(
      (tab) => {
        if (tab.status === 'complete')
          finish()
      },
      (error) => {
        console.warn('[platform/browser] waitForTabLoad failed', { tabId, error })
        finish()
      },
    )
  })
}

export async function removeBrowsingData(origin: string): Promise<void> {
  try {
    await browser.browsingData.remove(getRemovalOptions(origin), getDataTypeSet())
  } catch (error) {
    console.warn('[platform/browser] removeBrowsingData failed', { origin, error })
  }
}

export async function createPopup(url: string): Promise<{ targetTabId: number; targetWindowId: number }> {
  const windowConfig: Windows.CreateCreateDataType = {
    url,
    type: 'popup',
    focused: true,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
  }

  const win = await browser.windows.create(windowConfig)
  const tab = win.tabs?.[0]
  if (win.id === undefined || !tab || tab.id === undefined) {
    throw new Error('browser.windows.create failed')
  }
  return { targetTabId: tab.id, targetWindowId: win.id }
}

function getRemovalOptions(origin: string): RemovalOptions {
  if (isFirefox) {
    const hostname = new URL(origin).hostname
    return { hostnames: [hostname] }
  }
  return { origins: [origin] }
}

function getDataTypeSet(): DataTypeSet {
  if (isFirefox) {
    return {
      cookies: true,
      indexedDB: true,
      localStorage: true,
      serviceWorkers: true
    }
  }

  return {
    cacheStorage: true,
    cookies: true,
    fileSystems: true,
    indexedDB: true,
    localStorage: true,
    serviceWorkers: true,
    webSQL: true,
  }
}
