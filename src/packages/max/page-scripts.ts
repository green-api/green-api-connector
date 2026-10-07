import browser from 'webextension-polyfill'

// Calls into the MAIN-world page script (page-script.js) and reads its result back.
export async function getSession(tabId: number): Promise<unknown> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (): Promise<unknown> => {
      const dumpFn = (window as unknown as { __maxSessionDump?: () => Promise<unknown> }).__maxSessionDump
      if (typeof dumpFn !== 'function') return null
      try {
        return await dumpFn()
      } catch {
        return null
      }
    },
  }).catch(() => null)
  return results?.[0]?.result ?? null
}
