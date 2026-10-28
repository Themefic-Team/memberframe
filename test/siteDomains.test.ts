/**
 * The site's domains, typed by the creator in Settings. The panel no longer
 * reads the published domains from Framer (Marketplace review, 2026-10-28), so
 * this is the only way a domain reaches the allowlist.
 */

import { describe, expect, it } from "vitest";
import { domainLabel, isWorking, seenLabel, toOrigin } from "../src/utils/siteDomains";

describe("toOrigin", () => {
  it("accepts a bare domain, as a creator types it", () => {
    expect(toOrigin("acme.com")).toBe("https://acme.com");
    expect(toOrigin("  www.acme.com ")).toBe("https://www.acme.com");
    expect(toOrigin("relaxed-centre-992797.framer.app")).toBe("https://relaxed-centre-992797.framer.app");
  });

  it("keeps only the origin of a full address", () => {
    expect(toOrigin("https://acme.com/members/login?x=1#top")).toBe("https://acme.com");
    expect(toOrigin("https://acme.com:8443/")).toBe("https://acme.com:8443");
  });

  it("allows plain http only on the creator's own machine, as the server does", () => {
    expect(toOrigin("http://acme.com")).toBeNull();
    expect(toOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(toOrigin("http://127.0.0.1:5173/page")).toBe("http://127.0.0.1:5173");
  });

  it("refuses what is not a domain", () => {
    expect(toOrigin("")).toBeNull();
    expect(toOrigin("acme")).toBeNull();
    expect(toOrigin("ftp://acme.com")).toBeNull();
    expect(toOrigin("https://user:pass@acme.com")).toBeNull();
    expect(toOrigin("not a domain")).toBeNull();
  });
});

describe("domainLabel", () => {
  it("shows the host alone", () => {
    expect(domainLabel("https://acme.com")).toBe("acme.com");
    expect(domainLabel("http://localhost:3000")).toBe("localhost:3000");
  });
});

describe("a domain's status in Profile", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

  it("is working when a page there called within 30 days", () => {
    expect(isWorking(daysAgo(0), now)).toBe(true);
    expect(isWorking(daysAgo(30), now)).toBe(true);
    expect(isWorking(daysAgo(31), now)).toBe(false);
    expect(isWorking("not a date", now)).toBe(false);
  });

  it("says when it was last seen, in words", () => {
    expect(seenLabel(daysAgo(0), now)).toBe("Seen on your live site today.");
    expect(seenLabel(daysAgo(1), now)).toBe("Seen on your live site yesterday.");
    expect(seenLabel(daysAgo(5), now)).toBe("Seen on your live site 5 days ago.");
  });
});
