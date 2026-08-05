import { CONNECTOR_SOURCE, isTrustedOrigin } from '../shared/config'
import './popout'

export { }

const WA_ORIGIN = 'https://web.whatsapp.com'

const MAX_POLLS = 120
const POLL_INTERVAL_MS = 2500
const MAX_NOISE_KEY_MISSING_POLLS = 5
const POPUP_WIDTH = 800;
const POPUP_HEIGHT = 600;

type ImportErrorReason = 'noise_key_unavailable' | 'timeout' | 'network' | string

interface PendingImport {
  url: string
  tabId: number
  windowId: number
  originTabId: number | null
  attempts: number
  meJidSeenLastPoll: string | null
  stableCount: number
  noiseKeyMissingCount: number
  awaitingConsent: boolean
  flowStarted: boolean
  cancelled: boolean
  pollTimer: ReturnType<typeof setTimeout> | null
}

let pending: PendingImport | null = null
let starting = false

function createPopup(url: string): Promise<{ tabId: number; windowId: number }> {
  const windowConfig: chrome.windows.CreateData = {
    url,
    type: 'popup',
    focused: true,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
  };

  return new Promise((resolve, reject) => {
    chrome.windows.create(windowConfig, (win) => {
      const err = chrome.runtime.lastError
      const tab = win?.tabs?.[0]
      if (err || !win || win.id === undefined || !tab || tab.id === undefined) {
        reject(new Error(err?.message ?? 'chrome.windows.create failed'))
        return
      }
      resolve({ tabId: tab.id, windowId: win.id })
    });
  });
}

function focusWindow(windowId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.windows.update(windowId, { focused: true }, () => {
      void chrome.runtime.lastError
      resolve()
    })
  })
}

function reloadTab(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.reload(tabId, {}, () => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message))
        return
      }
      resolve()
    })
  })
}

function closeTab(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => {
      void chrome.runtime.lastError
      resolve()
    })
  })
}

function removeBrowsingData(origin: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.browsingData.remove(
        { origins: [origin] },
        {
          cacheStorage: true,
          cookies: true,
          fileSystems: true,
          indexedDB: true,
          localStorage: true,
          serviceWorkers: true,
          webSQL: true,
        },
        () => {
          const err = chrome.runtime.lastError
          resolve()
        },
      )
    } catch (e) {
      resolve()
    }
  })
}

function sendImportResponse(tabId: number | null, message: unknown): void {
  const payload = { source: CONNECTOR_SOURCE, ...(message as object) }
  if (!tabId) {
    chrome.runtime.sendMessage(payload, () => { void chrome.runtime.lastError })
    return
  }
  chrome.tabs.sendMessage(tabId, payload, () => { void chrome.runtime.lastError })
}

function isExtensionUrl(url: string) {
  const extensionUrl = chrome.runtime.getURL('');
  return url.startsWith(extensionUrl)
}

export function isFromOwnExtension(sender: chrome.runtime.MessageSender) {
  if (!sender.url){
    return false;
  }

  return sender.id === chrome.runtime.id && isExtensionUrl(sender.url);
}

async function readExistingSessionJid(tabId: number): Promise<string | null> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (): string | null => {
      try {
        const raw = window.localStorage.getItem('last-wid-md')
        if (!raw) return null
        const parsed = JSON.parse(raw) as { user?: string; _serialized?: string } | string
        if (typeof parsed === 'string') return parsed
        if (parsed && typeof parsed._serialized === 'string') return parsed._serialized
        if (parsed && typeof parsed.user === 'string') return parsed.user
        return null
      } catch {
        return null
      }
    },
  }).catch(() => null)
  return results?.[0]?.result ?? null
}

async function forcePasskeyMode(tabId: number): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (): boolean => {
      function resolveModule(name: string): unknown {
        try {
          const win = window as unknown as { require?: (name: string) => unknown }
          if (typeof win.require === 'function') {
            try {
              const mod = win.require(name)
              if (mod) 
                return mod
            } catch {
            }
          }
        } catch {
        }
        return null
      }

      try {
        const altDeviceLinking = resolveModule('WAWebAltDeviceLinkingApi') as
          | { setPairingType?: (mode: string) => void }
          | null
        const linkDeviceEvents = resolveModule('WAWebLinkDeviceEvents') as
          | { triggerPasskeyPrologueRequest?: () => void }
          | null
        if (altDeviceLinking?.setPairingType && linkDeviceEvents?.triggerPasskeyPrologueRequest) {
          altDeviceLinking.setPairingType('SHORTCAKE_PASSKEY')
          linkDeviceEvents.triggerPasskeyPrologueRequest()
          return true
        }
      } catch {
      }

      return false
    },
  }).catch(() => null)
  return results?.[0]?.result ?? false
}

