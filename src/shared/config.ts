// Маркер, который web страница будет должна использовать при отправке событий через postMessage()
export const CONNECTOR_SOURCE = 'green-api-connector' as const

// Домены на которых расширение будет слушать события PING, START_IMPORT и т.д. 
export const TRUSTED_DOMAINS = ['green-api.com', 'greenapi.com'] as const

// Extra domains of a white label (branding/brand.json -> trustedDomains), trusted the same way as TRUSTED_DOMAINS.
// Set by vite.config.ts (define); manifest.config.ts passes the same list to getTrustedHosts.
declare const __BRAND_TRUSTED_DOMAINS__: readonly string[]

// Добавляет localhost в список доверенных хостов. Рекомендуется выключить при публикации приложения. 
const DEV_MODE = false;

export function getTrustedHosts(brandDomains: readonly string[]): string[] {
  const allowedHosts = [...new Set([...TRUSTED_DOMAINS, ...brandDomains])].map((domain) => `https://*.${domain}/*`);
  if (DEV_MODE){
    allowedHosts.push(`http://localhost/*`, "file:///*")
  }
  return allowedHosts;
}

export function isTrustedOrigin(originOrUrl: string | undefined | null): boolean {
  if (!originOrUrl) 
    return false

  let parsed: URL
  try {
    parsed = new URL(originOrUrl)
  } catch {
    return false
  }

  const host = parsed.hostname
  const isLocalHost = parsed.protocol === 'http:' && host === 'localhost';
  if (DEV_MODE && (isLocalHost || parsed.protocol === 'file:')) {
    return true
  }

  if (parsed.protocol === 'https:') {
    return [...TRUSTED_DOMAINS, ...__BRAND_TRUSTED_DOMAINS__].some((domain) => host === domain || host.endsWith(`.${domain}`))
  }
  
  return false
}
