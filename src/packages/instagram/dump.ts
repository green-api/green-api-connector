import { findCookie, IgCookie } from './cookies'
import { ImportedIdentity, InstagramDumpPayload } from './types'

const CSRF_GRACE_POLLS = 8 // ~20 s

export function extractImportedIdentity(payload: InstagramDumpPayload): ImportedIdentity {
  const username = payload.me.username && payload.me.username.trim() ? payload.me.username.trim() : null
  const number = payload.me.id ?? payload.dsUserId
  return { username, number }
}

export interface DumpStabilityState {
  dsUserIdSeenLastPoll: string | null
  stableCount: number
}

export interface DumpStabilityResult extends DumpStabilityState {
  stable: boolean
}

export function isDumpCompleteAndStable(state: DumpStabilityState, cookies: IgCookie[]): DumpStabilityResult {
  const sessionId = findCookie(cookies, 'sessionid')
  const dsUserId = findCookie(cookies, 'ds_user_id')

  if (!sessionId || !dsUserId) {
    return { dsUserIdSeenLastPoll: null, stableCount: 0, stable: false }
  }

  const stableCount = state.dsUserIdSeenLastPoll === dsUserId ? state.stableCount + 1 : 1
  const next = { dsUserIdSeenLastPoll: dsUserId, stableCount }
  if (stableCount < 2) return { ...next, stable: false }

  if (findCookie(cookies, 'csrftoken')) return { ...next, stable: true }
  if (stableCount >= 2 + CSRF_GRACE_POLLS) {
    console.warn('[ig-connector] csrftoken cookie not found after the grace period - importing the session without it')
    return { ...next, stable: true }
  }
  return { ...next, stable: false }
}
