export const MAX_ORIGIN = 'https://web.max.ru'

export const manifestContribution = {
  origin: MAX_ORIGIN,
  matches: [`${MAX_ORIGIN}/*`],
  pageScript: 'src/packages/max/page-script.js',
}
