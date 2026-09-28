import { MessengerDriver } from '../types'
import { TemplateSession } from './session'
import { TEMPLATE_ORIGIN } from './manifest'

// The export name `driver` is fixed: Vite's `@messenger` alias (see vite.config.ts) points
// at this package's index.ts and expects to find `driver` here. Do not rename it.
export const driver: MessengerDriver = {
  origin: TEMPLATE_ORIGIN,
  startSession: (ctx) => new TemplateSession(ctx),
}
