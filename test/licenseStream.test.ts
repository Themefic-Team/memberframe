/**
 * The license, pushed by the server (19-pro-lock-and-trial.md 5.1): the panel
 * holds one stream, reads each `license` event, and reconnects with a backoff.
 */

import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../src/services/apiClient";
import { openLicenseStream, parseSse, streamRetryDelay } from "../src/services/licenseStream";

describe("parseSse", () => {
  it("reads events, skips pings and retry lines, and keeps a split event for the next chunk", () => {
    const first = parseSse('retry: 5000\n\nevent: license\ndata: {"license":{"state":"trial"}}\n\n: ping\n\nevent: lic');
    expect(first.events).toEqual([{ event: "license", data: '{"license":{"state":"trial"}}' }]);
    expect(first.rest).toBe("event: lic");

    const second = parseSse(first.rest + 'ense\ndata: {"license":{"state":"expired"}}\n\n');
    expect(second.events).toEqual([{ event: "license", data: '{"license":{"state":"expired"}}' }]);
    expect(second.rest).toBe("");
  });

  it("reads CRLF streams and joins multi-line data", () => {
    expect(parseSse("event: a\r\ndata: one\r\ndata: two\r\n\r\n").events).toEqual([{ event: "a", data: "one\ntwo" }]);
  });
});

describe("streamRetryDelay", () => {
  it("backs off to a cap of 5 minutes", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(streamRetryDelay)).toEqual([0, 2_000, 5_000, 15_000, 60_000, 300_000, 300_000]);
  });
});

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("openLicenseStream", () => {
  it("hands each license to the panel, and backs off when a stream is cut short", async () => {
    vi.useFakeTimers();
    try {
      const openStream = vi.fn(async () => new Response(streamOf(['event: license\ndata: {"license":{"state":"trial"}}\n\n', ": ping\n\n"]), { status: 200 }));
      const seen: string[] = [];
      const stop = openLicenseStream({
        siteId: "site_1",
        onLicense: (view) => seen.push(view.state),
        client: { openStream } as unknown as ApiClient,
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(seen).toEqual(["trial"]);
      expect(openStream).toHaveBeenCalledWith("/api/plugin/events", { siteId: "site_1" }, expect.any(AbortSignal));

      // Ended at once (a proxy that does not hold streams): no reconnect loop.
      await vi.advanceTimersByTimeAsync(1_999);
      expect(openStream).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(openStream).toHaveBeenCalledTimes(2);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a fresh stream at once when a healthy one ends (the server's hourly limit)", async () => {
    vi.useFakeTimers();
    try {
      let release: () => void = () => undefined;
      const openStream = vi
        .fn()
        .mockImplementationOnce(
          async () =>
            new Response(
              new ReadableStream({
                start(controller) {
                  release = () => controller.close();
                },
              }),
              { status: 200 }
            )
        )
        .mockImplementation(async () => new Response(new ReadableStream(), { status: 200 }));
      const stop = openLicenseStream({ siteId: "site_1", onLicense: () => undefined, client: { openStream } as unknown as ApiClient });
      await vi.advanceTimersByTimeAsync(60_000);
      release();
      await vi.advanceTimersByTimeAsync(0);
      expect(openStream).toHaveBeenCalledTimes(2);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits longer after each failure", async () => {
    vi.useFakeTimers();
    try {
      const openStream = vi.fn(async () => {
        throw new Error("offline");
      });
      const stop = openLicenseStream({ siteId: "site_1", onLicense: () => undefined, client: { openStream } as unknown as ApiClient });
      await vi.advanceTimersByTimeAsync(0);
      expect(openStream).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(openStream).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(openStream).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(openStream).toHaveBeenCalledTimes(3);
      stop();
      await vi.advanceTimersByTimeAsync(600_000);
      expect(openStream).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
