/// <reference types="vite/client" />

/**
 * True when `vite dev` is forwarding `/api` to a local backend.
 *
 * Replaced at build time by `define` in `vite.config.ts`. Undefined under
 * vitest, which has its own config, so every read is behind a `typeof` guard.
 */
declare const __MF_DEV_API_PROXY__: boolean;
