/**
 * Mock-mode switch, in one place.
 *
 * Steps 1-10 resolve against the in-memory fixtures in `mockCatalogue.js` so the
 * UI can be built and verified without a database. Step 11 adds the real REST
 * API; every service checks this flag and takes one path or the other.
 *
 * Defaults to mock so a fresh clone runs with no configuration. Opt into the API
 * with an env var at build/dev time:
 *
 *   PowerShell:  $env:VITE_USE_MOCK = 'false'; npm run dev
 *   bash:        VITE_USE_MOCK=false npm run dev
 *
 * Vite inlines env vars at build time, so changing it requires a restart.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

/** Where the API lives when mock mode is off. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';