import browser, { Runtime } from 'webextension-polyfill'
import { CONNECTOR_SOURCE } from '../shared/config'
import type { ImportEvent } from '../packages/types'

export function sendImportResponse(targetTabId: number | null, message: ImportEvent): void {
  const payload = { source: CONNECTOR_SOURCE, ...message }
  if (!targetTabId) {
    void browser.runtime.sendMessage(payload).catch(() => { })
    return
  }
  void browser.tabs.sendMessage(targetTabId, payload).catch(() => { })
}

export function isFromOwnExtension(sender: Runtime.MessageSender): boolean {
  if (!sender.url) {
    return false
  }

  return sender.id === browser.runtime.id && sender.url.startsWith(browser.runtime.getURL(''))
}
