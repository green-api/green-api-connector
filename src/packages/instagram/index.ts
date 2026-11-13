import { MessengerDriver } from '../types'
import { InstagramSession } from './session'
import { INSTAGRAM_ORIGIN } from './manifest'

export const driver: MessengerDriver = {
  origin: INSTAGRAM_ORIGIN,
  startSession: (ctx) => new InstagramSession(ctx),
}
