import browser from 'webextension-polyfill'
import { RawSessionDump } from './types'

export async function pollSessionDump(tabId: number): Promise<RawSessionDump | null> {
  const results = await browser.scripting.executeScript({
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

export async function forcePasskeyMode(tabId: number): Promise<boolean> {
  const results = await browser.scripting.executeScript({
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
  return (results?.[0]?.result as boolean) ?? false
}

export async function readExistingSessionJid(tabId: number): Promise<string | null> {
  const results = await browser.scripting.executeScript({
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
  return (results?.[0]?.result as string | null) ?? null
}
