/**
 * Base path prefix for static assets. GitHub project pages serve the app
 * under /pixel-office-live, so absolute asset URLs must be prefixed.
 * Inlined at build time from next.config.js.
 */
export const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
