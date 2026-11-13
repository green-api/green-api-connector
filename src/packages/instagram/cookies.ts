import browser, { Cookies } from 'webextension-polyfill'

export interface IgCookie {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  session: boolean
  expirationDate: number | null
  sameSite?: string
}

const COOKIE_DOMAINS = ['instagram.com', 'facebook.com'] as const

function mapCookie(c: Cookies.Cookie): IgCookie {
  return {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    session: c.session,
    expirationDate: c.expirationDate ?? null,
    sameSite: c.sameSite,
  }
}

async function getCookiesForDomain(domain: string): Promise<IgCookie[]> {
  try {
    const cookies = await browser.cookies.getAll({ domain })
    return cookies.map(mapCookie)
  } catch {
    return []
  }
}

export async function harvestCookies(): Promise<IgCookie[]> {
  const groups = await Promise.all(COOKIE_DOMAINS.map((d) => getCookiesForDomain(d)))
  const seen = new Set<string>()
  const out: IgCookie[] = []
  for (const group of groups) {
    for (const c of group) {
      const key = `${c.name} ${c.domain} ${c.path}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(c)
    }
  }
  return out
}

export async function clearSessionCookies(): Promise<void> {
  const cookies = await harvestCookies()
  await Promise.all(cookies.map(async (c) => {
    const url = `${c.secure ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path}`
    try {
      await browser.cookies.remove({ url, name: c.name })
    } catch (error) {
      console.warn('[packages/instagram] clearSessionCookies failed', { url, name: c.name, error })
    }
  }))
}

export function findCookie(cookies: IgCookie[], name: string): string | null {
  const c = cookies.find(
    (x) => x.name === name && x.domain.replace(/^\./, '').endsWith('instagram.com'),
  )
  return c ? c.value : null
}

export function findCookieAnyDomain(cookies: IgCookie[], name: string): string | null {
  const c = cookies.find((x) => x.name === name)
  return c ? c.value : null
}

export function buildCookieHeader(cookies: IgCookie[]): string {
  return cookies
    .filter((c) => {
      const d = c.domain.replace(/^\./, '')
      return d === 'instagram.com' || d.endsWith('.instagram.com')
    })
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
}
