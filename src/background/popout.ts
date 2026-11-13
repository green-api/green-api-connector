import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import { isFromOwnExtension } from "./messaging"
import { cancelActiveImport } from "./import-manager"

const POPOUT_URL = browser.runtime.getURL("popout.html")
const POPOUT_WIDTH = 420
const POPOUT_HEIGHT = 400

let openedWindowId: number | undefined

async function findPopoutWindowId(): Promise<number | undefined> {
  if (openedWindowId !== undefined) {
    try {
      await browser.windows.get(openedWindowId)
      return openedWindowId
    } catch {
      openedWindowId = undefined
    }
  }

  const [tab] = await browser.tabs.query({ url: POPOUT_URL })
  openedWindowId = tab?.windowId
  return openedWindowId
}

export async function openPopout(): Promise<void> {
  const existingId = await findPopoutWindowId()
  if (existingId !== undefined) {
    await browser.windows.update(existingId, { focused: true, drawAttention: true })
    return
  }

  const window = await browser.windows.create({
    url: POPOUT_URL,
    type: "popup",
    width: POPOUT_WIDTH,
    height: POPOUT_HEIGHT,
    focused: true
  })
  openedWindowId = window?.id
}

browser.windows.onRemoved.addListener((windowId) => {
  if (windowId !== openedWindowId)
    return

  openedWindowId = undefined
  void cancelActiveImport()
})

browser.runtime.onMessage.addListener((msg: unknown, sender: Runtime.MessageSender) => {
  if (typeof msg !== 'object' || msg === null)
    return undefined

  if ((msg as Record<string, unknown>).type !== "OPEN_POPOUT")
    return undefined

  if (!isFromOwnExtension(sender))
    return undefined

  return openPopout()
    .then(() => ({ ok: true }))
    .catch(() => ({ ok: false }))
})
