// Vite resolves the actual `@messenger` alias to `src/packages/<MESSENGER>` at build time (see vite.config.ts).
declare module '@messenger' {
  export const driver: import('./packages/types').MessengerDriver
}