interface RawSessionDump {
  device?: {
    noiseKey?: unknown
    identityKey?: unknown
    account?: unknown
    meJid?: string | null
  }
}

async function pollSessionDump(tabId: number): Promise<RawSessionDump | null> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (): Promise<unknown> => {
      const dumpFn = (window as unknown as { __waWebSessionDump?: () => Promise<unknown> }).__waWebSessionDump
      if (typeof dumpFn !== 'function') return null
      try {
        return await dumpFn()
      } catch {
        return null
      }
    },
  }).catch(() => null) 
  return (results?.[0]?.result as RawSessionDump | null) ?? null
}

function clearPollTimer(state: PendingImport): void {
  if (state.pollTimer !== null) {
    clearTimeout(state.pollTimer)
    state.pollTimer = null
  }
}

async function finishWithError(state: PendingImport, reason: ImportErrorReason): Promise<void> {
  clearPollTimer(state)
  if (pending === state) 
    sendImportResponse(state.originTabId, { type: 'IMPORT_ERROR', reason })

  if (pending === state) 
    pending = null
  
  await closeTab(state.tabId)
}

async function finishWithSuccess(state: PendingImport, me?: ImportedIdentity): Promise<void> {
  clearPollTimer(state)
  if (pending === state) {
    sendImportResponse(state.originTabId, { type: 'IMPORT_SENT', name: me?.name ?? null, number: me?.number ?? null })
  }
  
  await removeBrowsingData(WA_ORIGIN)
  
  if (pending === state) 
    pending = null
  await closeTab(state.tabId)
}

type ImportedIdentity = { name: string | null; number: string | null }

function extractImportedIdentity(dump: unknown): ImportedIdentity {
  const device = (dump as { device?: { meJid?: string | null; meDisplayName?: string | null } } | null)?.device
  const jid = device?.meJid ?? null
  const number = jid ? jid.split('@')[0].split(':')[0] || null : null
  const rawName = device?.meDisplayName
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null
  return { name, number }
}

async function submitDump(state: PendingImport, dump: unknown): Promise<void> {
  let response: Response
  try {
    response = await fetch(state.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dump),
    })
  } catch {
    await finishWithError(state, 'network')
    return
  }

  if (!response.ok) {
    await finishWithError(state, `HTTP ${response.status}`)
    return
  }

  await finishWithSuccess(state, extractImportedIdentity(dump))
}

function isDumpCompleteAndStable(state: PendingImport, dump: RawSessionDump | null): boolean {
  const device = dump?.device
  const meJid = device?.meJid ?? null

  if (!device || !meJid) {
    state.stableCount = 0
    return false
  }

  const hasNoiseKey = Boolean(device.noiseKey)
  const hasIdentityKey = Boolean(device.identityKey)
  const hasAccount = Boolean(device.account)

  if (!hasNoiseKey) {
    state.noiseKeyMissingCount += 1
    state.stableCount = 0
    return false
  }
  state.noiseKeyMissingCount = 0

  if (!hasIdentityKey || !hasAccount) {
    state.stableCount = 0
    return false
  }

  if (state.meJidSeenLastPoll === meJid) {
    state.stableCount += 1
  } else {
    state.stableCount = 1
  }
  state.meJidSeenLastPoll = meJid

  return state.stableCount >= 2
}

async function pollOnce(state: PendingImport): Promise<void> {
  if (state.cancelled || pending !== state) return

  state.attempts += 1

  const dump = await pollSessionDump(state.tabId)

  if (state.cancelled || pending !== state) return

  if (isDumpCompleteAndStable(state, dump)) {
    await submitDump(state, dump)
    return
  }

  if (state.noiseKeyMissingCount >= MAX_NOISE_KEY_MISSING_POLLS) {
    await finishWithError(state, 'noise_key_unavailable')
    return
  }

  if (state.attempts >= MAX_POLLS) {
    await finishWithError(state, 'timeout')
    return
  }

  state.pollTimer = setTimeout(() => {
    void pollOnce(state)
  }, POLL_INTERVAL_MS)
}

