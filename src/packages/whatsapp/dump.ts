import { ImportedIdentity, RawSessionDump } from './types'

export function extractImportedIdentity(dump: unknown): ImportedIdentity {
  const device = (dump as { device?: { meJid?: string | null; meDisplayName?: string | null } } | null)?.device
  const jid = device?.meJid ?? null
  const number = jid ? jid.split('@')[0].split(':')[0] || null : null
  const rawName = device?.meDisplayName
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null
  return { name, number }
}

export interface DumpStabilityState {
  stableCount: number
  meJidSeenLastPoll: string | null
  noiseKeyMissingCount: number
}

export interface DumpStabilityResult extends DumpStabilityState {
  stable: boolean
}

export function isDumpCompleteAndStable(state: DumpStabilityState, dump: RawSessionDump | null): DumpStabilityResult {
  const device = dump?.device
  const meJid = device?.meJid ?? null

  if (!device || !meJid) {
    return { ...state, stableCount: 0, stable: false }
  }

  const hasNoiseKey = Boolean(device.noiseKey)
  const hasIdentityKey = Boolean(device.identityKey)
  const hasAccount = Boolean(device.account)

  if (!hasNoiseKey) {
    return { ...state, noiseKeyMissingCount: state.noiseKeyMissingCount + 1, stableCount: 0, stable: false }
  }

  if (!hasIdentityKey || !hasAccount) {
    return { ...state, noiseKeyMissingCount: 0, stableCount: 0, stable: false }
  }

  const stableCount = state.meJidSeenLastPoll === meJid ? state.stableCount + 1 : 1

  return {
    noiseKeyMissingCount: 0,
    meJidSeenLastPoll: meJid,
    stableCount,
    stable: stableCount >= 2,
  }
}
