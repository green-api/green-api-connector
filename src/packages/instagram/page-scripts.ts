import browser from 'webextension-polyfill'
import { Enrichment } from './types'

// Calls into the MAIN-world page script (page-script.js) and reads its result back.
export async function getSession(tabId: number): Promise<Enrichment | null> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (): Promise<unknown> => {
      const dumpFn = (window as unknown as { __igWebSessionDump?: () => Promise<unknown> }).__igWebSessionDump
      if (typeof dumpFn !== 'function') return null
      try {
        return await dumpFn()
      } catch {
        return null
      }
    },
  }).catch(() => null)
  return (results?.[0]?.result as Enrichment | null) ?? null
}
