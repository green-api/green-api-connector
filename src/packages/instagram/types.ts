import { IgCookie } from './cookies'

export interface ClientHints {
  ua: string | null
  fullVersionList: string | null
  mobile: string | null
  platform: string | null
  platformVersion: string | null
  model: string | null
  prefersColorScheme: string | null
}

export interface Enrichment {
  userAgent: string | null
  acceptLanguage?: string | null
  clientHints?: ClientHints | null
  appId: string | null
  wwwClaim: string | null
  fbDtsg?: string | null
  lsd?: string | null
  csrfToken?: string | null
  me: { userId: string | null; username: string | null; fullName: string | null }
}

export interface SynthDevice {
  deviceId: string
  phoneId: string
  uuid: string
  adid: string
  familyDeviceId: string
}

export interface InstagramDumpPayload {
  platform: 'instagram-web'
  sessionId: string
  dsUserId: string
  csrfToken: string
  mid?: string
  igDid?: string
  rur?: string
  datr?: string
  wwwClaim?: string
  fbDtsg?: string
  lsd?: string
  userAgent: string
  acceptLanguage?: string
  clientHints?: ClientHints
  appId: string
  cookies: IgCookie[]
  cookieHeader: string
  me: { id: string; username?: string; name?: string }
  device: SynthDevice
  importedAt: number
}

export type ImportedIdentity = { username: string | null; number: string | null }
