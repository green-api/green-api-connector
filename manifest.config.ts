import { readFileSync } from 'node:fs'
import { defineManifest } from '@crxjs/vite-plugin'
import { getTrustedHosts } from './src/shared/config'
import { manifestContribution as whatsappManifest } from './src/packages/whatsapp/manifest'

const APP_HOSTS = getTrustedHosts()
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

const MESSENGER_MANIFESTS = {
  whatsapp: whatsappManifest,
}

function getMessengerManifest(selectedMessenger: string) {
  if (selectedMessenger in MESSENGER_MANIFESTS) {
    return MESSENGER_MANIFESTS[selectedMessenger as keyof typeof MESSENGER_MANIFESTS];
  }
  const availableMessengers = Object.keys(MESSENGER_MANIFESTS).join(', ')
  throw new Error(`Unknown MESSENGER "${selectedMessenger}". Available messengers: ${availableMessengers}`)
}

export const DEFAULT_MESSENGER = 'whatsapp'
export const MESSENGER = process.env.MESSENGER ?? DEFAULT_MESSENGER
const messengerManifest = getMessengerManifest(MESSENGER);

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  default_locale: 'en',
  version,
  permissions: ['scripting', 'tabs', 'browsingData'],
  host_permissions: [...messengerManifest.matches, ...APP_HOSTS],
  background: { 
    service_worker: 'src/background/index.ts',
    type: 'module',
    scripts: ['src/background/index.ts'],
  },
  action: {
    default_popup: 'index.html',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  content_scripts: [
    { 
      matches: messengerManifest.matches, 
      js: [messengerManifest.pageScript], 
      world: 'MAIN', 
      run_at: 'document_start' 
    },
    { 
      matches: APP_HOSTS, 
      js: ['src/content/app-bridge.ts'], 
      run_at: 'document_idle' 
    },
  ],
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  browser_specific_settings: {
    gecko: {
      id: "@green-api-connector",
      strict_min_version: '128.0',
    },
  },
})
