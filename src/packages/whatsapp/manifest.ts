export const WA_ORIGIN = 'https://web.whatsapp.com'

export const manifestContribution = {
  origin: WA_ORIGIN,
  matches: [`${WA_ORIGIN}/*`],
  pageScript: 'src/packages/whatsapp/wa-web-dump.js',
}
