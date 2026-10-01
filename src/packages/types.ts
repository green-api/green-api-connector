export type ImportEvent =
  | { type: 'EXISTING_SESSION'; number: string }
  | { type: 'IMPORT_SENT'; name: string | null; number: string | null }
  | { type: 'IMPORT_ERROR'; reason: string; httpStatus?: number }

export interface ImportContext {
  readonly endpointUrl: string
  readonly targetTabId: number
  readonly targetWindowId: number
  emit(event: ImportEvent): void
  finish(): void
}

export interface MessengerSession {
  start(): Promise<void>
  // The orchestrator calls this only after the session emitted EXISTING_SESSION, and at most
  // once per such event - so a driver must not guard against unsolicited or repeated calls itself.
  onUserConfirmedClear(): Promise<void>
  cancel(): Promise<void>
}

export interface MessengerDriver {
  readonly origin: string
  startSession(ctx: ImportContext): MessengerSession
}

export function isImportEvent(value: unknown): value is ImportEvent {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false
  }
  const candidate = value as Record<string, unknown>
  switch (candidate.type) {
    case 'EXISTING_SESSION':
      return typeof candidate.number === 'string'
    case 'IMPORT_SENT':
      return true
    case 'IMPORT_ERROR':
      return (
        typeof candidate.reason === 'string' &&
        (candidate.httpStatus === undefined || typeof candidate.httpStatus === 'number')
      )
    default:
      return false
  }
}
