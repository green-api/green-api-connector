import { focusWindow, reloadTab, removeBrowsingData, waitForTabLoad } from '../../platform/browser'
import { ImportContext, MessengerSession } from '../types'
import { MAX_ORIGIN } from './manifest'
import { getSession as getSessionDump } from './page-scripts'

const MAX_POLLS = 120
const POLL_INTERVAL_MS = 2500

export class MaxSession implements MessengerSession {
  private cancelled = false

  constructor(private readonly ctx: ImportContext) {}

  public async start(): Promise<void> {
    await waitForTabLoad(this.ctx.targetTabId)
    if (this.cancelled)
      return

    const dump = await getSessionDump(this.ctx.targetTabId)
    if (dump != null){
      this.ctx.emit({ type: 'EXISTING_SESSION', number: ""}) // TODO: вытаскивать номер телефона для событий
      return;
    }

    await this.waitForDumpAndSend()
  }

  public async onUserConfirmedClear(): Promise<void> {
    await removeBrowsingData(MAX_ORIGIN)
    if (this.cancelled)
      return

    await reloadTab(this.ctx.targetTabId)
    await waitForTabLoad(this.ctx.targetTabId)
    if (this.cancelled)
      return

    await this.waitForDumpAndSend()
  }

  public async onUserConfirmedKeep(): Promise<void> {
    await this.waitForDumpAndSend()
  }

  public async cancel(): Promise<void> {
    this.cancelled = true
  }

  private async waitForDumpAndSend(): Promise<void> {
    await focusWindow(this.ctx.targetWindowId)

    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      if (this.cancelled)
        return

      const dump = await getSessionDump(this.ctx.targetTabId)
      if (this.cancelled)
        return

      if (dump != null) {
        await this.sendDump(dump)
        return
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    if (this.cancelled)
      return

    this.ctx.emit({ type: 'IMPORT_ERROR', reason: 'timeout' })
    this.ctx.finish()
  }

  private async sendDump(dump: unknown): Promise<void> {
    let response: Response
    try {
      response = await fetch(this.ctx.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dump),
      })
    } catch {
      if (this.cancelled)
        return
      this.ctx.emit({ type: 'IMPORT_ERROR', reason: 'network' })
      this.ctx.finish()
      return
    }

    if (this.cancelled)
      return

    if (!response.ok) {
      this.ctx.emit({ type: 'IMPORT_ERROR', reason: 'http_error', httpStatus: response.status })
      this.ctx.finish()
      return
    }

    this.ctx.emit({ type: 'IMPORT_SENT', name: null, number: null })
    await removeBrowsingData(MAX_ORIGIN)
    this.ctx.finish()
  }
}
