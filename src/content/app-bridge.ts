import browser from 'webextension-polyfill'
import { CONNECTOR_SOURCE as SOURCE } from '../shared/config'
import { isImportEvent, type ImportEvent } from '../packages/types'

export {}

declare global {
  interface Window {
    __connectorBridge?: boolean
  }
}

type PageToBridgeMessage =
  | { target: typeof SOURCE; type: 'PING' }
  | { target: typeof SOURCE; type: 'START_IMPORT'; url: string }
  | { target: typeof SOURCE; type: 'START_PASSKEY_IMPORT'; url: string }
  | { target: typeof SOURCE; type: 'CLEAR_AND_CONTINUE' }
  | { target: typeof SOURCE; type: 'KEEP_AND_CONTINUE' }
  | { target: typeof SOURCE; type: 'CANCEL_IMPORT' }

function isPageToBridgeMessage(data: unknown): data is PageToBridgeMessage {
  if (typeof data !== 'object' || data === null) 
    return false
  
  const candidate = data as Record<string, unknown>
  if (candidate.target !== SOURCE) 
    return false
  
  return (
    candidate.type === 'PING' ||
    candidate.type === 'START_IMPORT' ||
    candidate.type === 'START_PASSKEY_IMPORT' ||
    candidate.type === 'CLEAR_AND_CONTINUE' ||
    candidate.type === 'KEEP_AND_CONTINUE' ||
    candidate.type === 'CANCEL_IMPORT'
  )
}

function announce(): void {
  window.postMessage({ source: SOURCE, type: 'CONNECTOR_READY' }, '*')
}

function relayToPage(message: ImportEvent): void {
  window.postMessage({ source: SOURCE, ...message }, '*')
}

function handlePageMessage(event: MessageEvent): void {
  if (event.source !== window) 
    return
  
  if (!isPageToBridgeMessage(event.data)) 
    return

  const message = event.data

  switch (message.type) {
    case 'PING':
      announce()
      return
    case 'START_IMPORT':
    case 'START_PASSKEY_IMPORT':
      browser.runtime.sendMessage({ type: message.type, url: message.url }).catch(() => {})
      return
    case 'CLEAR_AND_CONTINUE':
      browser.runtime.sendMessage({ type: 'CLEAR_AND_CONTINUE' }).catch(() => {})
      return
    case 'KEEP_AND_CONTINUE':
      browser.runtime.sendMessage({ type: 'KEEP_AND_CONTINUE' }).catch(() => {})
      return
    case 'CANCEL_IMPORT':
      browser.runtime.sendMessage({ type: 'CANCEL_IMPORT' }).catch(() => {})
      return
  }
}

function handleWorkerMessage(message: unknown): void {
  if (isImportEvent(message))
    relayToPage(message)
}

function init(): void {
  if (window.__connectorBridge) return
  window.__connectorBridge = true

  window.addEventListener('message', handlePageMessage)
  browser.runtime.onMessage.addListener((message: unknown) => {
    handleWorkerMessage(message)
  })

  announce()
}

init()
