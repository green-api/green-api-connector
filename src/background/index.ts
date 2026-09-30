import browser, { Runtime } from 'webextension-polyfill'
import { isTrustedOrigin } from '../shared/config'
import './popout'

import { isFromOwnExtension } from './messaging'
import {
  cancelActiveImport,
  confirmClearAndContinue,
  handleTabRemoved,
  startImport,
} from './import-manager'


export interface MessageSender extends Runtime.MessageSender {
  origin?: string
}

async function reinjectBridgeIntoOpenTabs(): Promise<void> {
  const bridgeCs = browser.runtime
    .getManifest()
    .content_scripts?.find((cs) => cs.js?.some((j) => j.includes('app-bridge')))
  const matches = bridgeCs?.matches
  const files = bridgeCs?.js
  if (!matches?.length || !files?.length) return

  const tabs = await browser.tabs.query({ url: matches }).catch(() => [])
  await Promise.all(
    tabs.map((tab) =>
      tab.id != null
        ? browser.scripting
          .executeScript({ target: { tabId: tab.id }, files })
          .catch(() => null)
        : null,
    ),
  )
}

function handleOnMessage(message: unknown, sender: MessageSender): void {
  if (typeof message !== 'object' || message === null) return
  
  let origin = sender.origin;
  if (!origin || origin === "null"){
    origin = sender.url
  }
  if (!isTrustedOrigin(origin) && !isFromOwnExtension(sender)) return

  const candidate = message as Record<string, unknown>
  const originTabId = sender.tab?.id ?? null

  switch (candidate.type) {
    case 'START_IMPORT':
    case 'START_PASSKEY_IMPORT': {
      const url = candidate.url
      if (typeof url === 'string') {
        void startImport(url, originTabId)
      }
      return
    }
    case 'CLEAR_AND_CONTINUE':
      void confirmClearAndContinue()
      return
    case 'CANCEL_IMPORT':
      void cancelActiveImport()
      return
    default:
      return
  }
}

browser.tabs.onRemoved.addListener(handleTabRemoved)

browser.runtime.onInstalled.addListener(reinjectBridgeIntoOpenTabs)
browser.runtime.onStartup.addListener(reinjectBridgeIntoOpenTabs)
browser.runtime.onMessage.addListener(handleOnMessage)
