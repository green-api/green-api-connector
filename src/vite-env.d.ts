/// <reference types="vite/client" />

// Trusted domains of the white label brand (branding/brand.json), set by vite.config.ts `define`.
// Exists only in the extension build - check with typeof (see src/shared/config.ts).
declare const __BRAND_TRUSTED_DOMAINS__: readonly string[] | undefined
