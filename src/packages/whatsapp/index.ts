import { MessengerDriver } from '../types'
import { WhatsAppSession } from './session'
import { WA_ORIGIN } from './manifest'

export const driver: MessengerDriver = {
  origin: WA_ORIGIN,
  startSession: (ctx) => new WhatsAppSession(ctx),
}

export * from './types'