async function beginPasskeyFlow(state: PendingImport): Promise<void> {
  state.flowStarted = true

  await focusWindow(state.windowId)

  const maxForceAttempts = 5
  for (let attempt = 0; attempt < maxForceAttempts; attempt += 1) {
    if (state.cancelled) 
      return
    
    const ok = await forcePasskeyMode(state.tabId)
    if (ok) 
      break
    
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  if (state.cancelled) 
    return

  state.pollTimer = setTimeout(() => {
    void pollOnce(state)
  }, POLL_INTERVAL_MS)
}

async function handleTabComplete(tabId: number): Promise<void> {
  const state = pending
  if (!state || state.tabId !== tabId || state.cancelled) 
    return

  if (state.awaitingConsent) 
    return
  if (state.flowStarted) 
    return

  const existingJid = await readExistingSessionJid(tabId)
  if (state.cancelled || pending !== state) 
    return

  if (existingJid) {
    state.awaitingConsent = true
    sendImportResponse(state.originTabId, { type: 'EXISTING_SESSION', number: existingJid })
    return
  }

  await beginPasskeyFlow(state)
}

async function startImport(url: string, originTabId: number | null): Promise<void> {
  if (pending || starting) {
    sendImportResponse(originTabId, { type: 'IMPORT_ERROR', reason: 'import_already_in_progress' })
    return
  }

  starting = true
  let popup: { tabId: number; windowId: number }
  try {
    popup = await createPopup(WA_ORIGIN)
  } catch {
    starting = false
    sendImportResponse(originTabId, { type: 'IMPORT_ERROR', reason: 'unexpected_error' })
    return
  }

  pending = {
    url,
    tabId: popup.tabId,
    windowId: popup.windowId,
    originTabId,
    attempts: 0,
    meJidSeenLastPoll: null,
    stableCount: 0,
    noiseKeyMissingCount: 0,
    awaitingConsent: false,
    flowStarted: false,
    cancelled: false,
    pollTimer: null,
  }
  starting = false
}

async function clearAndContinue(): Promise<void> {
  const state = pending
  if (!state || !state.awaitingConsent) 
    return

  state.awaitingConsent = false
  await removeBrowsingData(WA_ORIGIN)
  
  if (pending !== state || state.cancelled) 
    return
  
  state.flowStarted = false
  await reloadTab(state.tabId)
}

export async function cancelImport(): Promise<void> {
  const state = pending
  if (!state) return

  state.cancelled = true
  clearPollTimer(state)
  await closeTab(state.tabId)
  if (pending === state) pending = null
}

async function reinjectBridgeIntoOpenTabs(): Promise<void> {
  const bridgeCs = chrome.runtime
    .getManifest()
    .content_scripts?.find((cs) => cs.js?.some((j) => j.includes('app-bridge')))
  const matches = bridgeCs?.matches
  const files = bridgeCs?.js
  if (!matches?.length || !files?.length) return

  const tabs = await chrome.tabs.query({ url: matches }).catch(() => [])
  await Promise.all(
    tabs.map((tab) =>
      tab.id != null
        ? chrome.scripting
          .executeScript({ target: { tabId: tab.id }, files })
          .catch(() => null)
        : null,
    ),
  )
}

chrome.runtime.onInstalled.addListener(() => void reinjectBridgeIntoOpenTabs())
chrome.runtime.onStartup.addListener(() => void reinjectBridgeIntoOpenTabs())

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return
  if (!pending || pending.tabId !== tabId) return
  void handleTabComplete(tabId)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  if (pending && pending.tabId === tabId) {
    if (!pending.cancelled) {
      sendImportResponse(pending.originTabId, { type: 'IMPORT_ERROR', reason: 'tab_closed' })
    }
    clearPollTimer(pending)
    pending = null
  }
})


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (typeof message !== 'object' || message === null) return undefined
  
  let origin = sender.origin;
  if (!origin || origin === "null"){
    origin = sender.url
  }
  if (!isTrustedOrigin(origin) && !isFromOwnExtension(sender)) return undefined

  const candidate = message as Record<string, unknown>
  const originTabId = sender.tab?.id ?? null

  switch (candidate.type) {
    case 'START_PASSKEY_IMPORT': {
      const url = candidate.url
      if (typeof url === 'string') {
        void startImport(url, originTabId)
      }
      return undefined
    }
    case 'CLEAR_AND_CONTINUE':
      void clearAndContinue()
      return undefined
    case 'CANCEL_IMPORT':
      void cancelImport()
      return undefined
    case 'IS_CONNECTOR_INSTALLED':
      sendResponse({ installed: true })
      return true
    default:
      return undefined
  }
})
