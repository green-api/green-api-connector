export const INSTAGRAM_ORIGIN = 'https://www.instagram.com'

export const manifestContribution = {
  origin: INSTAGRAM_ORIGIN,
  matches: ['https://*.instagram.com/*'],
  pageScript: 'src/packages/instagram/page-script.js',
  extraPermissions: ['cookies'],
  extraHostPermissions: ['https://*.facebook.com/*'],
}
