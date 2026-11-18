// Stand-in for 'webextension-polyfill' used only by the extension preview (scripts/preview, built by
// scripts/make-test-kit.mjs). It lets the real popup/popout React components render on a normal web page:
// i18n reads the locale messages passed in, runtime messaging is local and can be driven by the preview.

type Listener = (message: unknown) => void
export type Messages = Record<string, { message: string }>

let messages: Messages = {}
const pageListeners = new Set<Listener>()
const sendHandlers = new Set<Listener>()

export function setMessages(next: Messages): void {
  messages = next
}

// Delivers a message to the extension page as if it came from the service worker.
export function emitToExtensionPage(message: unknown): void {
  pageListeners.forEach((listener) => listener(message))
}

// Observes messages the extension page sends via browser.runtime.sendMessage.
export function onSendMessage(handler: Listener): () => void {
  sendHandlers.add(handler)
  return () => sendHandlers.delete(handler)
}

const browser = {
  i18n: {
    getMessage: (key: string): string => messages[key]?.message ?? '',
  },
  runtime: {
    sendMessage: (message: unknown): Promise<void> => {
      sendHandlers.forEach((handler) => handler(message))
      return Promise.resolve()
    },
    onMessage: {
      addListener: (listener: Listener): void => { pageListeners.add(listener) },
      removeListener: (listener: Listener): void => { pageListeners.delete(listener) },
    },
  },
}

export default browser
