import { defineConfig } from "vitest/config";

/**
 * Deliberately separate from `vite.config.ts`.
 *
 * The dev config loads `@vitejs/plugin-basic-ssl` and `vite-plugin-framer`.
 * Neither belongs in a test run: the first generates a self-signed certificate
 * and the second rewrites the plugin entry for the Framer host. Vitest prefers
 * this file over `vite.config.ts` when both exist, so the test run starts clean.
 *
 * Environment is `node`. Layer 1 of the PRD section 16.1 triad is pure logic:
 * the SDK mock, compression, the lock patcher, and the `isEntitled` truth table.
 * Nothing there needs a DOM. Component rendering is layer 2 and will need
 * `jsdom`, which is a separate dependency and a separate decision.
 *
 * `VITE_API_BASE_URL` is blanked because Vitest reads the developer's `.env`,
 * which is gitignored and points at a local backend. Left alone, the generator
 * tests assert against whatever host that machine happens to have configured,
 * so the suite passes on one checkout and fails on the next. Both variables are
 * blanked, so `API_BASE_URL` in `config/backend.ts` falls through to its
 * loopback dev default on every machine.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    env: { VITE_API_BASE_URL: "", VITE_APP_BASE_URL: "" },
  },
});
