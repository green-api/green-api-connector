import { MessengerDriver } from '../types'
import { MaxSession } from './session'
import { MAX_ORIGIN } from './manifest'

export const driver: MessengerDriver = {
  origin: MAX_ORIGIN,
  startSession: (ctx) => new MaxSession(ctx),
}
