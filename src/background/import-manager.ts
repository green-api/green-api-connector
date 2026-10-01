import { closeTab, createPopup } from '../platform/browser'
import { driver } from '@messenger'
import type { ImportContext, MessengerSession } from '../packages/types'
import { sendImportResponse } from './messaging'

type ImportState =
  | { 
      phase: 'creating'; 
      cancelRequested: boolean 
    }
  | {
      phase: 'running'
      session: MessengerSession
      targetTabId: number
      originTabId: number | null
      cancelled: boolean
      awaitingConsent: boolean
    }

let state: ImportState | null = null

export async function startImport(endpointUrl: string, originTabId: number | null): Promise<void> {
  if (state) {
    sendImportResponse(originTabId, { type: 'IMPORT_ERROR', reason: 'import_already_in_progress' })
    return
  }

  state = { phase: 'creating', cancelRequested: false }

  let popup: { targetTabId: number; targetWindowId: number }
  try {
    popup = await createPopup(driver.origin)
  } catch {
    state = null
    sendImportResponse(originTabId, { type: 'IMPORT_ERROR', reason: 'unexpected_error' })
    return
  }

  if (state?.phase === 'creating' && state.cancelRequested) {
    void closeTab(popup.targetTabId)
    state = null
    return
  }

  const ctx: ImportContext = {
    endpointUrl,
    targetTabId: popup.targetTabId,
    targetWindowId: popup.targetWindowId,
    emit: (event) => {
      if (event.type === 'EXISTING_SESSION' && state?.phase === 'running') {
        state.awaitingConsent = true
      }
      sendImportResponse(originTabId, event)
    },
    finish: () => {
      void closeTab(popup.targetTabId)
      state = null
    },
  }

  const session = driver.startSession(ctx)
  state = {
    phase: 'running',
    session,
    targetTabId: popup.targetTabId,
    originTabId,
    cancelled: false,
    awaitingConsent: false,
  }

  session.start().catch((error) => {
    console.warn('[background/import-manager] session.start failed', { error })
  })
}

export function handleTabRemoved(tabId: number): void {
  if (!state || state.phase !== 'running' || state.targetTabId !== tabId) {
    return
  }

  const { session, originTabId, cancelled } = state
  if (!cancelled) {
    sendImportResponse(originTabId, { type: 'IMPORT_ERROR', reason: 'tab_closed' })
  }
  void session.cancel()
  state = null
}

export async function confirmClearAndContinue(): Promise<void> {
  if (!state || state.phase !== 'running' || !state.awaitingConsent) {
    return
  }
  state.awaitingConsent = false
  await state.session.onUserConfirmedClear()
}

export async function cancelActiveImport(): Promise<void> {
  if (!state) {
    return
  }

  if (state.phase === 'creating') {
    state.cancelRequested = true
    return
  }

  state.cancelled = true
  const { session, targetTabId } = state
  await session.cancel()
  await closeTab(targetTabId)
  state = null
}
