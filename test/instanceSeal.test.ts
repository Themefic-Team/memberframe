/**
 * 27-instance-seal.md: one Builder insert is one working component. A pasted
 * copy loses its seal; a breakpoint replica is not a copy; a component from
 * another project's site is locked; work from before seals keeps working.
 */

import { describe, expect, it } from "vitest";
import {
  applyToRegistry,
  instanceOfFile,
  nextRetryDelay,
  parseRegistry,
  planSeals,
  pruneRegistry,
  resolveUnknown,
  sealFingerprint,
  siteKeyOfFile,
  type SealedInstance,
} from "../src/services/instanceSealService";

const own = (nodeId: string, seal: string | undefined): SealedInstance => ({ nodeId, seal, ownSite: true });

describe("planSeals", () => {
  it("leaves the original alone and clears a pasted copy", () => {
    const plan = planSeals([own("n1", "s1.a.x"), own("n2", "s1.a.x")], { "s1.a.x": "n1" }, true);
    expect(plan.actions).toEqual([{ kind: "clear", nodeId: "n2" }]);
    expect(plan.unknown).toEqual([]);
  });

  it("lets one holder adopt a seal whose node is gone (cut and paste, or the original deleted)", () => {
    const plan = planSeals([own("n5", "s1.a.x"), own("n6", "s1.a.x")], { "s1.a.x": "n1" }, true);
    expect(plan.actions).toEqual([
      { kind: "adopt", nodeId: "n5", seal: "s1.a.x" },
      { kind: "clear", nodeId: "n6" },
    ]);
  });

  it("seals everything unsealed on the first run, and clears anything unsealed after it", () => {
    expect(planSeals([own("n1", undefined)], {}, false).actions).toEqual([{ kind: "seal", nodeId: "n1" }]);
    expect(planSeals([own("n1", undefined)], {}, true).actions).toEqual([{ kind: "clear", nodeId: "n1" }]);
  });

  it("leaves an already cleared copy alone", () => {
    expect(planSeals([own("n1", "")], {}, true).actions).toEqual([]);
  });

  it("re-seals a component whose code file is another site's, rather than locking it", () => {
    const plan = planSeals([{ nodeId: "n9", seal: "s1.b.y", ownSite: false }], {}, true);
    expect(plan.actions).toEqual([{ kind: "seal", nodeId: "n9" }]);
  });

  it("repairs components the first version locked by mistake, once", () => {
    expect(planSeals([own("n1", "")], {}, false).actions).toEqual([{ kind: "seal", nodeId: "n1" }]);
    expect(planSeals([own("n1", "")], {}, true).actions).toEqual([]);
  });

  it("asks the server about a seal it has no record of", () => {
    expect(planSeals([own("n1", "s1.c.z")], {}, true)).toEqual({ actions: [], unknown: ["s1.c.z"] });
  });
});

describe("resolveUnknown", () => {
  const instances = [own("n1", "s1.c.z"), own("n2", "s1.c.z"), own("n3", "s1.d.w")];

  it("adopts a seal this site issued, re-seals one from another site, and clears any copy", () => {
    expect(resolveUnknown(instances, ["s1.c.z", "s1.d.w"], ["s1.c.z"])).toEqual([
      { kind: "adopt", nodeId: "n1", seal: "s1.c.z" },
      { kind: "clear", nodeId: "n2" },
      { kind: "seal", nodeId: "n3" },
    ]);
  });
});

describe("the registry", () => {
  it("records adoptions and new seals, and survives junk", () => {
    const next = applyToRegistry({ old: "n0" }, [{ kind: "adopt", nodeId: "n5", seal: "s1.a.x" }, { kind: "seal", nodeId: "n7" }], { n7: "s1.new.q" });
    expect(next).toEqual({ old: "n0", "s1.a.x": "n5", "s1.new.q": "n7" });
    expect(parseRegistry("not json")).toEqual({});
    expect(parseRegistry('["a"]')).toEqual({});
    expect(parseRegistry('{"s":"n","bad":1}')).toEqual({ s: "n" });
  });
});

