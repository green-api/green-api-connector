// Маркер, который web страница будет должна использовать при отправке событий через postMessage()
export const CONNECTOR_SOURCE = 'green-api-connector' as const

// Домены на которых расширение будет слушать события PING, START_IMPORT и т.д. 
export const TRUSTED_DOMAINS = ['green-api.com', 'greenapi.com'] as const

// White label: trustedDomains of branding/brand.json REPLACE TRUSTED_DOMAINS (vite.config.ts -> define / manifest).
// The define exists only in the extension build - typeof keeps Node (manifest.config.ts) and other bundles safe.
const BRAND_DOMAINS = typeof __BRAND_TRUSTED_DOMAINS__ === 'undefined' ? [] : __BRAND_TRUSTED_DOMAINS__
const pickDomains = (brand: readonly string[]) => (brand.length ? brand : TRUSTED_DOMAINS)

// Добавляет localhost в список доверенных хостов. Рекомендуется выключить при публикации приложения. 
const DEV_MODE = false;

export function getTrustedHosts(brandDomains: readonly string[]): string[] {
  const allowedHosts = pickDomains(brandDomains).map((domain) => `https://*.${domain}/*`);
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
    return pickDomains(BRAND_DOMAINS).some((domain) => host === domain || host.endsWith(`.${domain}`))
  }
  
  return false
}
