/**
 * The production backend address, and the rule every shipped address obeys.
 *
 * Marketplace review problems 2 and 8 (docs/development-docs/36): a reviewer
 * found a loopback fallback and a runtime `process.env` switch in the bundle.
 * The shipped plugin now has exactly one backend address, fixed here, and the
 * build refuses to finish when it is not public HTTPS.
 *
 * `vite.config.ts` imports this file, so like `config/devProxy.ts` it must stay
 * free of `import.meta` and of anything in `src` that reads it.
 */

export const PRODUCTION_API_BASE_URL = "https://app.framefic.com/memberframe";

/**
 * Is this a URL only the developer's own machine can reach?
 *
 * The distinction matters because two different things want a base URL and
 * they are not the same thing:
 *
 *   - The plugin panel under `vite dev` runs on the developer's machine, so
 *     `127.0.0.1` is exactly right for it, which is what `VITE_API_BASE_URL`
 *     is for.
 *   - A generated canvas component runs on a creator's PUBLISHED site, on
 *     someone else's browser, which cannot reach the developer's loopback
 *     address at all.
 */
export function isLoopbackUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

/**
 * Throw unless `value` is a public HTTPS address. Called by `vite.config.ts`
 * on every build, so a shipped bundle can never carry anything else.
 */
export function assertProductionApiBaseUrl(value: string): void {
  if (!value.startsWith("https://") || isLoopbackUrl(value)) {
    throw new Error(
      `Production API base URL must be public HTTPS, got "${value}". Fix PRODUCTION_API_BASE_URL in src/config/productionApi.ts.`
    );
  }
}