describe("finding MemberFrame instances", () => {
  const file = { id: "file_1", path: "MemberAuth.tsx", exports: [{ insertURL: "https://framer.com/m/MemberAuth-abc.js@v2" }] };

  it("matches the same file at any version, or by an identifier naming it", () => {
    expect(instanceOfFile({ insertURL: "https://framer.com/m/MemberAuth-abc.js@v2", componentIdentifier: "" }, file)).toBe(true);
    expect(instanceOfFile({ insertURL: "https://framer.com/m/MemberAuth-abc.js@v1", componentIdentifier: "" }, file)).toBe(true);
    expect(instanceOfFile({ insertURL: null, componentIdentifier: "codeFile:file_1:default" }, file)).toBe(true);
    expect(instanceOfFile({ insertURL: "https://framer.com/m/Other-xyz.js@v1", componentIdentifier: "x" }, file)).toBe(false);
  });

  it("reads the site key baked into a component file", () => {
    expect(siteKeyOfFile('const CONFIG = {\n  siteKey: "sk_abc",\n};')).toBe("sk_abc");
    expect(siteKeyOfFile("no config here")).toBeNull();
  });
});

describe("the guard", () => {
  it("changes nothing in a pass where the server cannot issue a seal", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(__dirname, "..", "src", "hooks", "useSealGuard.ts"), "utf8");
    // Seals are fetched before any write, and one failure ends the pass.
    expect(source).toMatch(/if \(issued\.kind !== "ok"\) \{\s*failed\(state\.seals\);\s*return 0;/);
    expect(source.indexOf("const issued = await requestSeal(siteId);")).toBeLessThan(source.indexOf('controls: { [SEAL_CONTROL]: "" }'));
  });
});

describe("no constant requests (27-instance-seal.md 6)", () => {
  const read = async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return readFileSync(join(__dirname, "..", "src", "hooks", "useSealGuard.ts"), "utf8");
  };

  it("fingerprints what a pass sees, in any order, and changes on a paste or a new seal", () => {
    const a = sealFingerprint([own("n1", "s1.a.x"), own("n2", "s1.b.y")], { "s1.a.x": "n1" }, true);
    expect(sealFingerprint([own("n2", "s1.b.y"), own("n1", "s1.a.x")], { "s1.a.x": "n1" }, true)).toBe(a);
    expect(sealFingerprint([own("n1", "s1.a.x"), own("n2", "s1.b.y"), own("n3", "s1.a.x")], { "s1.a.x": "n1" }, true)).not.toBe(a);
    expect(sealFingerprint([own("n1", "s1.a.x"), own("n2", "s1.b.y")], { "s1.a.x": "n1", "s1.b.y": "n2" }, true)).not.toBe(a);
    expect(sealFingerprint([own("n1", "s1.a.x"), own("n2", "s1.b.y")], { "s1.a.x": "n1" }, false)).not.toBe(a);
  });

  it("keeps only the seals still held, so the record cannot grow until writing it fails", () => {
    expect(pruneRegistry({ "s1.a.x": "n1", "s1.gone.z": "n9" }, ["s1.a.x", "s1.new.q"])).toEqual({ "s1.a.x": "n1" });
  });

  it("backs off after failures, to a cap of 10 minutes", () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(nextRetryDelay)).toEqual([0, 30_000, 60_000, 120_000, 300_000, 600_000, 600_000]);
  });

  it("runs on canvas changes and a one minute fallback, not every 10 seconds", async () => {
    const source = await read();
    expect(source).toContain("const GUARD_INTERVAL_MS = 60_000;");
    expect(source).toContain("framer.subscribeToCanvasRoot(schedule)");
    expect(source).toContain("framer.subscribeToSelection(schedule)");
    expect(source).toContain("if (fingerprint === state.settled) return 0;");
    expect(source).toContain("if (waiting(state.seals)) return 0;");
  });

  it("asks the server about a seal once per session, and prunes the record it writes", async () => {
    const source = await read();
    expect(source).toContain("const toAsk = plan.unknown.filter((seal) => !answeredSeals.has(`${siteId}|${seal}`));");
    expect(source).toContain("const answer = await verifySeals(siteId, toAsk);");
    expect(source).toContain("const next = pruneRegistry(applyToRegistry(registry, actions, sealed), held);");
  });
});
