import browser from 'webextension-polyfill'
import { focusWindow, reloadTab, removeBrowsingData, waitForTabLoad } from '../../platform/browser'
import { ImportContext, MessengerSession } from '../types'
import { buildCookieHeader, clearSessionCookies, findCookie, findCookieAnyDomain, harvestCookies, IgCookie } from './cookies'
import { extractImportedIdentity, isDumpCompleteAndStable } from './dump'
import { INSTAGRAM_ORIGIN } from './manifest'
import { getSession as getEnrichment } from './page-scripts'
import { synthInstagramDevice } from './synth'
import { InstagramDumpPayload, SynthDevice } from './types'

const MAX_POLLS = 240
const POLL_INTERVAL_MS = 2500
const WEB_APP_ID = '936619743392459'

export class InstagramSession implements MessengerSession {
  private stableCount = 0
  private dsUserIdSeenLastPoll: string | null = null
  private cancelled = false
  private readonly device: SynthDevice = synthInstagramDevice()

  constructor(private readonly ctx: ImportContext) {}

  public async start(): Promise<void> {
    await waitForTabLoad(this.ctx.targetTabId)
    if (this.cancelled)
      return

    const existingSessionId = await this.readExistingSessionId()
    if (this.cancelled)
      return

    if (existingSessionId) {
      const enrichment = await getEnrichment(this.ctx.targetTabId)
      if (this.cancelled)
        return

      const userId = enrichment?.me?.userId ?? null
      const username = enrichment?.me?.username ?? null
      this.ctx.emit({ type: 'EXISTING_SESSION', number: userId ?? username ?? '' })
      return
    }

    await this.waitForDumpAndSend()
  }

  public async onUserConfirmedClear(): Promise<void> {
    await Promise.all([removeBrowsingData(INSTAGRAM_ORIGIN), clearSessionCookies()])
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

  private async readExistingSessionId(): Promise<string | null> {
    try {
      const cookie = await browser.cookies.get({ url: INSTAGRAM_ORIGIN, name: 'sessionid' })
      return cookie?.value ?? null
    } catch {
      return null
    }
  }

  private async collectDump(): Promise<{ cookies: IgCookie[]; payload: Omit<InstagramDumpPayload, 'importedAt'> }> {
    const [cookies, enrichment] = await Promise.all([harvestCookies(), getEnrichment(this.ctx.targetTabId)])

    const pageCsrf = enrichment?.csrfToken ?? null
    if (pageCsrf && !findCookie(cookies, 'csrftoken')) {
      cookies.push({
        name: 'csrftoken',
        value: pageCsrf,
        domain: '.instagram.com',
        path: '/',
        secure: true,
        httpOnly: false,
        session: false,
        expirationDate: null,
        sameSite: 'no_restriction',
      })
    }

    const dsUserId = findCookie(cookies, 'ds_user_id') ?? enrichment?.me?.userId ?? ''

    const payload: Omit<InstagramDumpPayload, 'importedAt'> = {
      platform: 'instagram-web',
      sessionId: findCookie(cookies, 'sessionid') ?? '',
      dsUserId,
      csrfToken: findCookie(cookies, 'csrftoken') ?? '',
      userAgent: enrichment?.userAgent ?? '',
      appId: enrichment?.appId ?? WEB_APP_ID,
      cookies,
      cookieHeader: buildCookieHeader(cookies),
      me: {
        id: dsUserId || (enrichment?.me?.userId ?? ''),
        username: enrichment?.me?.username ?? undefined,
        name: enrichment?.me?.fullName ?? undefined,
      },
      device: this.device,
    }

    const mid = findCookieAnyDomain(cookies, 'mid')
    const igDid = findCookieAnyDomain(cookies, 'ig_did')
    const rur = findCookieAnyDomain(cookies, 'rur')
    const datr = findCookieAnyDomain(cookies, 'datr')
    if (mid) payload.mid = mid
    if (igDid) payload.igDid = igDid
    if (rur) payload.rur = rur
    if (datr) payload.datr = datr
    if (enrichment?.wwwClaim) payload.wwwClaim = enrichment.wwwClaim
    if (enrichment?.fbDtsg) payload.fbDtsg = enrichment.fbDtsg
    if (enrichment?.lsd) payload.lsd = enrichment.lsd
    if (enrichment?.acceptLanguage) payload.acceptLanguage = enrichment.acceptLanguage
    if (enrichment?.clientHints) payload.clientHints = enrichment.clientHints

    return { cookies, payload }
  }

  private async waitForDumpAndSend(): Promise<void> {
    await focusWindow(this.ctx.targetWindowId)

    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      if (this.cancelled)
        return

      const { cookies, payload } = await this.collectDump()
      if (this.cancelled)
        return

      const result = isDumpCompleteAndStable(
        { dsUserIdSeenLastPoll: this.dsUserIdSeenLastPoll, stableCount: this.stableCount },
        cookies,
      )
      this.dsUserIdSeenLastPoll = result.dsUserIdSeenLastPoll
      this.stableCount = result.stableCount

      if (result.stable) {
        await this.sendDump(payload)
        return
      }
    }

    this.ctx.emit({ type: 'IMPORT_ERROR', reason: 'timeout' })
    this.ctx.finish()
  }

  private async sendDump(payload: Omit<InstagramDumpPayload, 'importedAt'>): Promise<void> {
    const fullPayload: InstagramDumpPayload = { ...payload, importedAt: Date.now() }

    let response: Response
    try {
      response = await fetch(this.ctx.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
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

    const { username, number } = extractImportedIdentity(fullPayload)
    this.ctx.emit({ type: 'IMPORT_SENT', name: username, number })
    await Promise.all([removeBrowsingData(INSTAGRAM_ORIGIN), clearSessionCookies()])
    this.ctx.finish()
  }
}
