import browser from 'webextension-polyfill'

// Example of calling into the MAIN-world page script (template-web-dump.js) and reading
// its result back. Add one function like this per page-level operation your messenger needs.
export async function pollSessionDump(tabId: number): Promise<unknown> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (): Promise<unknown> => {
      const dumpFn = (window as unknown as { __templateWebSessionDump?: () => Promise<unknown> }).__templateWebSessionDump
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
