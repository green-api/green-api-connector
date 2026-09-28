import { ImportContext, MessengerSession } from '../types'
// import { pollSessionDump } from './page-scripts' - use this to call into the MAIN-world script

// TODO: replace with real driver-specific state. All state for the import process belongs
// here, as private fields on the session - the orchestrator that owns ImportContext never
// looks inside a session and never keeps track of import progress itself.
export class TemplateSession implements MessengerSession {
  private cancelled = false
  private pollTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly ctx: ImportContext) {}

  // Called once the popup tab has finished loading the messenger's page.
  // TODO: kick off whatever detection/polling the real messenger needs, then report
  // progress via `this.ctx.emit(...)` and completion via `this.ctx.finish()`.
  public async onTabReady(): Promise<void> {
    if (this.cancelled)
      return

    // Example shape, mirroring the whatsapp package:
    // const dump = await pollSessionDump(this.ctx.targetTabId)
    // ... decide whether the dump is complete/stable, then either poll again or submit it.
    throw new Error('TemplateSession.onTabReady is not implemented')
  }

  // Called when the user has confirmed clearing an existing session detected via an
  // { type: 'EXISTING_SESSION' } event emitted from onTabReady. Real messengers typically
  // wipe the site's browsing data here and reload the tab to start a fresh login flow.
  // TODO: implement, using src/platform/browser.ts helpers (removeBrowsingData, reloadTab) -
  // never call browser.* directly, those helpers log failures and keep the import flow going.
  public async onUserConfirmedClear(): Promise<void> {
    throw new Error('TemplateSession.onUserConfirmedClear is not implemented')
  }

  // Called by the orchestrator to stop the session, e.g. because the user closed the popup.
  // Only stop timers and mark the session as cancelled here - do NOT close the tab, that is
  // the orchestrator's responsibility, not the session's.
  //
  // If, by the time cancel() is called, an irreversible step has already happened (e.g. the
  // data was already sent to the server via ctx.finish()'s flow), still report it through
  // ctx.emit(...) - otherwise the user sees an error even though the import actually succeeded.
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
}
