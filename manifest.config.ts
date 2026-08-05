import { defineManifest } from '@crxjs/vite-plugin'
import { getTrustedHosts } from './src/shared/config'

const APP_HOSTS = getTrustedHosts()

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  default_locale: 'en',
  version: '1.1.0',
  permissions: ['scripting', 'tabs', 'browsingData'],
  host_permissions: ['https://web.whatsapp.com/*', ...APP_HOSTS],
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
      matches: ['https://web.whatsapp.com/*'], 
      js: ['src/content/wa-web-dump.js'], 
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
})
