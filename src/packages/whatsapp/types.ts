export interface RawSessionDump {
  device?: {
    noiseKey?: unknown
    identityKey?: unknown
    account?: unknown
    meJid?: string | null
  }
}

export type ImportedIdentity = { name: string | null; number: string | null }
