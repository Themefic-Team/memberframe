/**
 * The license, pushed by the server (19-pro-lock-and-trial.md 5.1).
 *
 * While the panel is open it holds one `GET /api/plugin/events` stream. The
 * server sends the license when the stream opens and again whenever it changes:
 * a trial ends, a plan is bought, renewed, or expires. The panel rewrites the
 * deployed components' baked lines, so every canvas instance locks or unlocks
 * at once, and nothing asks the server on a timer.
 *
 * `fetch` with a streamed body, not `EventSource`: EventSource cannot send the
 * `Authorization` header, and the token must never go in a URL.
 *
 * The parsing and the retry delay are pure and tested; `openLicenseStream`
 * only wires them to the network.
 */

import { apiClient, type ApiClient } from "./apiClient";
import type { LicenseView } from "./licenseService";

export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Complete events from a buffer of stream text, and what is left over (an
 * event split across chunks). Comments (`: ping`) and `retry:` lines are
 * skipped; an event with no `data:` is dropped.
 */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const text = buffer.replace(/\r\n?/g, "\n");
  const events: SseEvent[] = [];
  let start = 0;
  let end = text.indexOf("\n\n", start);
  while (end !== -1) {
    const block = text.slice(start, end);
    start = end + 2;
    end = text.indexOf("\n\n", start);
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line === "" || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length > 0) events.push({ event, data: data.join("\n") });
  }
  return { events, rest: text.slice(start) };
}

const RETRY_STEPS_MS = [2_000, 5_000, 15_000, 60_000];
const RETRY_CAP_MS = 5 * 60 * 1000;
/** A stream open at least this long was healthy; ending sooner is a failure. */
const HEALTHY_STREAM_MS = 30_000;

/** How long to wait before reconnecting after `failures` failed tries in a row. */
export function streamRetryDelay(failures: number): number {
  if (failures <= 0) return 0;
  return RETRY_STEPS_MS[failures - 1] ?? RETRY_CAP_MS;
}

export interface LicenseStreamOptions {
  siteId: string;
  onLicense: (view: LicenseView) => void;
  client?: ApiClient;
}

/**
 * Keep the stream open until the returned function is called: reconnect when
 * it ends (the server closes it hourly), and back off while it fails. A
 * refusal (signed out, not this creator's site) also backs off, to the cap,
 * since only a new sign in fixes it and that restarts the stream anyway.
 */
export function openLicenseStream({ siteId, onLicense, client = apiClient }: LicenseStreamOptions): () => void {
  let stopped = false;
  let failures = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => void connect(), streamRetryDelay(failures));
  };

  const connect = async () => {
    timer = null;
    if (stopped) return;
    controller = new AbortController();
    try {
      const response = await client.openStream("/api/plugin/events", { siteId }, controller.signal);
      if (!response.ok || !response.body) {
        failures = response.status === 401 || response.status === 403 || response.status === 404 ? RETRY_STEPS_MS.length + 1 : failures + 1;
        void response.body?.cancel().catch(() => undefined);
        schedule();
        return;
      }
      const openedAt = Date.now();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done || stopped) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        for (const item of parsed.events) {
          if (item.event !== "license") continue;
          try {
            const body = JSON.parse(item.data) as { license?: LicenseView };
            if (body.license && typeof body.license.state === "string") onLicense(body.license);
          } catch {
            // A malformed frame is skipped; the next one carries the whole license again.
          }
        }
      }
      // A stream that lived ended on purpose (the server's hourly limit, or a
      // restart): open a fresh one now. One cut short (a proxy that does not
      // hold streams) counts as a failure, so it never reconnects in a loop.
      failures = Date.now() - openedAt >= HEALTHY_STREAM_MS ? 0 : failures + 1;
      schedule();
    } catch {
      if (stopped) return;
      failures += 1;
      schedule();
    }
  };

  void connect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
  };
}
