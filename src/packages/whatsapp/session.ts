import { focusWindow, reloadTab, removeBrowsingData } from '../../platform/browser'
import { ImportContext, MessengerSession } from '../types'
import { extractImportedIdentity, isDumpCompleteAndStable } from './dump'
import { forcePasskeyMode, pollSessionDump, readExistingSessionJid } from './page-scripts'
import { ImportedIdentity, RawSessionDump } from './types'
import { WA_ORIGIN } from './manifest'

const MAX_POLLS = 120
const POLL_INTERVAL_MS = 2500
const MAX_NOISE_KEY_MISSING_POLLS = 5

export class WhatsAppSession implements MessengerSession {
  private attempts = 0
  private stableCount = 0
  private meJidSeenLastPoll: string | null = null
  private noiseKeyMissingCount = 0
  private awaitingConsent = false
  private flowStarted = false
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private cancelled = false

  constructor(private readonly ctx: ImportContext) {}

  public async onTabReady(): Promise<void> {
    if (this.cancelled || this.awaitingConsent || this.flowStarted)
      return

    const existingJid = await readExistingSessionJid(this.ctx.targetTabId)
    if (this.cancelled)
      return

    if (existingJid) {
      this.awaitingConsent = true
      this.ctx.emit({ type: 'EXISTING_SESSION', number: existingJid })
      return
    }

    await this.beginPasskeyFlow()
  }

  public async onUserConfirmedClear(): Promise<void> {
    if (!this.awaitingConsent)
      return

    this.awaitingConsent = false

    await removeBrowsingData(WA_ORIGIN)

    if (this.cancelled)
      return

    this.flowStarted = false
    await reloadTab(this.ctx.targetTabId)
  }

  public async cancel(): Promise<void> {
    this.cancelled = true
    this.clearPollTimer()
  }

  private clearPollTimer(): void {
    if (this.pollTimer === null)
      return
    clearTimeout(this.pollTimer)
    this.pollTimer = null
  }

  private async beginPasskeyFlow(): Promise<void> {
    this.flowStarted = true

    await focusWindow(this.ctx.targetWindowId)

    const maxForceAttempts = 5
    for (let attempt = 0; attempt < maxForceAttempts; attempt += 1) {
      if (this.cancelled)
        return

      const ok = await forcePasskeyMode(this.ctx.targetTabId)
      if (ok)
        break

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    if (this.cancelled)
      return

    this.pollTimer = setTimeout(() => {
      void this.pollOnce()
    }, POLL_INTERVAL_MS)
  }

  private async pollOnce(): Promise<void> {
    if (this.cancelled)
      return

    this.attempts += 1

    const dump = await pollSessionDump(this.ctx.targetTabId)

    if (this.cancelled)
      return

    const result = isDumpCompleteAndStable(
      { stableCount: this.stableCount, meJidSeenLastPoll: this.meJidSeenLastPoll, noiseKeyMissingCount: this.noiseKeyMissingCount },
      dump,
    )
    this.stableCount = result.stableCount
    this.meJidSeenLastPoll = result.meJidSeenLastPoll
    this.noiseKeyMissingCount = result.noiseKeyMissingCount

    if (result.stable) {
      await this.submitDump(dump)
      return
    }

    if (this.noiseKeyMissingCount >= MAX_NOISE_KEY_MISSING_POLLS) {
      await this.finishWithError('noise_key_unavailable')
      return
    }

    if (this.attempts >= MAX_POLLS) {
      await this.finishWithError('timeout')
      return
    }

    this.pollTimer = setTimeout(() => {
      void this.pollOnce()
    }, POLL_INTERVAL_MS)
  }

  private async submitDump(dump: RawSessionDump | null): Promise<void> {
    let response: Response
    try {
      response = await fetch(this.ctx.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dump),
      })
    } catch {
      await this.finishWithError('network')
      return
    }

    if (!response.ok) {
      await this.finishWithError('http_error', response.status)
      return
    }

    await this.finishWithSuccess(extractImportedIdentity(dump))
  }

  private async finishWithSuccess(me?: ImportedIdentity): Promise<void> {
    this.clearPollTimer()

    this.ctx.emit({ type: 'IMPORT_SENT', name: me?.name ?? null, number: me?.number ?? null })

    await removeBrowsingData(WA_ORIGIN)

    if (this.cancelled)
      return

    this.ctx.finish()
  }

  private async finishWithError(reason: string, httpStatus?: number): Promise<void> {
    this.clearPollTimer()

    if (this.cancelled)
      return

    this.ctx.emit({ type: 'IMPORT_ERROR', reason, httpStatus })
    this.ctx.finish()
  }
}
