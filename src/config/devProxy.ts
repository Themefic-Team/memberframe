/**
 * The local development API proxy: when it exists, and what it forwards to.
 *
 * In production the panel calls a public HTTPS API and the browser has nothing
 * to object to. In local development the panel is an HTTPS iframe inside
 * `framer.com` and the API is plain HTTP on a loopback port, and that request
 * is a public page reaching into the developer's own machine. Browsers are
 * closing that door: the request is dropped before it leaves, and what reaches
 * the console is a CORS failure with a null status, which reads as a server
 * misconfiguration and is not one. The server never saw the request.
 *
 * No response header fixes a request the browser refuses to send. So the dev
 * server forwards `/api` to the backend, and the panel calls its own origin,
 * which the browser has already agreed to load the panel from.
 *
 * This file is imported by `vite.config.ts` as well as by `config/backend.ts`,
 * so it must stay free of `import.meta` and of anything in `src` that reads it.
 * One function decides both halves, because a panel that calls its own origin
 * while nothing is forwarding gets a 404 for every request.
 */

const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The origin to forward `/api` to, or null when no proxy is needed.
 *
 * Only plain HTTP on loopback qualifies. An HTTPS host, a tunnel, or the
 * production API is reachable from the panel directly, and proxying it would
 * only hide the real origin from the server's logs.
 */
export function devProxyTarget(apiBaseUrl: string | undefined): string | null {
  if (!apiBaseUrl) return null;

  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:") return null;
  if (!LOOPBACK_HOSTNAMES.has(url.hostname)) return null;

  // The origin only. `apiClient` already tolerates a base ending in `/api`, and
  // the proxy must not forward `/api/x` to `/api/api/x` when someone sets one.
  return url.origin;
}

/**
 * The base URL the panel's own client uses.
 *
 * An empty string means same-origin: `fetch("/api/...")` against whatever
 * served the panel. That is correct only while the dev server is forwarding,
 * which is what `proxied` says.
 *
 * Canvas components do NOT use this. They run on the Framer canvas and on a
 * published site, where a relative URL would resolve against the creator's own
 * domain, so the generator keeps baking in the absolute `API_BASE_URL`.
 */
export function panelApiBaseUrl(apiBaseUrl: string, proxied: boolean): string {
  return proxied ? "" : apiBaseUrl;
}
