import { CONNECTOR_SOURCE as SOURCE } from '../shared/config'

export {}

declare global {
  interface Window {
    __connectorBridge?: boolean
  }
}

type PageToBridgeMessage =
  | { target: typeof SOURCE; type: 'PING' }
  | { target: typeof SOURCE; type: 'START_PASSKEY_IMPORT'; url: string }
  | { target: typeof SOURCE; type: 'CLEAR_AND_CONTINUE' }
  | { target: typeof SOURCE; type: 'CANCEL_IMPORT' }

type WorkerToBridgeMessage =
  | { type: 'EXISTING_SESSION'; number: string | null }
  | { type: 'IMPORT_SENT'; name?: string | null; number?: string | null }
  | { type: 'IMPORT_ERROR'; reason: string }

function isPageToBridgeMessage(data: unknown): data is PageToBridgeMessage {
  if (typeof data !== 'object' || data === null) 
    return false
  
  const candidate = data as Record<string, unknown>
  if (candidate.target !== SOURCE) 
    return false
  
  return (
    candidate.type === 'PING' ||
    candidate.type === 'START_PASSKEY_IMPORT' ||
    candidate.type === 'CLEAR_AND_CONTINUE' ||
    candidate.type === 'CANCEL_IMPORT'
  )
}

function announce(): void {
  window.postMessage({ source: SOURCE, type: 'CONNECTOR_READY' }, '*')
}

function relayToPage(message: WorkerToBridgeMessage): void {
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
    case 'START_PASSKEY_IMPORT':
      chrome.runtime.sendMessage({ type: 'START_PASSKEY_IMPORT', url: message.url })
      return
    case 'CLEAR_AND_CONTINUE':
      chrome.runtime.sendMessage({ type: 'CLEAR_AND_CONTINUE' })
      return
    case 'CANCEL_IMPORT':
      chrome.runtime.sendMessage({ type: 'CANCEL_IMPORT' })
      return
  }
}

function handleWorkerMessage(message: unknown): void {
  if (typeof message !== 'object' || message === null) 
    return

  const candidate = message as Record<string, unknown>
  if (candidate.type === 'EXISTING_SESSION') {
    relayToPage({ type: 'EXISTING_SESSION', number: (candidate.number as string | null) ?? null })
    return
  }

  if (candidate.type === 'IMPORT_SENT') {
    relayToPage({
      type: 'IMPORT_SENT',
      name: (candidate.name as string | null) ?? null,
      number: (candidate.number as string | null) ?? null,
    })
    return
  }
  
  if (candidate.type === 'IMPORT_ERROR') {
    relayToPage({ type: 'IMPORT_ERROR', reason: String(candidate.reason ?? 'unknown') })
    return
  }
}

function init(): void {
  if (window.__connectorBridge) return
  window.__connectorBridge = true

  window.addEventListener('message', handlePageMessage)
  chrome.runtime.onMessage.addListener((message) => {
    handleWorkerMessage(message)
  })

  announce()
}

init()
